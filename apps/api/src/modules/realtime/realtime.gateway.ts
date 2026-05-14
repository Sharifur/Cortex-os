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
import { NotificationsService } from '../notifications/notifications.service';

const ROOM_ACTIVITY = 'activity';
const ROOM_APPROVALS = 'approvals';
const ROOM_NOTIFICATIONS = 'notifications';
const ROOM_DESIGN_STUDIO = 'design-studio';

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
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() {
    this.events.on('log.created', (entry: unknown) => {
      this.server.to(ROOM_ACTIVITY).emit('activity:log', entry);
      void this.pushNotificationSummary();
    });
    this.events.on('approval.created', (approval: unknown) => {
      this.server.to(ROOM_APPROVALS).emit('approval:created', approval);
      void this.pushNotificationSummary();
    });
    this.events.on('approval.removed', (payload: unknown) => {
      this.server.to(ROOM_APPROVALS).emit('approval:removed', payload);
      void this.pushNotificationSummary();
    });
    // KB proposal created/approved/rejected — affects the proposals count
    this.events.on('kb.proposal.created', () => void this.pushNotificationSummary());
    this.events.on('kb.proposal.resolved', () => void this.pushNotificationSummary());
    this.events.on('design-studio.job.updated', (payload: unknown) => {
      this.server.to(ROOM_DESIGN_STUDIO).emit('design-studio:job-update', payload);
    });
  }

  private async pushNotificationSummary(sinceMs?: number) {
    try {
      const since = sinceMs ? new Date(sinceMs) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const summary = await this.notifications.getSummary({ failuresSince: since });
      this.server.to(ROOM_NOTIFICATIONS).emit('notifications:update', summary);
    } catch (err) {
      this.logger.warn(`pushNotificationSummary failed: ${(err as Error).message}`);
    }
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

  @SubscribeMessage('notifications:subscribe')
  async onNotificationsSubscribe(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() data: { failuresSince?: number },
  ) {
    if (!client.userId) return;
    await client.join(ROOM_NOTIFICATIONS);
    // Push current summary immediately on subscription
    try {
      const since = data?.failuresSince ? new Date(data.failuresSince) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const summary = await this.notifications.getSummary({ failuresSince: since });
      client.emit('notifications:update', summary);
    } catch (err) {
      this.logger.warn(`notifications:subscribe snapshot failed: ${(err as Error).message}`);
    }
  }

  @SubscribeMessage('notifications:unsubscribe')
  async onNotificationsUnsubscribe(@ConnectedSocket() client: AuthedSocket) {
    await client.leave(ROOM_NOTIFICATIONS);
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

  @SubscribeMessage('design-studio:subscribe')
  async onDesignStudioSubscribe(@ConnectedSocket() client: AuthedSocket) {
    if (!client.userId) return;
    await client.join(ROOM_DESIGN_STUDIO);
  }

  @SubscribeMessage('design-studio:unsubscribe')
  async onDesignStudioUnsubscribe(@ConnectedSocket() client: AuthedSocket) {
    await client.leave(ROOM_DESIGN_STUDIO);
  }

  @SubscribeMessage('ping')
  onPing(@MessageBody() _data: unknown, @ConnectedSocket() client: Socket) {
    client.emit('pong', { ts: Date.now() });
  }
}
