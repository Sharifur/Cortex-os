import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatSessions } from './schema';
import { eq } from 'drizzle-orm';
import { LivechatService } from './livechat.service';
import { SesService } from '../../ses/ses.service';
import { SettingsService } from '../../settings/settings.service';
import { LivechatInboundService } from './livechat-inbound.service';

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000;   // 3 min visitor absence
const RESEND_COOLDOWN_MS = 30 * 60 * 1000;        // 30 min between emails per session
const SCAN_INTERVAL_MS = 60 * 1000;               // scan every 60s
const RECENT_MESSAGES_WINDOW_MS = 15 * 60 * 1000; // look at messages from last 15 min

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
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.sweep(); }, SCAN_INTERVAL_MS);
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
    const rawFrom = site.transcriptFrom?.trim() || await this.settings.getDecrypted('ses_default_from');
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
