// Session context: holds the live multiplayer state shared across screens.
// Connects the socket once we have a token, and mirrors server events into React state.
// Designed to degrade gracefully — solo play simply never establishes a session,
// in which case all fields stay at their inert defaults and no socket is opened.
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Socket } from 'socket.io-client'
import {
  connect as connectSocket,
  disconnect as disconnectSocket,
  emitNav,
  onNav,
  onPhoto,
  onPresence,
  onOusado,
  onSessionEnded,
  type NavPayload,
  type PresencePayload,
} from './socket'

export type Role = 'organizer' | 'guest'

export interface SessionState {
  sessionId: string | null
  code: string | null
  role: Role | null
  token: string | null
  ousadoActive: boolean
  presence: PresencePayload
  photos: string[]
}

export interface SessionContextValue extends SessionState {
  // True once a real session exists (multiplayer). False during solo play.
  hasSession: boolean
  // Establish a session (called by SessionScreen after create/join).
  setSession: (s: { sessionId: string; code: string; role: Role; token: string; ousadoActive?: boolean }) => void
  setOusadoActive: (v: boolean) => void
  addPhoto: (url: string) => void
  // Fired (locally) when the server pushes ousado_activated; App subscribes.
  onOusadoEvent: (cb: () => void) => () => void
  // Broadcast a navigation snapshot to the other device (no-op in solo play).
  syncNav: (payload: NavPayload) => void
  // Fired when the other device relays a nav snapshot; App applies it.
  onNavEvent: (cb: (p: NavPayload) => void) => () => void
  reset: () => void
}

const inert: SessionState = {
  sessionId: null,
  code: null,
  role: null,
  token: null,
  ousadoActive: false,
  presence: { count: 0, roles: [] },
  photos: [],
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(inert)
  const socketRef = useRef<Socket | null>(null)
  // Local listeners for the ousado event, so App can drive its choreography.
  const ousadoListeners = useRef<Set<() => void>>(new Set())
  // Local listeners for relayed nav snapshots, so App can mirror navigation.
  const navListeners = useRef<Set<(p: NavPayload) => void>>(new Set())

  const setSession: SessionContextValue['setSession'] = useCallback((s) => {
    setState((prev) => ({
      ...prev,
      sessionId: s.sessionId,
      code: s.code,
      role: s.role,
      token: s.token,
      ousadoActive: s.ousadoActive ?? prev.ousadoActive,
    }))
  }, [])

  const setOusadoActive = useCallback((v: boolean) => {
    setState((prev) => ({ ...prev, ousadoActive: v }))
  }, [])

  const addPhoto = useCallback((url: string) => {
    setState((prev) => (prev.photos.includes(url) ? prev : { ...prev, photos: [...prev.photos, url] }))
  }, [])

  const onOusadoEvent = useCallback((cb: () => void) => {
    ousadoListeners.current.add(cb)
    return () => {
      ousadoListeners.current.delete(cb)
    }
  }, [])

  const syncNav = useCallback((payload: NavPayload) => {
    const socket = socketRef.current
    if (socket) emitNav(socket, payload)
  }, [])

  const onNavEvent = useCallback((cb: (p: NavPayload) => void) => {
    navListeners.current.add(cb)
    return () => {
      navListeners.current.delete(cb)
    }
  }, [])

  const reset = useCallback(() => {
    disconnectSocket(socketRef.current)
    socketRef.current = null
    setState(inert)
  }, [])

  // Connect the socket whenever a token appears; tear down on change/unmount.
  useEffect(() => {
    if (!state.token) return
    const socket = connectSocket(state.token)
    socketRef.current = socket

    const offs = [
      onPresence(socket, (p) => setState((prev) => ({ ...prev, presence: p }))),
      onOusado(socket, () => {
        setState((prev) => ({ ...prev, ousadoActive: true }))
        ousadoListeners.current.forEach((cb) => cb())
      }),
      onPhoto(socket, (p) =>
        setState((prev) => (prev.photos.includes(p.url) ? prev : { ...prev, photos: [...prev.photos, p.url] })),
      ),
      onNav(socket, (p) => {
        navListeners.current.forEach((cb) => cb(p))
      }),
      onSessionEnded(socket, () => {
        /* keep state; the game can still finish locally */
      }),
    ]

    return () => {
      offs.forEach((off) => off())
      disconnectSocket(socket)
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [state.token])

  const value: SessionContextValue = {
    ...state,
    hasSession: !!state.token,
    setSession,
    setOusadoActive,
    addPhoto,
    onOusadoEvent,
    syncNav,
    onNavEvent,
    reset,
  }

  return createElement(SessionContext.Provider, { value }, children)
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>')
  return ctx
}
