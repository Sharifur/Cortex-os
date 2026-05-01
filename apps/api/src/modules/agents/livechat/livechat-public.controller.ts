import { Controller, Post, Get, Body, Query, Req, BadRequestException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { LivechatService } from './livechat.service';
import { EnrichmentService } from '../../../common/visitor-enrichment/enrichment.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatAgent } from './agent';
import { LivechatRateLimitService } from './livechat-rate-limit.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { PushService } from '../../push/push.service';

interface PageviewBody {
  siteKey: string;
  visitorId: string;
  url: string;
  path?: string;
  title?: string;
  referrer?: string;
  language?: string;
}

interface LeaveBody {
  siteKey: string;
  visitorId: string;
  pageviewId: string;
}

interface HeartbeatBody {
  siteKey: string;
  visitorId: string;
  url?: string;
  title?: string;
}

interface IdentifyBody {
  siteKey: string;
  visitorId: string;
  email?: string | null;
  name?: string | null;
}

interface MessageBody {
  siteKey: string;
  visitorId: string;
  content: string;
  attachmentIds?: string[];
  /** Anti-bot signals — silently fail the request when triggered. */
  meta?: {
    /** Honeypot field. Real widget keeps this empty; bots auto-fill. */
    hp?: string;
    /** ms since panel was first shown. Bots blast under 800. */
    elapsedMs?: number;
    /** Did the textarea ever fire an input/keydown? Bots set value via JS. */
    hadInteraction?: boolean;
  };
}

function detectBot(meta: MessageBody['meta'], isFirstMessage: boolean): string | null {
  if (!meta) return null;
  if (meta.hp && meta.hp.length > 0) return 'honeypot_filled';
  if (meta.hadInteraction === false) return 'no_keystrokes';
  if (isFirstMessage && typeof meta.elapsedMs === 'number' && meta.elapsedMs < 800) return 'too_fast';
  return null;
}

interface WidgetConfigResponse {
  siteKey: string;
  botName: string;
  botSubtitle: string;
  welcomeMessage: string | null;
  welcomeQuickReplies: string[];
  brandColor: string;
  position: 'bottom-right' | 'bottom-left';
}

@Controller('livechat')
export class LivechatPublicController {
  constructor(
    private livechat: LivechatService,
    private enrichment: EnrichmentService,
    private stream: LivechatStreamService,
    private agent: LivechatAgent,
    private rateLimit: LivechatRateLimitService,
    private attachments: LivechatAttachmentsService,
    private push: PushService,
  ) {}

  @Get('config')
  async config(@Req() req: FastifyRequest, @Query('siteKey') siteKey?: string): Promise<WidgetConfigResponse> {
    if (!siteKey) throw new BadRequestException('siteKey query param is required');
    const origin = req.headers.origin as string | undefined;
    const site = await this.livechat.resolveSiteForRequest(siteKey, origin ?? null);
    return {
      siteKey: site.key,
      botName: site.botName?.trim() || site.label,
      botSubtitle: site.botSubtitle?.trim() || 'We typically reply in a few seconds.',
      welcomeMessage: site.welcomeMessage,
      welcomeQuickReplies: site.welcomeQuickReplies,
      brandColor: site.brandColor || '#2563eb',
      position: site.position,
    };
  }

  @Post('track/pageview')
  async pageview(@Req() req: FastifyRequest, @Body() body: PageviewBody) {
    if (!body?.siteKey || !body?.visitorId || !body?.url) {
      throw new BadRequestException('siteKey, visitorId and url are required');
    }
    const origin = req.headers.origin as string | undefined;
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin ?? null);
    await this.rateLimit.check('pageview', `${site.key}:${body.visitorId}`, 60);

    const enriched = this.enrichment.enrich(
      req.ip,
      req.headers['user-agent'] as string | undefined,
      body.language ?? (req.headers['accept-language'] as string | undefined),
    );

    if (!site.trackBots && enriched.deviceType === 'bot') {
      return { ok: true, skipped: 'bot' };
    }

    const visitorPk = await this.livechat.upsertVisitor({
      siteId: site.id,
      visitorId: body.visitorId,
      enrichment: enriched,
    });

    const { pageviewId } = await this.livechat.recordPageview({
      siteId: site.id,
      visitorPk,
      visitorId: body.visitorId,
      sessionId: null,
      url: body.url,
      path: body.path ?? this.pathFromUrl(body.url),
      title: body.title ?? null,
      referrer: body.referrer ?? null,
    });

    this.stream.publishToOperators({ type: 'visitor_activity', visitorPk, siteKey: site.key });

    return { ok: true, pageviewId, visitorPk };
  }

  @Post('track/heartbeat')
  async heartbeat(@Req() req: FastifyRequest, @Body() body: HeartbeatBody) {
    if (!body?.siteKey || !body?.visitorId) {
      throw new BadRequestException('siteKey and visitorId are required');
    }
    const origin = req.headers.origin as string | undefined;
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin ?? null);
    await this.rateLimit.check('heartbeat', `${site.key}:${body.visitorId}`, 120);
    await this.livechat.heartbeatVisitor({
      siteId: site.id,
      visitorId: body.visitorId,
      currentUrl: body.url ?? null,
      currentTitle: body.title ?? null,
    });
    // Look up visitor PK so the operator UI can index by id.
    const [visitor] = (await this.livechat.listLiveVisitors(120)).filter(
      (v) => v.siteId === site.id && v.visitorId === body.visitorId,
    );
    if (visitor) {
      this.stream.publishToOperators({ type: 'visitor_activity', visitorPk: visitor.visitorPk, siteKey: site.key });
    }
    return { ok: true };
  }

  @Post('track/leave')
  async leave(@Req() req: FastifyRequest, @Body() body: LeaveBody) {
    if (!body?.pageviewId) throw new BadRequestException('pageviewId is required');
    const origin = req.headers.origin as string | undefined;
    if (body.siteKey) await this.livechat.resolveSiteForRequest(body.siteKey, origin ?? null);
    await this.livechat.recordPageviewLeave(body.pageviewId);
    return { ok: true };
  }

  @Post('identify')
  async identify(@Req() req: FastifyRequest, @Body() body: IdentifyBody) {
    if (!body?.siteKey || !body?.visitorId) {
      throw new BadRequestException('siteKey and visitorId are required');
    }
    const origin = req.headers.origin as string | undefined;
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin ?? null);
    await this.livechat.setVisitorIdentity({
      siteId: site.id,
      siteKey: site.key,
      visitorId: body.visitorId,
      email: body.email ?? undefined,
      name: body.name ?? undefined,
    });
    return { ok: true };
  }

  @Post('message')
  async message(@Req() req: FastifyRequest, @Body() body: MessageBody) {
    const hasAttachments = Array.isArray(body?.attachmentIds) && body.attachmentIds.length > 0;
    if (!body?.siteKey || !body?.visitorId || (!body?.content?.trim() && !hasAttachments)) {
      throw new BadRequestException('siteKey, visitorId and content (or attachments) are required');
    }
    const origin = req.headers.origin as string | undefined;
    const site = await this.livechat.resolveSiteForRequest(body.siteKey, origin ?? null);
    await this.rateLimit.check('message', `${site.key}:${body.visitorId}`, 30);

    const enriched = this.enrichment.enrich(
      req.ip,
      req.headers['user-agent'] as string | undefined,
      req.headers['accept-language'] as string | undefined,
    );

    const visitorPk = await this.livechat.upsertVisitor({
      siteId: site.id,
      visitorId: body.visitorId,
      enrichment: enriched,
    });

    const { sessionId } = await this.livechat.getOrCreateSession({
      siteId: site.id,
      siteKey: site.key,
      visitorPk,
      visitorId: body.visitorId,
    });

    const visitorContent = (body.content ?? '').trim();

    // Bot heuristics — silent. Real users always pass; we don't error so
    // the attacker can't tell their messages aren't getting through.
    const sessionDetail = await this.livechat.getSession(sessionId).catch(() => null);
    const messageCount = sessionDetail
      ? await this.livechat.getRecentMessages(sessionId, 1).then((rs) => rs.length).catch(() => 0)
      : 0;
    const isFirstMessage = messageCount === 0;
    const botReason = detectBot(body.meta, isFirstMessage);
    if (botReason) {
      // Pretend it succeeded — return the same shape as a deduped send.
      return {
        ok: true,
        sessionId,
        deduped: true,
        visitor: { id: 'silenced', createdAt: new Date() },
        agent: { skipped: 'silenced' },
      };
    }

    const visitorMsg = await this.livechat.appendMessage({
      sessionId,
      role: 'visitor',
      content: visitorContent,
    });

    // Dedupe — appendMessage flagged this as an exact recent duplicate.
    // Don't re-publish, don't re-run the agent, don't re-link attachments.
    if (visitorMsg.duplicate) {
      return {
        ok: true,
        sessionId,
        deduped: true,
        visitor: { id: visitorMsg.id, createdAt: visitorMsg.createdAt },
        agent: { skipped: 'deduped' },
      };
    }

    let attachments: Awaited<ReturnType<LivechatAttachmentsService['getById']>>[] = [];
    if (hasAttachments) {
      await this.attachments.linkToMessage(body.attachmentIds!, visitorMsg.id, sessionId);
      attachments = await Promise.all(body.attachmentIds!.map((id) => this.attachments.getById(id)));
    }

    this.stream.publish(sessionId, {
      type: 'message',
      sessionId,
      role: 'visitor',
      content: visitorContent,
      messageId: visitorMsg.id,
      createdAt: visitorMsg.createdAt.toISOString(),
      attachments: attachments.map(toAttachmentSummary),
    });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId });

    // If the visitor only sent attachments without text, skip the LLM run.
    const result = visitorContent
      ? await this.agent.handleVisitorMessage({ sessionId, visitorMessage: visitorContent })
      : { ok: true, status: 'skipped_taken_over' as const };

    // Push notification: fire to subscribed operators when the session needs
    // human attention — moderation queue, fallback, or a session that's
    // already taken over by a human.
    const pushable =
      result.status === 'pending_approval' ||
      result.status === 'fallback_needs_human' ||
      result.status === 'skipped_taken_over' ||
      result.status === 'skipped_needs_human';
    if (pushable) {
      const visitorLabel = visitorMsg.id; // placeholder; we send a friendlier label below
      const session = await this.livechat.getSession(sessionId).catch(() => null);
      const name = session?.visitorName?.trim() || session?.visitorEmail || `visitor${body.visitorId.slice(-5)}`;
      const reasonLabel =
        result.status === 'pending_approval' ? 'needs your review' :
        result.status === 'fallback_needs_human' ? 'needs a human' :
        result.status === 'skipped_taken_over' ? 'replied to your conversation' :
        'is waiting for a human';
      void this.push.sendToAll({
        title: `${name} ${reasonLabel}`,
        body: visitorContent.slice(0, 140) || '(attachment)',
        tag: `lc-${sessionId}`,
        url: `/livechat?session=${sessionId}`,
        renotify: true,
      }).catch(() => undefined);
      void visitorLabel; // unused
    }

    return {
      ok: true,
      sessionId,
      visitor: { id: visitorMsg.id, createdAt: visitorMsg.createdAt, attachments: attachments.map(toAttachmentSummary) },
      agent:
        'reply' in result && result.reply
          ? { id: result.agentMessageId, content: result.reply, status: result.status }
          : { skipped: result.status },
    };
  }

  private pathFromUrl(url: string): string | null {
    try {
      return new URL(url).pathname;
    } catch {
      return null;
    }
  }
}

function toAttachmentSummary(a: { id: string; mimeType: string; sizeBytes: number; originalFilename: string; url: string }) {
  return {
    id: a.id,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    originalFilename: a.originalFilename,
    url: a.url,
  };
}
