import { io, Socket } from 'socket.io-client';
import type { WidgetConfig } from './config';

export interface LivechatEvent {
  type: 'message' | 'pageview' | 'session_status' | 'typing'
      | 'agent_stream_start' | 'agent_stream_delta' | 'agent_stream_end'
      | 'agent_suggestions';
  sessionId: string;
  role?: 'visitor' | 'agent' | 'operator' | 'system';
  content?: string;
  messageId?: string;
  createdAt?: string;
  status?: string;
  on?: boolean;
  /** Streaming-only fields. */
  draftId?: string;
  delta?: string;
  /** Quick-reply chips for the latest agent message. */
  suggestions?: string[];
}

export function connectVisitorSocket(cfg: WidgetConfig, sessionId: string, onEvent: (e: LivechatEvent) => void): Socket {
  const url = cfg.apiBase || window.location.origin;
  const sock = io(url, {
    path: '/livechat-ws',
    auth: { siteKey: cfg.siteKey, visitorId: cfg.visitorId, sessionId },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 600,
    reconnectionDelayMax: 8000,
  });
  sock.on('livechat:event', (event: LivechatEvent) => {
    if (event.sessionId !== sessionId) return;
    onEvent(event);
  });
  return sock;
}
