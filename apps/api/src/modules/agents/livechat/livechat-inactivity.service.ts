import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatSessions } from './schema';
import { eq } from 'drizzle-orm';
import { LivechatService } from './livechat.service';
import { SesService } from '../../ses/ses.service';
import { SettingsService } from '../../settings/settings.service';
import { LivechatInboundService } from './livechat-inbound.service';
import { LivechatStreamService } from './livechat-stream.service';
import { PushService } from '../../push/push.service';

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000;    // 3 min visitor absence
const RESEND_COOLDOWN_MS = 30 * 60 * 1000;         // 30 min between emails per session
const SCAN_INTERVAL_MS = 60 * 1000;                // scan every 60s
const RECENT_MESSAGES_WINDOW_MS = 15 * 60 * 1000;  // look at messages from last 15 min
const HUMAN_ALERT_THRESHOLD_MS = 3 * 60 * 1000;    // 3 min waiting for operator
const HUMAN_ALERT_COOLDOWN_MS = 60 * 60 * 1000;    // 1 h between repeat alerts per session

@Injectable()
export class LivechatInactivityService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(LivechatInactivityService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: DbService,
    private livechat: LivechatService,
    private ses: SesService,
    private settings: SettingsService,
    private inbound: LivechatInboundService,
    private stream: LivechatStreamService,
    private push: PushService,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.sweep(); void this.sweepNeedsHuman(); }, SCAN_INTERVAL_MS);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(): Promise<void> {
    const now = new Date();
    const inactiveThreshold = new Date(now.getTime() - INACTIVITY_THRESHOLD_MS);
    const resendCutoff = new Date(now.getTime() - RESEND_COOLDOWN_MS);
    const messageWindow = new Date(now.getTime() - RECENT_MESSAGES_WINDOW_MS);

    // Find open sessions where: visitor has email, visitor gone 3+ min, no email recently sent,
    // AND there's a recent agent/bot message the visitor may have missed.
    const rows = await this.db.db.execute(sql`
      SELECT s.id, s.visitor_email, s.visitor_name
      FROM livechat_sessions s
      WHERE s.status = 'open'
        AND s.visitor_email IS NOT NULL
        AND s.last_seen_at < ${inactiveThreshold.toISOString()}
        AND (s.inactivity_email_sent_at IS NULL OR s.inactivity_email_sent_at < ${resendCutoff.toISOString()})
        AND EXISTS (
          SELECT 1 FROM livechat_messages m
          WHERE m.session_id = s.id
            AND m.role IN ('agent', 'operator')
            AND m.created_at > ${messageWindow.toISOString()}
        )
      LIMIT 20
    `);

    const sessions = rows as unknown as Array<{ id: string; visitor_email: string; visitor_name: string | null }>;
    if (!sessions.length) return;

    this.logger.debug(`Inactivity sweep: ${sessions.length} candidate session(s)`);

    for (const session of sessions) {
      await this.sendInactivityEmail(session.id, session.visitor_email, session.visitor_name).catch((err) => {
        this.logger.warn(`Inactivity email failed for session ${session.id.slice(-8)}: ${(err as Error).message}`);
      });
    }
  }

  private async sendInactivityEmail(sessionId: string, visitorEmail: string, visitorName: string | null): Promise<void> {
    const detail = await this.livechat.getSessionDetail(sessionId);
    if (!detail) return;

    const site = await this.livechat.getSiteById(detail.session.siteId);
    const rawFrom = site.transcriptFrom?.trim() || await this.settings.getDecrypted('ses_from_address');
    if (!rawFrom) {
      this.logger.warn(`Inactivity email skipped for ${sessionId.slice(-8)}: no from address configured`);
      return;
    }

    const senderLabel = site.botName?.trim() || site.label?.trim() || 'Support';
    const fromAddress = rawFrom.includes('<') ? rawFrom : `"${senderLabel}" <${rawFrom}>`;
    const visitorLabel = visitorName?.trim() || visitorEmail.split('@')[0];
    const botName = site.botName?.trim() || site.label;

    // Get last 5 messages
    const recentMsgs = detail.messages.slice(-5);
    if (!recentMsgs.length) return;

    const replyTo = (await this.inbound.buildReplyTo(sessionId)) ?? undefined;

    const brandColor = site.brandColor || '#2563eb';
    const subject = `You have a message from ${botName}`;
    const textBody = this.buildText({ visitorLabel, botName, messages: recentMsgs });
    const htmlBody = this.buildHtml({ visitorLabel, botName, brandColor, messages: recentMsgs });

    await this.ses.sendEmail({ to: visitorEmail, from: fromAddress, subject, textBody, htmlBody, replyTo });

    await this.db.db
      .update(livechatSessions)
      .set({ inactivityEmailSentAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));

    this.logger.log(`Inactivity email sent → ${visitorEmail} for session ${sessionId.slice(-8)} | replyTo: ${replyTo ?? 'none'}`);
  }

  async sweepNeedsHuman(): Promise<void> {
    const now = new Date();
    const alertThreshold = new Date(now.getTime() - HUMAN_ALERT_THRESHOLD_MS);
    const cooldownCutoff = new Date(now.getTime() - HUMAN_ALERT_COOLDOWN_MS);

    const rows = await this.db.db.execute(sql`
      SELECT s.id, s.site_id, s.visitor_name, s.visitor_email, s.needs_human_at
      FROM livechat_sessions s
      WHERE s.status = 'needs_human'
        AND s.needs_human_at IS NOT NULL
        AND s.needs_human_at < ${alertThreshold.toISOString()}
        AND (s.human_alert_sent_at IS NULL OR s.human_alert_sent_at < ${cooldownCutoff.toISOString()})
      LIMIT 20
    `);

    const sessions = rows as unknown as Array<{ id: string; site_id: string; visitor_name: string | null; visitor_email: string | null; needs_human_at: string }>;
    if (!sessions.length) return;

    this.logger.debug(`Human alert sweep: ${sessions.length} session(s) waiting for operator`);

    for (const session of sessions) {
      await this.sendHumanAlertEmail(session.id, session.site_id, session.visitor_name, session.visitor_email).catch((err) => {
        this.logger.warn(`Human alert email failed for session ${session.id.slice(-8)}: ${(err as Error).message}`);
      });
    }
  }

  private async sendHumanAlertEmail(sessionId: string, siteId: string, visitorName: string | null, visitorEmail: string | null): Promise<void> {
    const site = await this.livechat.getSiteById(siteId);

    const adminTo = site.humanAlertEmail?.trim()
      || await this.settings.getDecrypted('livechat_alert_email')
      || await this.settings.getDecrypted('ses_from_address');
    if (!adminTo) {
      this.logger.warn(`Human alert skipped for ${sessionId.slice(-8)}: no admin email configured`);
      return;
    }
    const toAddress = adminTo.includes('<') ? adminTo : adminTo;

    const rawFrom = site.transcriptFrom?.trim() || await this.settings.getDecrypted('ses_from_address');
    if (!rawFrom) {
      this.logger.warn(`Human alert skipped for ${sessionId.slice(-8)}: no from address`);
      return;
    }
    const senderLabel = site.botName?.trim() || site.label?.trim() || 'Live Chat';
    const fromAddress = rawFrom.includes('<') ? rawFrom : `"${senderLabel}" <${rawFrom}>`;

    const visitorLabel = visitorName?.trim() || visitorEmail || 'A visitor';
    const siteName = site.label?.trim() || site.key;
    const brandColor = site.brandColor || '#2563eb';

    const adminSubject = `Action needed: chat waiting for human reply — ${siteName}`;
    const adminText = [
      `${visitorLabel} is waiting for a human agent in the ${siteName} live chat.`,
      '',
      'No operator has joined in the last 3 minutes.',
      '',
      'Please open the live chat dashboard and join the session.',
    ].join('\n');
    const adminHtml = this.buildHumanAlertHtml({ visitorLabel, siteName, brandColor });

    await this.ses.sendEmail({ to: toAddress, from: fromAddress, subject: adminSubject, textBody: adminText, htmlBody: adminHtml });
    this.logger.log(`Human alert email sent → ${toAddress} for session ${sessionId.slice(-8)}`);

    void this.push.sendToAll({
      title: `Chat waiting — ${siteName}`,
      body: `${visitorLabel} has been waiting for a human agent.`,
      url: '/livechat',
    }).catch((err) => this.logger.warn(`Push notification failed for session ${sessionId.slice(-8)}: ${(err as Error).message}`));

    if (visitorEmail) {
      const replyTo = (await this.inbound.buildReplyTo(sessionId)) ?? undefined;
      const visitorSubject = `We received your request — a human will be with you shortly`;
      const visitorText = [
        `Hi ${visitorLabel},`,
        '',
        `Thanks for reaching out to ${siteName}. We received your request for human assistance.`,
        '',
        'Our team has been notified and someone will join your chat shortly.',
        '',
        'You can reply to this email and your message will be added to the conversation.',
      ].join('\n');
      const visitorHtml = this.buildVisitorHumanAlertHtml({ visitorLabel, siteName, brandColor });
      await this.ses.sendEmail({ to: visitorEmail, from: fromAddress, subject: visitorSubject, textBody: visitorText, htmlBody: visitorHtml, replyTo })
        .catch((err) => this.logger.warn(`Visitor human alert email failed for session ${sessionId.slice(-8)}: ${(err as Error).message}`));
      this.logger.log(`Visitor human alert email sent → ${visitorEmail} for session ${sessionId.slice(-8)}`);
    }

    await this.db.db
      .update(livechatSessions)
      .set({ humanAlertSentAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));

    const apologyText = `Sorry for the wait — our team has been notified and a human agent will join shortly. Please bear with us.`;
    const apologyMsg = await this.livechat.appendMessage({ sessionId, role: 'agent', content: apologyText }).catch(() => null);
    if (apologyMsg) {
      this.stream.publish(sessionId, {
        type: 'message',
        sessionId,
        role: 'agent',
        content: apologyText,
        messageId: apologyMsg.id,
        createdAt: apologyMsg.createdAt.toISOString(),
      });
      this.logger.log(`Apology message injected for session ${sessionId.slice(-8)}`);
    }
  }

  private buildHumanAlertHtml(input: { visitorLabel: string; siteName: string; brandColor: string }): string {
    const label = input.visitorLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const site = input.siteName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
  <tr><td style="padding:18px 22px;background:${input.brandColor};color:#fff;">
    <div style="font-size:16px;font-weight:600;">Chat needs human assistance</div>
    <div style="font-size:12px;opacity:.85;margin-top:2px;">${site}</div>
  </td></tr>
  <tr><td style="padding:18px 22px;font-size:14px;color:#1f2937;line-height:1.6;">
    <strong>${label}</strong> is waiting for a human agent and no one has joined in the last 3 minutes.
    <br><br>
    Please open the live chat dashboard and join the session.
  </td></tr>
</table></body></html>`;
  }

  private buildVisitorHumanAlertHtml(input: { visitorLabel: string; siteName: string; brandColor: string }): string {
    const label = input.visitorLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const site = input.siteName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
  <tr><td style="padding:18px 22px;background:${input.brandColor};color:#fff;">
    <div style="font-size:16px;font-weight:600;">We received your request</div>
    <div style="font-size:12px;opacity:.85;margin-top:2px;">${site}</div>
  </td></tr>
  <tr><td style="padding:18px 22px;font-size:14px;color:#1f2937;line-height:1.6;">
    Hi <strong>${label}</strong>,<br><br>
    Thanks for reaching out. We received your request for human assistance and our team has been notified.<br><br>
    Someone will join your chat shortly. You can also reply to this email and your message will be added to the conversation.
  </td></tr>
</table></body></html>`;
  }

  private buildText(input: { visitorLabel: string; botName: string; messages: { role: string; content: string; createdAt: Date }[] }): string {
    const lines = [`Hi ${input.visitorLabel},`, '', `You have unread messages from ${input.botName}:`, ''];
    for (const m of input.messages) {
      const speaker = m.role === 'visitor' ? input.visitorLabel : m.role === 'operator' ? 'Support' : input.botName;
      lines.push(`${speaker}: ${m.content}`);
    }
    lines.push('', 'Reply to this email to continue the conversation.');
    return lines.join('\n');
  }

  private buildHtml(input: { visitorLabel: string; botName: string; brandColor: string; messages: { role: string; content: string; createdAt: Date }[] }): string {
    const rows = input.messages.map((m) => {
      const isVisitor = m.role === 'visitor';
      const speaker = isVisitor ? input.visitorLabel : m.role === 'operator' ? 'Support' : input.botName;
      const bg = isVisitor ? '#f3f4f6' : input.brandColor;
      const fg = isVisitor ? '#1f2937' : '#ffffff';
      const text = m.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<tr><td align="${isVisitor ? 'left' : 'right'}" style="padding:4px 0;">
  <div style="display:inline-block;max-width:80%;">
    <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${speaker.replace(/&/g, '&amp;')}</div>
    <div style="display:inline-block;padding:8px 12px;background:${bg};color:${fg};border-radius:12px;font-size:14px;line-height:1.4;">${text}</div>
  </div>
</td></tr>`;
    }).join('');

    return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">
  <tr><td style="padding:18px 22px;background:${input.brandColor};color:#fff;">
    <div style="font-size:16px;font-weight:600;">You have unread messages</div>
    <div style="font-size:12px;opacity:.85;margin-top:2px;">From ${input.botName}</div>
  </td></tr>
  <tr><td style="padding:14px 22px;"><table cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr>
  <tr><td style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">
    Reply to this email to continue your conversation — your reply will be added to the chat automatically.
  </td></tr>
</table></body></html>`;
  }
}
