import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { LivechatService } from './livechat.service';
import { LivechatStreamService } from './livechat-stream.service';

interface LivechatSocket extends Socket {
  data: {
    role?: 'visitor' | 'operator';
    sessionId?: string;
    visitorId?: string;
    siteKey?: string;
    userId?: string;
  };
}

@Injectable()
@WebSocketGateway({
  path: '/livechat-ws',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class LivechatGateway implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LivechatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly livechat: LivechatService,
    private readonly stream: LivechatStreamService,
  ) {}

  onModuleInit() {
    this.stream.attach(this.server);
  }

  async handleConnection(client: LivechatSocket) {
    const auth = (client.handshake.auth ?? {}) as Record<string, string | undefined>;
    const query = client.handshake.query as Record<string, string | undefined>;
    const operatorToken = auth.operatorToken ?? query.operatorToken;

    if (operatorToken) {
      try {
        const payload = this.jwt.verify(operatorToken, { secret: process.env.JWT_SECRET }) as { sub?: string };
        client.data.role = 'operator';
        client.data.userId = payload.sub;
        await client.join(LivechatStreamService.operatorRoom());
        this.logger.debug(`operator socket connected: ${client.id} (user ${client.data.userId})`);
        return;
      } catch {
        client.emit('error', { message: 'Unauthorized' });
        client.disconnect(true);
        return;
      }
    }

    const siteKey = (auth.siteKey ?? query.siteKey ?? '').toString();
    const visitorId = (auth.visitorId ?? query.visitorId ?? '').toString();
    const sessionId = (auth.sessionId ?? query.sessionId ?? '').toString();
    const origin = (client.handshake.headers.origin ?? '') as string;

    if (!siteKey || !visitorId || !sessionId) {
      client.emit('error', { message: 'siteKey, visitorId, sessionId required' });
      client.disconnect(true);
      return;
    }

    let site: Awaited<ReturnType<LivechatService['resolveSiteForRequest']>>;
    try {
      site = await this.livechat.resolveSiteForRequest(siteKey, origin);
    } catch {
      client.emit('error', { message: 'origin not allowed' });
      client.disconnect(true);
      return;
    }

    // Verify the session exists and actually belongs to this visitor on this site.
    // Without this check, anyone who guesses a sessionId UUID can join the room
    // and receive all agent replies and stream events for that conversation.
    const session = await this.livechat.getSession(sessionId).catch(() => null);
    if (!session || session.visitorId !== visitorId || session.siteId !== site.id) {
      client.emit('error', { message: 'session not found' });
      client.disconnect(true);
      return;
    }

    client.data.role = 'visitor';
    client.data.siteKey = siteKey;
    client.data.visitorId = visitorId;
    client.data.sessionId = sessionId;
    await client.join(LivechatStreamService.room(sessionId));
    this.logger.debug(`visitor socket connected: ${client.id} session=${sessionId.slice(-8)}`);
  }

  handleDisconnect(client: LivechatSocket) {
    this.logger.debug(`socket disconnected: ${client.id} (role=${client.data.role ?? 'unknown'})`);
  }

  @SubscribeMessage('livechat:join')
  async onJoin(@ConnectedSocket() client: LivechatSocket, @MessageBody() data: { sessionId: string }) {
    if (client.data.role !== 'operator') return { ok: false, error: 'operator only' };
    if (!data?.sessionId) return { ok: false, error: 'sessionId required' };
    await client.join(LivechatStreamService.room(data.sessionId));
    return { ok: true };
  }

  @SubscribeMessage('livechat:leave')
  async onLeave(@ConnectedSocket() client: LivechatSocket, @MessageBody() data: { sessionId: string }) {
    if (!data?.sessionId) return { ok: false };
    await client.leave(LivechatStreamService.room(data.sessionId));
    return { ok: true };
  }

  @SubscribeMessage('livechat:ping')
  onPing(@ConnectedSocket() client: LivechatSocket) {
    client.emit('livechat:pong', { ts: Date.now() });
  }

  /**
   * Forward typing indicators between visitor and operator(s) in the same
   * session room. Sender is excluded via `client.to(room)` so a typist never
   * receives their own event back.
   *
   * Visitors carry sessionId on the socket; operators must pass it in the body
   * because their socket isn't tied to a single session.
   */
  @SubscribeMessage('livechat:messages_seen')
  async onMessagesSeen(@ConnectedSocket() client: LivechatSocket, @MessageBody() data: { messageIds?: string[] }) {
    if (client.data.role !== 'visitor') return { ok: false };
    const sessionId = client.data.sessionId;
    if (!sessionId || !Array.isArray(data?.messageIds) || !data.messageIds.length) return { ok: false };

    const seenIds = await this.livechat.markMessagesSeen(data.messageIds, sessionId);
    if (seenIds.length) {
      const seenAt = new Date().toISOString();
      this.stream.publish(sessionId, { type: 'messages_seen', sessionId, messageIds: seenIds, seenAt });
    }
    return { ok: true };
  }

  @SubscribeMessage('livechat:typing')
  async onTyping(@ConnectedSocket() client: LivechatSocket, @MessageBody() data: { sessionId?: string; on?: boolean }) {
    const role = client.data.role;
    if (role !== 'visitor' && role !== 'operator') return;

    const sessionId = role === 'visitor' ? client.data.sessionId : data?.sessionId;
    if (!sessionId) return;

    client.to(LivechatStreamService.room(sessionId)).emit('livechat:event', {
      type: 'typing',
      sessionId,
      from: role,
      on: !!data?.on,
    });
  }
}
