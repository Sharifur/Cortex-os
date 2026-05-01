import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LivechatService } from './livechat.service';
import { LivechatStreamService } from './livechat-stream.service';
import { LivechatAttachmentsService } from './livechat-attachments.service';
import { LivechatTranscriptService } from './livechat-transcript.service';

@Controller('agents/livechat')
@UseGuards(JwtAuthGuard)
export class LivechatConversationsController {
  constructor(
    private livechat: LivechatService,
    private stream: LivechatStreamService,
    private attachments: LivechatAttachmentsService,
    private transcript: LivechatTranscriptService,
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
  async operatorReply(@Param('id') id: string, @Body() body: { content: string; attachmentIds?: string[]; operatorId?: string }) {
    const hasAttachments = Array.isArray(body?.attachmentIds) && body.attachmentIds.length > 0;
    if (!body?.content?.trim() && !hasAttachments) throw new BadRequestException('content or attachments required');
    const session = await this.livechat.getSession(id);
    if (!session) throw new NotFoundException(`Session not found: ${id}`);

    const content = (body.content ?? '').trim();
    const msg = await this.livechat.appendMessage({ sessionId: id, role: 'operator', content });

    let attachments: Awaited<ReturnType<LivechatAttachmentsService['getById']>>[] = [];
    if (hasAttachments) {
      await this.attachments.linkToMessage(body.attachmentIds!, msg.id, id);
      attachments = await Promise.all(body.attachmentIds!.map((aid) => this.attachments.getById(aid)));
    }

    const site = await this.livechat.getSiteById(session.siteId).catch(() => null);

    let operatorName: string | null = site?.operatorName ?? null;
    if (body.operatorId) {
      const operator = await this.livechat.getOperatorById(body.operatorId);
      if (operator) operatorName = operator.name;
    }

    this.stream.publish(id, {
      type: 'message',
      sessionId: id,
      role: 'operator',
      content,
      messageId: msg.id,
      createdAt: msg.createdAt.toISOString(),
      operatorName,
      attachments: attachments.map((a) => ({
        id: a.id,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        originalFilename: a.originalFilename,
        url: a.url,
      })),
    });

    if (session.status === 'open' || session.status === 'needs_human') {
      await this.livechat.setSessionStatus(id, 'human_taken_over');
      this.stream.publish(id, { type: 'session_status', sessionId: id, status: 'human_taken_over' });
    }
    this.stream.publishToOperators({ type: 'session_upserted', sessionId: id });

    return { ok: true, message: { id: msg.id, content, createdAt: msg.createdAt, attachments } };
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
}
