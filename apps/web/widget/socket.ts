import { io, Socket } from 'socket.io-client';
import type { WidgetConfig } from './config';

export interface LivechatEvent {
  type: 'message' | 'pageview' | 'session_status' | 'typing';
  sessionId: string;
  role?: 'visitor' | 'agent' | 'operator' | 'system';
  content?: string;
  messageId?: string;
  createdAt?: string;
  status?: string;
  on?: boolean;
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
