import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getRealtimeSocket(token: string): Socket {
  if (socket && currentToken === token && socket.connected) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  const url = window.location.origin;
  socket = io(url, {
    path: '/ws',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity,
    timeout: 10_000,
  });

  return socket;
}

export function disconnectRealtime() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
