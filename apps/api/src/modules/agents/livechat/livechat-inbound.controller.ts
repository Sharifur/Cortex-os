import { Body, Controller, Headers, HttpCode, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { safeEqualString } from '../../../common/webhooks/verify';
import { LivechatInboundService } from './livechat-inbound.service';

interface SnsEnvelope {
  Type: string;
  SubscribeURL?: string;
  Message: string;
}

interface SesInboundNotification {
  mail?: {
    commonHeaders?: { from?: string[]; to?: string[]; subject?: string; messageId?: string };
    destination?: string[];
    source?: string;
  };
  /** Inline raw RFC 822 content (when "Include original headers" is enabled on the SES action). */
  content?: string;
}

/**
 * SES inbound mail receiver, mounted at /livechat/inbound to keep all live
 * chat surface area in one module (avoids a SesModule ↔ LivechatModule cycle).
 *
 * AWS setup: SES Receipt Rule → SNS topic → HTTPS subscription pointing at
 * https://api.<your-domain>/livechat/inbound?t=<livechat_inbound_token>.
 */
@Controller('livechat')
export class LivechatInboundController {
  private readonly logger = new Logger(LivechatInboundController.name);

  constructor(
    private settings: SettingsService,
    private livechatInbound: LivechatInboundService,
  ) {}

  @Post('inbound')
  @HttpCode(200)
  async handle(
    @Body() body: SnsEnvelope,
    @Headers('x-amz-sns-message-type') messageType: string,
    @Query('t') tokenInUrl?: string,
  ) {
    const expected = await this.settings.getDecrypted('livechat_inbound_token');
    if (!expected) throw new UnauthorizedException('Inbound webhook token not configured');
    if (!tokenInUrl || !safeEqualString(tokenInUrl, expected)) {
      throw new UnauthorizedException('Invalid inbound token');
    }

    // SNS subscription handshake — auto-confirm but only for AWS-issued URLs.
    if (messageType === 'SubscriptionConfirmation' && body.SubscribeURL) {
      try {
        const u = new URL(body.SubscribeURL);
        if (!/^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname) || u.protocol !== 'https:') {
          this.logger.warn(`Refusing SubscribeURL host: ${u.hostname}`);
          return;
        }
      } catch {
        return;
      }
      await fetch(body.SubscribeURL);
      this.logger.log('SNS livechat-inbound subscription confirmed');
      return;
    }
    if (messageType !== 'Notification') return;

    let parsed: SesInboundNotification;
    try {
      parsed = JSON.parse(body.Message);
    } catch {
      this.logger.warn('Failed to parse inbound SNS Message body');
      return;
    }

    const headers = parsed.mail?.commonHeaders ?? {};
    const recipient = (headers.to ?? parsed.mail?.destination ?? [])[0];
    const sender = (headers.from ?? [])[0] ?? parsed.mail?.source ?? '';
    const subject = headers.subject ?? '';
    if (!recipient) {
      this.logger.warn('Inbound notification missing recipient');
      return;
    }

    const { text, html, inReplyTo } = parseRawMime(parsed.content ?? '');

    const result = await this.livechatInbound.handleInbound({
      recipient,
      sender,
      subject,
      textBody: text,
      htmlBody: html,
      inReplyTo,
    });

    if (!result.ok) {
      this.logger.debug(`Inbound rejected: ${result.reason}`);
    } else {
      this.logger.log(`Inbound accepted for session ${result.sessionId?.slice(-8)} (${result.reason})`);
    }
  }
}

function parseRawMime(raw: string): { text: string; html: string; inReplyTo?: string } {
  if (!raw) return { text: '', html: '' };
  const headerEnd = raw.indexOf('\r\n\r\n');
  const split = headerEnd >= 0 ? headerEnd : raw.indexOf('\n\n');
  if (split < 0) return { text: raw, html: '' };
  const headerBlock = raw.slice(0, split);
  const body = raw.slice(split + (headerEnd >= 0 ? 4 : 2));

  const headerMap = parseHeaders(headerBlock);
  const inReplyTo = headerMap.get('in-reply-to');
  const contentType = headerMap.get('content-type') ?? 'text/plain';

  const boundaryMatch = /boundary="?([^";\r\n]+)"?/i.exec(contentType);
  if (!boundaryMatch) {
    if (/text\/html/i.test(contentType)) return { text: stripHtml(body), html: body, inReplyTo };
    return { text: body, html: '', inReplyTo };
  }

  const boundary = boundaryMatch[1];
  const parts = body.split(`--${boundary}`).slice(1, -1).map((p) => p.replace(/^\r?\n/, ''));

  let text = '';
  let html = '';
  for (const part of parts) {
    const partSplit = part.indexOf('\r\n\r\n');
    const partHeaderEnd = partSplit >= 0 ? partSplit : part.indexOf('\n\n');
    if (partHeaderEnd < 0) continue;
    const partHeader = parseHeaders(part.slice(0, partHeaderEnd));
    const partBody = part.slice(partHeaderEnd + (partSplit >= 0 ? 4 : 2)).trimEnd();
    const ct = partHeader.get('content-type') ?? '';
    const cte = partHeader.get('content-transfer-encoding') ?? '';
    const decoded = decodePart(partBody, cte);
    if (/text\/plain/i.test(ct)) text = text || decoded;
    else if (/text\/html/i.test(ct)) html = html || decoded;
  }
  if (!text && html) text = stripHtml(html);
  return { text, html, inReplyTo };
}

function parseHeaders(block: string): Map<string, string> {
  const out = new Map<string, string>();
  let lastKey: string | null = null;
  for (const rawLine of block.split(/\r?\n/)) {
    if (/^\s/.test(rawLine) && lastKey) {
      out.set(lastKey, (out.get(lastKey) ?? '') + ' ' + rawLine.trim());
      continue;
    }
    const idx = rawLine.indexOf(':');
    if (idx <= 0) continue;
    const key = rawLine.slice(0, idx).toLowerCase().trim();
    const value = rawLine.slice(idx + 1).trim();
    out.set(key, value);
    lastKey = key;
  }
  return out;
}

function decodePart(body: string, cte: string): string {
  const enc = cte.toLowerCase();
  if (enc === 'base64') {
    try {
      return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
    } catch {
      return body;
    }
  }
  if (enc === 'quoted-printable') {
    return body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return body;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
