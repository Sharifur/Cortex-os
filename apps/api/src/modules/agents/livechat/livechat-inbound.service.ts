import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { SettingsService } from '../../settings/settings.service';
import { LivechatService } from './livechat.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatAgent } from './agent';

export interface InboundReplyResult {
  ok: boolean;
  reason?: string;
  sessionId?: string;
  messageId?: string;
}

@Injectable()
export class LivechatInboundService {
  private readonly logger = new Logger(LivechatInboundService.name);

  constructor(
    private settings: SettingsService,
    private livechat: LivechatService,
    private stream: LivechatStreamService,
    private agent: LivechatAgent,
  ) {}

  /** Build the Reply-To address for a transcript email. */
  async buildReplyTo(sessionId: string): Promise<string | null> {
    const [domain, secret] = await Promise.all([
      this.settings.getDecrypted('livechat_reply_domain'),
      this.settings.getDecrypted('livechat_reply_secret'),
    ]);
    if (!domain || !secret) return null;
    const token = this.signSessionId(sessionId, secret);
    return `transcript+${sessionId}.${token}@${domain.replace(/^@/, '')}`;
  }

  /** Build a Message-ID header value for a transcript email. */
  async buildMessageId(sessionId: string): Promise<string | null> {
    const domain = await this.settings.getDecrypted('livechat_reply_domain');
    if (!domain) return null;
    return `<lc-${sessionId}@${domain}>`;
  }

  /**
   * Process an inbound email (already parsed into recipient + sender + body).
   * Returns a structured result; never throws on "soft" misses so the webhook
   * can return 200 to SNS even when the email is rejected.
   */
  async handleInbound(input: {
    recipient: string;
    sender: string;
    subject: string;
    textBody: string;
    htmlBody?: string;
    inReplyTo?: string;
  }): Promise<InboundReplyResult> {
    const secret = await this.settings.getDecrypted('livechat_reply_secret');
    if (!secret) return { ok: false, reason: 'reply_secret_not_configured' };

    // Try to extract session ID + token from the To address (preferred).
    // Format: transcript+{sessionId}.{token}@<reply-domain>
    let sessionId: string | null = null;
    let token: string | null = null;

    const localPart = (input.recipient.split('@')[0] ?? '').toLowerCase();
    const m = /^transcript\+([a-z0-9]+)\.([a-f0-9]+)$/.exec(localPart);
    if (m) {
      sessionId = m[1];
      token = m[2];
    } else if (input.inReplyTo) {
      // Fallback: match In-Reply-To against our Message-ID format.
      const mm = /^<?lc-([a-z0-9]+)@/.exec(input.inReplyTo.trim());
      if (mm) sessionId = mm[1];
    }

    if (!sessionId) return { ok: false, reason: 'no_session_in_recipient_or_in_reply_to' };

    if (token) {
      const expected = this.signSessionId(sessionId, secret);
      if (!this.constantTimeCompare(token, expected)) {
        return { ok: false, reason: 'token_invalid' };
      }
    }

    const session = await this.livechat.getSession(sessionId);
    if (!session) return { ok: false, reason: 'session_not_found' };

    // Anti-spoof: sender must match the session's visitor email.
    const senderEmail = this.extractAddress(input.sender);
    if (!senderEmail) return { ok: false, reason: 'no_sender' };
    const sessionEmail = (session.visitorEmail ?? '').trim().toLowerCase();
    if (!sessionEmail) return { ok: false, reason: 'session_has_no_email' };
    if (senderEmail.toLowerCase() !== sessionEmail) {
      this.logger.warn(`Inbound reply sender mismatch: ${senderEmail} vs session ${sessionEmail}`);
      return { ok: false, reason: 'sender_mismatch' };
    }

    const cleaned = this.stripQuotedReply(input.textBody);
    if (!cleaned.trim()) return { ok: false, reason: 'empty_after_strip' };

    // Reopen if closed.
    if (session.status === 'closed') {
      await this.livechat.setSessionStatus(sessionId, 'open');
      this.stream.publish(sessionId, { type: 'session_status', sessionId, status: 'open' });
    }

    // Insert as visitor message + dedupe (handles SNS at-least-once delivery).
    const visitorMsg = await this.livechat.appendMessage({
      sessionId,
      role: 'visitor',
      content: cleaned,
    });
    if (visitorMsg.duplicate) {
      return { ok: true, reason: 'deduped', sessionId, messageId: visitorMsg.id };
    }

    this.stream.publish(sessionId, {
      type: 'message',
      sessionId,
      role: 'visitor',
      content: cleaned,
      messageId: visitorMsg.id,
      createdAt: visitorMsg.createdAt.toISOString(),
    });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId });

    // Run the agent on this turn (same as a fresh visitor message).
    void this.agent.handleVisitorMessage({ sessionId, visitorMessage: cleaned }).catch((err) => {
      this.logger.warn(`agent run failed on inbound for ${sessionId}: ${(err as Error).message}`);
    });

    return { ok: true, reason: 'accepted', sessionId, messageId: visitorMsg.id };
  }

  /** HMAC-SHA256(sessionId, secret) → first 16 hex chars. Short enough for an email local part. */
  private signSessionId(sessionId: string, secret: string): string {
    return createHmac('sha256', secret).update(sessionId).digest('hex').slice(0, 16);
  }

  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    } catch {
      return false;
    }
  }

  /** Pull the bare "user@host" out of "Name <user@host>" or just "user@host". */
  private extractAddress(raw: string): string | null {
    const angle = /<([^>]+@[^>]+)>/.exec(raw);
    if (angle) return angle[1].trim();
    const m = /[^\s,]+@[^\s,]+/.exec(raw);
    return m ? m[0].trim() : null;
  }

  /**
   * Strip quoted reply blocks + common signature delimiters. Heuristic; covers
   * Gmail / Outlook / Apple Mail / "Sent from my iPhone" / GMail mobile.
   */
  private stripQuotedReply(text: string): string {
    if (!text) return '';
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    for (const raw of lines) {
      const line = raw.trimEnd();
      // Common quote markers — once we hit one, drop everything after.
      if (/^On .{1,200}wrote:\s*$/i.test(line)) break;
      if (/^From:\s.+(\sSent:|\sTo:|@.+>)/i.test(line)) break;
      if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
      if (/^_{2,}$/.test(line)) break; // Outlook divider
      if (/^Sent from (my )?(iPhone|iPad|Android|mobile|Outlook|Mail)/i.test(line)) break;
      // Gmail-style "—— Forwarded message ——"
      if (/^[-—]{2,}\s*Forwarded message/i.test(line)) break;
      // Strip lines starting with > (quoted lines), but keep collecting non-quoted lines that follow.
      if (/^>+\s?/.test(line)) continue;
      out.push(line);
    }
    return out.join('\n').trim();
  }
}
