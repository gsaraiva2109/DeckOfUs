import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../plugins/auth.js';

interface AuthedSocket extends Socket {
  data: { sessionId: string; role: JwtPayload['role'] };
}

function computePresence(io: Server, room: string) {
  const sockets = Array.from(io.sockets.adapter.rooms.get(room) ?? []);
  const roles: Record<string, number> = {};
  for (const id of sockets) {
    const s = io.sockets.sockets.get(id) as AuthedSocket | undefined;
    const role = s?.data?.role ?? 'unknown';
    roles[role] = (roles[role] ?? 0) + 1;
  }
  return { count: sockets.length, roles };
}

function emitPresence(io: Server, room: string): void {
  io.to(room).emit('presence', computePresence(io, room));
}

export function gateway(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const { sessionId } = socket.data as AuthedSocket['data'];
    if (!sessionId) {
      socket.disconnect(true);
      return;
    }

    void socket.join(sessionId);
    emitPresence(io, sessionId);

    // Navigation relay: a device emits an opaque nav snapshot; mirror it to the
    // OTHER device(s) in the room (sender excluded via socket.to). This keeps
    // game start + card progression in lock-step. Either device may drive.
    socket.on('nav', (payload: unknown) => {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
      socket.to(sessionId).emit('nav', payload);
    });

    socket.on('disconnect', () => {
      // Presence recomputed after this socket has left the room.
      emitPresence(io, sessionId);
    });
  });
}

export function broadcastOusado(
  io: Server,
  sessionId: string,
  by: string,
): void {
  io.to(sessionId).emit('ousado_activated', {
    by,
    at: new Date().toISOString(),
  });
}

export function broadcastPhoto(
  io: Server,
  sessionId: string,
  url: string,
): void {
  io.to(sessionId).emit('photo_added', { url });
}

export function broadcastSessionEnded(
  io: Server,
  sessionId: string,
): void {
  io.to(sessionId).emit('session_ended', {});
}
