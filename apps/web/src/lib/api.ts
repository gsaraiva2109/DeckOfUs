// Typed REST client for the DeckOfUs backend.
// API_URL is intentionally EMPTY (same-origin). In production the frontend's
// nginx reverse-proxies /api and /socket.io to the internal backend; in dev,
// vite's server.proxy (vite.config.js) forwards them to localhost:8080. Using
// relative URLs means NO backend origin is ever baked into the bundle — the
// published image carries zero deployment-specific or personal data.
export const API_URL: string = ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// ---- response shapes (mirror the backend contract) ----
export interface CreateSessionResponse {
  sessionId: string
  code: string
  joinUrl: string
  qrDataUrl: string
  organizerToken: string
}

export interface JoinSessionResponse {
  sessionId: string
  participantToken: string
  status: string
  ousadoActive: boolean
}

export interface SessionSnapshot {
  status: string
  ousadoActive: boolean
  participants: number
  photos: string[]
}

export interface OusadoResponse {
  ousadoActive: boolean
}

export interface PhotoResponse {
  url: string
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`
  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { method: opts.method ?? 'GET', headers, body })
  } catch (e) {
    // network failure / backend unreachable
    throw new ApiError(0, e instanceof Error ? e.message : 'network error')
  }

  if (!res.ok) {
    let msg = res.statusText
    try {
      const j = await res.json()
      if (j && typeof j.error === 'string') msg = j.error
      else if (j && typeof j.message === 'string') msg = j.message
    } catch (_) {
      /* ignore non-json error bodies */
    }
    throw new ApiError(res.status, msg)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const api = {
  createSession(secret: string) {
    return request<CreateSessionResponse>('/api/sessions', {
      method: 'POST',
      body: { secret },
    })
  },

  joinSession(code: string) {
    return request<JoinSessionResponse>(`/api/sessions/${encodeURIComponent(code)}/join`, {
      method: 'POST',
    })
  },

  getSnapshot(code: string, token: string) {
    return request<SessionSnapshot>(`/api/sessions/${encodeURIComponent(code)}`, { token })
  },

  activateOusado(sessionId: string, secret: string, token: string) {
    return request<OusadoResponse>(`/api/sessions/${encodeURIComponent(sessionId)}/ousado`, {
      method: 'POST',
      body: { secret },
      token,
    })
  },

  // Photo upload uses XHR (below) for progress, not this client.
}

// Upload a photo via XHR so we can report progress. Resolves with the stored url.
export function uploadPhoto(
  sessionId: string,
  file: File,
  token: string,
  onProgress?: (pct: number) => void,
): Promise<PhotoResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/api/sessions/${encodeURIComponent(sessionId)}/photo`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as PhotoResponse)
        } catch (_) {
          reject(new ApiError(xhr.status, 'invalid response'))
        }
      } else {
        reject(new ApiError(xhr.status, xhr.statusText || 'upload failed'))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, 'network error'))
    xhr.send(form)
  })
}
