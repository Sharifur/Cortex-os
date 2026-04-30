import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../../db/db.service';
import { livechatSessions } from './schema';
import { LivechatService } from './livechat.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { SesService } from '../../ses/ses.service';
import { SettingsService } from '../../settings/settings.service';
import { LivechatInboundService } from './livechat-inbound.service';

export interface SendTranscriptResult {
  ok: boolean;
  reason?: 'no_visitor_email' | 'site_disabled' | 'no_messages' | 'sent';
  messageId?: string;
  to?: string;
}

@Injectable()
export class LivechatTranscriptService {
  private readonly logger = new Logger(LivechatTranscriptService.name);

  constructor(
    private db: DbService,
    private livechat: LivechatService,
    private attachments: LivechatAttachmentsService,
    private ses: SesService,
    private settings: SettingsService,
    private inbound: LivechatInboundService,
  ) {}

  /**
   * Build + send the transcript email for a session. Returns a structured
   * result rather than throwing on "soft" misses (no email, opt-out) so the
   * close path can fire-and-forget without try/catching.
   */
  async send(sessionId: string, opts: { force?: boolean } = {}): Promise<SendTranscriptResult> {
    const detail = await this.livechat.getSessionDetail(sessionId);
    if (!detail) throw new NotFoundException(`Session not found: ${sessionId}`);

    const site = await this.livechat.getSiteById(detail.session.siteId);
    if (!site.transcriptEnabled && !opts.force) return { ok: false, reason: 'site_disabled' };

    const visitorEmail = (detail.session.visitorEmail ?? '').trim();
    if (!visitorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitorEmail)) {
      return { ok: false, reason: 'no_visitor_email' };
    }
    if (!detail.messages.length) return { ok: false, reason: 'no_messages' };

    const fromAddress = await this.resolveFromAddress(site.transcriptFrom);
    if (!fromAddress) {
      throw new BadRequestException('No transcript_from address configured (per-site or platform default)');
    }

    const attachmentsByMsg = await this.attachments.getForMessages(detail.messages.map((m) => m.id));
    const visitorLabel = detail.session.visitorName?.trim() || visitorEmail.split('@')[0];

    const text = this.buildText({ siteLabel: site.label, visitorLabel, messages: detail.messages, attachmentsByMsg });
    const html = this.buildHtml({ site, visitorLabel, messages: detail.messages, attachmentsByMsg, brandColor: site.brandColor || '#2563eb' });

    const bccList = (site.transcriptBcc ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

    // Reply-To threads visitor replies back into this session via SES inbound.
    const replyTo = (await this.inbound.buildReplyTo(sessionId)) ?? undefined;
    // Message-ID lets clients that don't use the To address still thread by
    // matching In-Reply-To against this header.
    // Note: the standard SES SDK doesn't expose Message-Id directly on
    // SendEmailCommand; we set it as a Reply-To-shaped fallback only.
    const messageId = await this.ses.sendEmail({
      to: visitorEmail,
      from: fromAddress,
      subject: `Transcript of your conversation with ${site.botName?.trim() || site.label}`,
      textBody: text,
      htmlBody: html,
      bcc: bccList.length ? bccList : undefined,
      replyTo,
    });

    await this.db.db
      .update(livechatSessions)
      .set({ transcriptSentAt: new Date() })
      .where(eq(livechatSessions.id, sessionId));

    return { ok: true, reason: 'sent', messageId, to: visitorEmail };
  }

  /** Fire-and-forget wrapper used by the close flow — never throws. */
  async maybeSendOnClose(sessionId: string): Promise<void> {
    this.send(sessionId)
      .then((res) => {
        if (res.ok) this.logger.log(`Transcript sent for ${sessionId.slice(-8)} → ${res.to}`);
        else this.logger.debug(`Transcript skipped for ${sessionId.slice(-8)}: ${res.reason}`);
      })
      .catch((err) => this.logger.warn(`Transcript send failed for ${sessionId.slice(-8)}: ${(err as Error).message}`));
  }

  private async resolveFromAddress(siteFrom: string | null): Promise<string | null> {
    if (siteFrom?.trim()) return siteFrom.trim();
    const platformFrom = await this.settings.getDecrypted('ses_default_from');
    if (platformFrom?.trim()) return platformFrom.trim();
    return null;
  }

  private buildText(input: {
    siteLabel: string;
    visitorLabel: string;
    messages: { role: string; content: string; createdAt: Date; id: string }[];
    attachmentsByMsg: Map<string, { originalFilename: string; url: string }[]>;
  }): string {
    const lines: string[] = [`Conversation transcript — ${input.siteLabel}`, ''];
    for (const m of input.messages) {
      const speaker = m.role === 'visitor' ? input.visitorLabel : m.role === 'operator' ? 'Support' : m.role === 'agent' ? 'Assistant' : 'System';
      const ts = new Date(m.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      lines.push(`[${ts}] ${speaker}:`);
      if (m.content) lines.push(m.content);
      const atts = input.attachmentsByMsg.get(m.id) ?? [];
      for (const a of atts) {
        lines.push(`  Attachment: ${a.originalFilename} — ${a.url}`);
      }
      lines.push('');
    }
    lines.push('— end of transcript —');
    return lines.join('\n');
  }

  private buildHtml(input: {
    site: { label: string; botName: string | null };
    visitorLabel: string;
    brandColor: string;
    messages: { role: string; content: string; createdAt: Date; id: string }[];
    attachmentsByMsg: Map<string, { originalFilename: string; mimeType: string; url: string }[]>;
  }): string {
    const bot = input.site.botName?.trim() || input.site.label;
    const rows = input.messages
      .map((m) => {
        const isVisitor = m.role === 'visitor';
        const speaker = isVisitor ? input.visitorLabel : m.role === 'operator' ? 'Support' : m.role === 'agent' ? bot : 'System';
        const ts = new Date(m.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        const text = m.content ? linkifyEscape(m.content) : '';
        const atts = input.attachmentsByMsg.get(m.id) ?? [];
        const attsHtml = atts
          .map((a) => {
            if (a.mimeType.startsWith('image/')) {
              return `<div style="margin-top:6px"><a href="${escapeAttr(a.url)}" target="_blank"><img src="${escapeAttr(a.url)}" alt="${escapeAttr(a.originalFilename)}" style="max-width:280px;max-height:200px;border-radius:8px;display:block;" /></a></div>`;
            }
            return `<div style="margin-top:6px"><a href="${escapeAttr(a.url)}" target="_blank" style="display:inline-block;padding:6px 10px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;color:#1f2937;text-decoration:none;font-size:13px;">📎 ${escapeHtml(a.originalFilename)}</a></div>`;
          })
          .join('');
        const align = isVisitor ? 'left' : 'right';
        const bg = isVisitor ? '#f3f4f6' : input.brandColor;
        const fg = isVisitor ? '#1f2937' : '#ffffff';
        return `
<tr><td align="${align}" style="padding:6px 0;">
  <div style="display:inline-block;max-width:78%;text-align:left;">
    <div style="font-size:11px;color:#6b7280;margin-bottom:2px;">${escapeHtml(speaker)} · ${escapeHtml(ts)}</div>
    ${text ? `<div style="display:inline-block;padding:8px 12px;background:${bg};color:${fg};border-radius:14px;font-size:14px;line-height:1.4;word-wrap:break-word;">${text}</div>` : ''}
    ${attsHtml}
  </div>
</td></tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Transcript</title></head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
  <tr><td style="padding:18px 22px;background:${input.brandColor};color:#ffffff;">
    <div style="font-size:16px;font-weight:600;">Transcript — ${escapeHtml(input.site.label)}</div>
    <div style="font-size:12px;opacity:0.85;margin-top:2px;">Conversation between ${escapeHtml(input.visitorLabel)} and ${escapeHtml(bot)}</div>
  </td></tr>
  <tr><td style="padding:14px 22px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
  </td></tr>
  <tr><td style="padding:14px 22px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:11px;">
    Reply to this email if you need anything else — we will pick it up in your conversation.
  </td></tr>
</table>
</body></html>`;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
function linkifyEscape(text: string): string {
  return escapeHtml(text).replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const m = url.match(/[.,;:!?)]+$/);
    const tail = m ? m[0] : '';
    const clean = tail ? url.slice(0, -tail.length) : url;
    return `<a href="${escapeAttr(clean)}" target="_blank" rel="noopener noreferrer" style="color:inherit;">${clean}</a>${tail}`;
  });
}
