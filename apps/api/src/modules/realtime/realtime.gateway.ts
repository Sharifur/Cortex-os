import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
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
import { ApprovalService } from '../agents/runtime/approval.service';
import { RunsService } from '../runs/runs.service';

const ROOM_ACTIVITY = 'activity';
const ROOM_APPROVALS = 'approvals';

interface AuthedSocket extends Socket {
  userId?: string;
}

@Injectable()
@WebSocketGateway({
  path: '/ws',
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly approvals: ApprovalService,
    private readonly runs: RunsService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    // Re-broadcast app events to subscribed sockets.
    this.events.on('log.created', (entry: unknown) => {
      this.server.to(ROOM_ACTIVITY).emit('activity:log', entry);
    });
    this.events.on('approval.created', (approval: unknown) => {
      this.server.to(ROOM_APPROVALS).emit('approval:created', approval);
    });
    this.events.on('approval.removed', (payload: unknown) => {
      this.server.to(ROOM_APPROVALS).emit('approval:removed', payload);
    });
  }

  handleConnection(client: AuthedSocket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      client.emit('error', { message: 'Missing token' });
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwt.verify(token, { secret: process.env.JWT_SECRET }) as { sub?: string };
      client.userId = payload.sub;
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }

    this.logger.debug(`socket connected: ${client.id} (user ${client.userId})`);
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.debug(`socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('activity:subscribe')
  async onActivitySubscribe(@ConnectedSocket() client: AuthedSocket) {
    if (!client.userId) return;
    await client.join(ROOM_ACTIVITY);
    const initial = await this.runs.getRecentLogs(100);
    client.emit('activity:snapshot', initial);
  }

  @SubscribeMessage('activity:unsubscribe')
  async onActivityUnsubscribe(@ConnectedSocket() client: AuthedSocket) {
    await client.leave(ROOM_ACTIVITY);
  }

  @SubscribeMessage('approvals:subscribe')
  async onApprovalsSubscribe(@ConnectedSocket() client: AuthedSocket) {
    if (!client.userId) return;
    await client.join(ROOM_APPROVALS);
    const snapshot = await this.approvals.getPending();
    client.emit('approvals:snapshot', snapshot);
  }

  @SubscribeMessage('approvals:unsubscribe')
  async onApprovalsUnsubscribe(@ConnectedSocket() client: AuthedSocket) {
    await client.leave(ROOM_APPROVALS);
  }

  @SubscribeMessage('ping')
  onPing(@MessageBody() _data: unknown, @ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }
}
