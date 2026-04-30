import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

export interface AttachmentSummary {
  id: string;
  mimeType: string;
  sizeBytes: number;
  originalFilename: string;
  url: string;
}

export type LivechatStreamEvent =
  | { type: 'message'; sessionId: string; role: 'visitor' | 'agent' | 'operator' | 'system'; content: string; messageId: string; createdAt: string; attachments?: AttachmentSummary[]; pendingApproval?: boolean }
  | { type: 'message_removed'; sessionId: string; messageId: string }
  | { type: 'pageview'; sessionId: string | null; visitorPk: string; url: string; title: string | null; at: string }
  | { type: 'session_status'; sessionId: string; status: string }
  | { type: 'typing'; sessionId: string; from: 'agent' | 'operator' | 'visitor'; on: boolean };

export type OperatorEvent =
  | { type: 'session_upserted'; sessionId: string }
  | { type: 'visitor_activity'; visitorPk: string; siteKey: string }
  | { type: 'visitor_offline'; visitorPk: string }
  | { type: 'inbox_dirty' };

const ROOM_PREFIX = 'livechat:session:';
const OPERATOR_ROOM = 'livechat:operators';

@Injectable()
export class LivechatStreamService {
  private readonly logger = new Logger(LivechatStreamService.name);
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  publish(sessionId: string, event: LivechatStreamEvent): void {
    if (!this.server) {
      this.logger.debug(`publish before gateway attached, dropping: ${event.type}`);
      return;
    }
    this.server.to(ROOM_PREFIX + sessionId).emit('livechat:event', event);
  }

  /** Broadcast an event to every connected operator socket. */
  publishToOperators(event: OperatorEvent): void {
    if (!this.server) return;
    this.server.to(OPERATOR_ROOM).emit('livechat:operator', event);
  }

  static room(sessionId: string): string {
    return ROOM_PREFIX + sessionId;
  }

  static operatorRoom(): string {
    return OPERATOR_ROOM;
  }
}
