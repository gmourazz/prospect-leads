import { ApiError } from './api-error'

// In dev, relative '/api/v1' rides Vite's proxy to localhost:8080. In a
// static production build there's no proxy, so VITE_API_URL must point at
// the deployed backend directly.
const BASE = import.meta.env.VITE_API_URL ?? '/api/v1'
const TOKEN_KEY = 'prospect_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* private browsing / storage disabled: session just won't survive a refresh */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

// Notified whenever a request comes back 401 with a token attached, so the
// auth context can drop the stale session and send the user to /login
// without every call site having to check for it.
type SessionListener = () => void
let sessionListener: SessionListener | null = null
export function onSessionExpired(listener: SessionListener) {
  sessionListener = listener
}

type RequestOptions = {
  method?: string
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  let body: BodyInit | undefined

  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  // The key is generated at the click and reused across retries, so a network
  // retry or a refresh can never produce a second send.
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
  })

  if (!response.ok) {
    let problem: Record<string, unknown> = {}
    try {
      problem = await response.json()
    } catch {
      /* non-JSON error body */
    }
    const code = String(problem.code ?? 'internal_error')
    // A 401 on a request that carried a token means the session expired —
    // not that these particular credentials were wrong (that only happens
    // on /auth/login, which never attaches a token in the first place).
    if (response.status === 401 && token) {
      sessionListener?.()
    }
    throw new ApiError(
      code,
      response.status,
      String(problem.detail ?? 'Erro inesperado'),
      problem.request_id as string | undefined,
      problem.meta as Record<string, unknown> | undefined,
    )
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const http = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, { method: 'POST', body, idempotencyKey }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
}
