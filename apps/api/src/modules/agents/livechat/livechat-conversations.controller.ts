import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LivechatService, LivechatOperatorRow } from './livechat.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { LivechatTranscriptService } from './livechat-transcript.service';
import { EnrichmentService } from '../../../common/visitor-enrichment/enrichment.service';
import { GeoIpService } from '../../../common/visitor-enrichment/geoip.service';
import { LivechatRateLimitService } from './livechat-rate-limit.service';
import { SettingsService } from '../../settings/settings.service';
import { SelfImprovementService } from '../../knowledge-base/self-improvement.service';
import { LlmRouterService } from '../../llm/llm-router.service';

@Controller('agents/livechat')
@UseGuards(JwtAuthGuard)
export class LivechatConversationsController {
  constructor(
    private livechat: LivechatService,
    private stream: LivechatStreamService,
    private attachments: LivechatAttachmentsService,
    private transcript: LivechatTranscriptService,
    private enrichment: EnrichmentService,
    private geoIp: GeoIpService,
    private settings: SettingsService,
    private rateLimit: LivechatRateLimitService,
    private selfImprovement: SelfImprovementService,
    private llm: LlmRouterService,
  ) {}

  @Get('operators')
  listOperators() {
    return this.livechat.listOperators();
  }

  @Post('operators')
  createOperator(@Body() body: { name: string; avatarUrl?: string | null; isDefault?: boolean; siteKeys?: string[] | null }) {
    if (!body?.name?.trim()) throw new BadRequestException('name is required');
    return this.livechat.createOperator(body);
  }

  @Patch('operators/:id')
  updateOperator(
    @Param('id') id: string,
    @Body() body: { name?: string; avatarUrl?: string | null; isDefault?: boolean; siteKeys?: string[] | null },
  ) {
    return this.livechat.updateOperator(id, body);
  }

  @Delete('operators/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOperator(@Param('id') id: string) {
    return this.livechat.deleteOperator(id);
  }

  @Get('sessions')
  listSessions(
    @Query('status') status?: string,
    @Query('siteKey') siteKey?: string,
    @Query('hasPendingDrafts') hasPendingDrafts?: string,
    @Query('limit') limit?: string,
  ) {
    return this.livechat.listSessions({
      status,
      siteKey,
      hasPendingDrafts: hasPendingDrafts === 'true' || hasPendingDrafts === '1',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('sessions/pending-count')
  pendingCount() {
    return this.livechat.pendingCounts();
  }

  @Get('sessions/stats')
  sessionStats() {
    return this.livechat.sessionStats();
  }

  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const detail = await this.livechat.getSessionDetail(id);
    if (!detail) throw new NotFoundException(`Session not found: ${id}`);
    const messageIds = detail.messages.map((m) => m.id);
    const attachmentsByMsg = await this.attachments.getForMessages(messageIds);
    const messages = detail.messages.map((m) => ({
      ...m,
      attachments: attachmentsByMsg.get(m.id) ?? [],
    }));
    return { ...detail, messages };
  }

  @Post('sessions/:id/takeover')
  @HttpCode(HttpStatus.OK)
  async takeover(@Param('id') id: string) {
    const session = await this.livechat.getSession(id);
    if (!session) throw new NotFoundException(`Session not found: ${id}`);
    await this.livechat.setSessionStatus(id, 'human_taken_over');
    this.stream.publish(id, { type: 'session_status', sessionId: id, status: 'human_taken_over' });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });
    return { ok: true, status: 'human_taken_over' };
  }

  @Post('sessions/:id/release')
  @HttpCode(HttpStatus.OK)
  async release(@Param('id') id: string) {
    const session = await this.livechat.getSession(id);
    if (!session) throw new NotFoundException(`Session not found: ${id}`);
    await this.livechat.setSessionStatus(id, 'open');
    this.stream.publish(id, { type: 'session_status', sessionId: id, status: 'open' });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });
    return { ok: true, status: 'open' };
  }

  @Post('sessions/:id/close')
  @HttpCode(HttpStatus.OK)
  async close(@Param('id') id: string) {
    const session = await this.livechat.getSession(id);
    if (!session) throw new NotFoundException(`Session not found: ${id}`);
    await this.livechat.setSessionStatus(id, 'closed');
    this.stream.publish(id, { type: 'session_status', sessionId: id, status: 'closed' });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });
    // Fire-and-forget: send transcript if site has it enabled and visitor email is known.
    void this.transcript.maybeSendOnClose(id);
    return { ok: true, status: 'closed' };
  }

  @Post('sessions/:id/send-transcript')
  @HttpCode(HttpStatus.OK)
  async sendTranscript(@Param('id') id: string) {
    return this.transcript.send(id, { force: true });
  }

  @Post('messages/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approveMessage(@Param('id') id: string) {
    const msg = await this.livechat.getMessageById(id);
    if (!msg) throw new NotFoundException(`Message not found: ${id}`);
    if (!msg.pendingApproval) {
      return { ok: true, alreadyApproved: true };
    }
    await this.livechat.approveMessage(id);

    // Now publish to the session room so the visitor receives it.
    const attachmentsByMsg = await this.attachments.getForMessages([id]);
    const atts = attachmentsByMsg.get(id) ?? [];
    this.stream.publish(msg.sessionId, {
      type: 'message',
      sessionId: msg.sessionId,
      role: msg.role as 'visitor' | 'agent' | 'operator' | 'system',
      content: msg.content,
      messageId: msg.id,
      createdAt: msg.createdAt.toISOString(),
      attachments: atts.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        originalFilename: a.originalFilename,
        url: a.url,
      })),
    });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: msg.sessionId });

    return { ok: true };
  }

  @Post('messages/:id/edit-and-approve')
  @HttpCode(HttpStatus.OK)
  async editAndApprove(@Param('id') id: string, @Body() body: { content: string }) {
    if (!body?.content?.trim()) throw new BadRequestException('content is required');
    const msg = await this.livechat.getMessageById(id);
    if (!msg) throw new NotFoundException(`Message not found: ${id}`);
    const content = body.content.trim();
    await this.livechat.updateMessageContent(id, content);
    await this.livechat.approveMessage(id);

    const attachmentsByMsg = await this.attachments.getForMessages([id]);
    const atts = attachmentsByMsg.get(id) ?? [];
    this.stream.publish(msg.sessionId, {
      type: 'message',
      sessionId: msg.sessionId,
      role: msg.role as 'visitor' | 'agent' | 'operator' | 'system',
      content,
      messageId: msg.id,
      createdAt: msg.createdAt.toISOString(),
      attachments: atts.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        originalFilename: a.originalFilename,
        url: a.url,
      })),
    });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: msg.sessionId });

    return { ok: true };
  }

  @Post('messages/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectMessage(@Param('id') id: string) {
    const msg = await this.livechat.getMessageById(id);
    if (!msg) throw new NotFoundException(`Message not found: ${id}`);
    await this.livechat.deleteMessage(id);
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: msg.sessionId });
    return { ok: true };
  }

  @Post('messages/:id/flag')
  @HttpCode(HttpStatus.OK)
  async flagMessage(@Param('id') id: string, @Body() body: { correction: string }) {
    if (!body?.correction?.trim()) throw new BadRequestException('correction is required');
    const msg = await this.livechat.getMessageById(id);
    if (!msg) throw new NotFoundException(`Message not found: ${id}`);
    if (msg.role !== 'agent') throw new BadRequestException('Only AI agent messages can be flagged');

    const session = msg.sessionId ? await this.livechat.getSession(msg.sessionId) : null;
    const siteKey = session
      ? (await this.livechat.getSiteById(session.siteId)).key
      : null;

    const visitorQuestion = (msg.replyToContent?.trim()) || null;

    const result = await this.selfImprovement.proposeFromCorrection({
      agentKey: 'livechat',
      agentName: 'Live Chat',
      visitorQuestion,
      aiMessage: msg.content,
      correction: body.correction.trim(),
      siteKey,
      sessionId: msg.sessionId ?? null,
    });
    return { ok: true, proposalId: result.proposalId };
  }

  /** Operator-side identify — set / update the visitor email on a session. */
  @Post('sessions/:id/identify')
  @HttpCode(HttpStatus.OK)
  async identifyVisitor(@Param('id') id: string, @Body() body: { email?: string; name?: string }) {
    const session = await this.livechat.getSession(id);
    if (!session) throw new NotFoundException(`Session not found: ${id}`);
    const email = body?.email?.trim();
    const name = body?.name?.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Invalid email address');
    }
    const site = await this.livechat.getSiteById(session.siteId);
    await this.livechat.setVisitorIdentity({
      siteId: session.siteId,
      siteKey: site.key,
      visitorId: session.visitorId,
      email: email ?? undefined,
      name: name ?? undefined,
    });
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });
    return { ok: true };
  }

  @Post('sessions/:id/message')
  @HttpCode(HttpStatus.CREATED)
  async operatorReply(@Param('id') id: string, @Body() body: { content: string; attachmentIds?: string[]; operatorId?: string; internal?: boolean; replyToId?: string; replyToContent?: string }) {
    const hasAttachments = Array.isArray(body?.attachmentIds) && body.attachmentIds.length > 0;
    if (!body?.content?.trim() && !hasAttachments) throw new BadRequestException('content or attachments required');
    const session = await this.livechat.getSession(id);
    if (!session) throw new NotFoundException(`Session not found: ${id}`);

    const content = (body.content ?? '').trim();
    // Internal notes use role='note' and skip the visitor-facing socket
    // broadcast — only operators viewing this session ever see them via
    // the session detail re-fetch + the operator-room session_upserted ping.
    const isInternal = body.internal === true;
    const msg = await this.livechat.appendMessage({ sessionId: id, role: isInternal ? 'note' : 'operator', content, replyToId: body.replyToId || null, replyToContent: body.replyToContent ? body.replyToContent.slice(0, 200) : null });
    if (isInternal) {
      this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });
      return { ok: true, message: { id: msg.id, content, createdAt: msg.createdAt, attachments: [], role: 'note' } };
    }

    let attachments: Awaited<ReturnType<LivechatAttachmentsService['getById']>>[] = [];
    if (hasAttachments) {
      await this.attachments.linkToMessage(body.attachmentIds!, msg.id, id);
      attachments = await Promise.all(body.attachmentIds!.map((aid) => this.attachments.getById(aid)));
    }

    const site = await this.livechat.getSiteById(session.siteId).catch(() => null);

    // Resolve who's "speaking" to the visitor:
    //   - If the operator UI passed an explicit operatorId, use that row.
    //   - Otherwise pick the default operator configured for this site.
    //   - Otherwise fall back to the legacy site.operatorName text field
    //     with no avatar.
    let operatorName: string | null = site?.operatorName ?? null;
    let operatorAvatarUrl: string | null = null;
    if (body.operatorId) {
      const operator = await this.livechat.getOperatorById(body.operatorId);
      if (operator) {
        operatorName = operator.name;
        operatorAvatarUrl = operator.avatarUrl ?? null;
      }
    } else if (site?.key) {
      const ops = await this.livechat.getOperatorsForSite(site.key).catch(() => [] as LivechatOperatorRow[]);
      const def = ops.find((op) => op.isDefault) ?? ops[0];
      if (def) {
        operatorName = def.name;
        operatorAvatarUrl = def.avatarUrl ?? null;
      }
    }

    this.stream.publish(id, {
      type: 'message',
      sessionId: id,
      role: 'operator',
      content,
      messageId: msg.id,
      createdAt: msg.createdAt.toISOString(),
      operatorName,
      operatorAvatarUrl,
      attachments: attachments.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        originalFilename: a.originalFilename,
        url: a.url,
      })),
    });

    // Suppress bot replies for 90 s after an operator speaks.
    void this.rateLimit.markOperatorActive(id);

    if (session.status === 'open' || session.status === 'needs_human') {
      await this.livechat.setSessionStatus(id, 'human_taken_over');
      this.stream.publish(id, { type: 'session_status', sessionId: id, status: 'human_taken_over' });
    }
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });

    return { ok: true, message: { id: msg.id, content, createdAt: msg.createdAt, attachments } };
  }

  @Get('debug/ip-lookup')
  debugIpLookup(@Query('ip') ip?: string) {
    return this.enrichment.debugLookup(ip?.trim() || null);
  }

  @Get('geo/status')
  geoStatus() {
    return { loaded: this.geoIp.isLoaded() };
  }

  @Post('geo/download-db')
  @HttpCode(HttpStatus.OK)
  async downloadGeoDb() {
    const accountId = await this.settings.getDecrypted('maxmind_account_id');
    const licenseKey = await this.settings.getDecrypted('maxmind_license_key');
    if (!accountId || !licenseKey) {
      throw new BadRequestException('Set maxmind_account_id and maxmind_license_key in Settings before downloading');
    }
    try {
      await this.geoIp.downloadAndReload(accountId, licenseKey);
      void this.livechat.backfillGeoCountries();
      return { ok: true, loaded: this.geoIp.isLoaded() };
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
  }

  @Post('geo/upload-db')
  @HttpCode(HttpStatus.OK)
  async uploadGeoDb(@Req() req: FastifyRequest) {
    const r = req as unknown as {
      isMultipart?: () => boolean;
      parts: (opts?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<Record<string, unknown>>;
    };
    if (!r.isMultipart || !r.isMultipart()) throw new BadRequestException('multipart/form-data required');

    let buffer: Buffer | null = null;
    let filename = '';

    for await (const partRaw of r.parts({ limits: { fileSize: 150 * 1024 * 1024 } })) {
      const part = partRaw as { type?: string; filename?: string; toBuffer?: () => Promise<Buffer> };
      if (part.type === 'file' && typeof part.toBuffer === 'function') {
        buffer = await part.toBuffer();
        filename = part.filename ?? '';
      }
    }

    if (!buffer) throw new BadRequestException('file is required');
    if (!filename.endsWith('.mmdb')) throw new BadRequestException('file must have a .mmdb extension');

    try {
      await this.geoIp.saveAndReload(buffer);
      void this.livechat.backfillGeoCountries();
      return { ok: true, loaded: this.geoIp.isLoaded() };
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
  }

  @Post('geo/upload-chunk')
  @HttpCode(HttpStatus.OK)
  async uploadGeoChunk(
    @Body() body: { uploadId: string; chunkIndex: number; totalChunks: number; data: string },
  ) {
    const { uploadId, chunkIndex, totalChunks, data } = body;
    if (!uploadId || typeof chunkIndex !== 'number' || typeof totalChunks !== 'number' || !data) {
      throw new BadRequestException('uploadId, chunkIndex, totalChunks, and data are required');
    }
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(uploadId)) throw new BadRequestException('invalid uploadId');
    if (chunkIndex < 0 || chunkIndex >= totalChunks) throw new BadRequestException('invalid chunkIndex');

    const tmpDir = os.tmpdir();
    const chunkPath = path.join(tmpDir, `geo_chunk_${uploadId}_${chunkIndex}`);
    const chunkBuf = Buffer.from(data, 'base64');
    await fs.promises.writeFile(chunkPath, chunkBuf);

    if (chunkIndex < totalChunks - 1) {
      return { ok: true, received: chunkIndex + 1, total: totalChunks };
    }

    // Last chunk received — assemble all chunks in order.
    const parts: Buffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const p = path.join(tmpDir, `geo_chunk_${uploadId}_${i}`);
      try {
        parts.push(await fs.promises.readFile(p));
      } catch {
        throw new InternalServerErrorException(`Missing chunk ${i} — upload may have been interrupted`);
      }
    }
    const assembled = Buffer.concat(parts);

    // Clean up temp files.
    await Promise.allSettled(
      Array.from({ length: totalChunks }, (_, i) =>
        fs.promises.unlink(path.join(tmpDir, `geo_chunk_${uploadId}_${i}`)),
      ),
    );

    try {
      await this.geoIp.saveAndReload(assembled);
      void this.livechat.backfillGeoCountries();
      return { ok: true, loaded: this.geoIp.isLoaded() };
    } catch (err) {
      throw new InternalServerErrorException((err as Error).message);
    }
  }

  @Get('visitors/live')
  liveVisitors(@Query('windowSec') windowSec?: string) {
    const w = windowSec ? Math.max(15, Math.min(600, Number(windowSec))) : 60;
    return this.livechat.listLiveVisitors(w);
  }

  @Get('visitors/:id')
  async getVisitor(@Param('id') id: string) {
    const visitor = await this.livechat.getVisitor(id);
    if (!visitor) throw new NotFoundException(`Visitor not found: ${id}`);
    return visitor;
  }

  @Get('visitors/:id/pageviews')
  pageviews(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.livechat.getVisitorPageviews(id, { limit: limit ? Number(limit) : undefined });
  }

  @Get('visitors/:id/sessions')
  visitorSessions(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.livechat.getVisitorSessions(id, limit ? Math.min(Number(limit), 100) : 20);
  }

  @Post('translate')
  @HttpCode(HttpStatus.OK)
  async translate(@Body() body: { text: string; targetLang: string; sourceLang?: string }) {
    if (!body?.text?.trim()) throw new BadRequestException('text is required');
    if (!body?.targetLang?.trim()) throw new BadRequestException('targetLang is required');

    const source = body.sourceLang ? ` from ${body.sourceLang}` : '';
    const prompt = `Translate the following text${source} to ${body.targetLang}. Return ONLY the translated text, no explanations, no quotes, no markdown.\n\n${body.text.trim()}`;

    const res = await this.llm.complete({
      agentKey: 'livechat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 1000,
    });

    return { translated: res.content.trim() };
  }

  @Get('kb-gaps')
  listKbGaps(@Query('siteKey') siteKey?: string, @Query('limit') limit?: string) {
    return this.livechat.listKbGaps(siteKey, limit ? Math.min(parseInt(limit, 10), 200) : 100);
  }

  @Delete('kb-gaps/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKbGap(@Param('id') id: string) {
    await this.livechat.deleteKbGap(id);
  }

  @Post('kb-flags')
  @HttpCode(HttpStatus.CREATED)
  flagKbSource(
    @Body() body: { kbEntryId: string; sessionId: string; messageId: string; siteKey: string; note?: string },
  ) {
    if (!body?.kbEntryId?.trim()) throw new BadRequestException('kbEntryId is required');
    if (!body?.sessionId?.trim()) throw new BadRequestException('sessionId is required');
    if (!body?.messageId?.trim()) throw new BadRequestException('messageId is required');
    if (!body?.siteKey?.trim()) throw new BadRequestException('siteKey is required');
    return this.livechat.flagKbSource(body);
  }
}
