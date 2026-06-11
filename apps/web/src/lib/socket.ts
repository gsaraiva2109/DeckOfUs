// Thin Socket.IO wrapper. The server pushes domain events; clients never emit
// domain events (per contract), so we only expose subscribe helpers + connect/disconnect.
import { io, Socket } from 'socket.io-client'
import { API_URL } from './api'

export interface PresencePayload {
  count: number
  roles?: string[]
}
export interface OusadoActivatedPayload {
  by: string
  at: string | number
}
export interface PhotoAddedPayload {
  url: string
}

export function connect(token: string): Socket {
  const url = API_URL || window.location.origin
  return io(url, {
    auth: { token },
    transports: ['websocket'],
    autoConnect: true,
  })
}

export function onPresence(socket: Socket, cb: (p: PresencePayload) => void): () => void {
  socket.on('presence', cb)
  return () => socket.off('presence', cb)
}

export function onOusado(socket: Socket, cb: (p: OusadoActivatedPayload) => void): () => void {
  socket.on('ousado_activated', cb)
  return () => socket.off('ousado_activated', cb)
}

export function onPhoto(socket: Socket, cb: (p: PhotoAddedPayload) => void): () => void {
  socket.on('photo_added', cb)
  return () => socket.off('photo_added', cb)
}

export function onSessionEnded(socket: Socket, cb: () => void): () => void {
  socket.on('session_ended', cb)
  return () => socket.off('session_ended', cb)
}

export function disconnect(socket: Socket | null) {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
  }
}
