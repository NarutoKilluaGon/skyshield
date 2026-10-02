/**
 * API client boundary.
 *
 * Every service in `src/services` calls through this module. Swapping the mock
 * transport for a Django REST backend is a one-file change: set
 * `VITE_API_BASE_URL` and flip `USE_MOCK` to false. The serializers on the
 * Django side should mirror the interfaces in `src/types`.
 */

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

/** CSRF token for Django SessionAuthentication. */
function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

export class HttpError extends Error {
  /** Seconds to wait when the server answered 429 with Retry-After. */
  readonly retryAfterSeconds: number | null

  constructor(
    readonly status: number,
    readonly url: string,
    message: string,
    readonly detail?: unknown,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'HttpError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** True when an error is a 429 rate-limit response. */
export function isRateLimited(e: unknown): boolean {
  return e instanceof HttpError && e.status === 429
}

/** Human-readable retry message honouring Retry-After when present. */
export function rateLimitMessage(e: unknown): string {
  if (e instanceof HttpError && e.retryAfterSeconds !== null)
    return `Too many requests — the server asked us to retry in ${e.retryAfterSeconds}s.`
  return 'Too many requests. Please wait a moment and try again.'
}

function retryAfterOf(res: Response): number | null {
  const header = res.headers.get('Retry-After')
  if (!header) return null
  const secs = Number(header)
  if (Number.isFinite(secs)) return Math.max(0, Math.round(secs))
  const date = Date.parse(header)
  if (!Number.isNaN(date)) return Math.max(0, Math.round((date - Date.now()) / 1000))
  return null
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`
  const { headers: extraHeaders, ...rest } = init
  const res = await fetch(url, {
    credentials: 'include',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-CSRFToken': csrfToken(),
      ...Object.fromEntries(new Headers(extraHeaders).entries()),
    },
  })

  if (!res.ok) {
    let detail: unknown
    try {
      detail = await res.json()
    } catch {
      detail = await res.text()
    }
    throw new HttpError(
      res.status,
      url,
      `Request failed: ${res.statusText}`,
      detail,
      res.status === 429 ? retryAfterOf(res) : null,
    )
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/**
 * M5: every mutating request carries an Idempotency-Key. Callers that retry a
 * logical operation (the offline queue) pass a stable key so the server can
 * replay its stored answer instead of executing the mutation twice.
 */
function withIdempotencyKey(init: RequestInit, key?: string): RequestInit {
  const headers = new Headers(init.headers)
  if (!headers.has('Idempotency-Key')) headers.set('Idempotency-Key', key ?? crypto.randomUUID())
  return { ...init, headers }
}

export interface MutationOptions {
  idempotencyKey?: string
}

export const api = {
  enabled: USE_MOCK,
  baseUrl: API_BASE,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown, opts?: MutationOptions) =>
    request<T>(
      path,
      withIdempotencyKey({ method: 'POST', body: JSON.stringify(body) }, opts?.idempotencyKey),
    ),
  patch: <T>(path: string, body: unknown, opts?: MutationOptions) =>
    request<T>(
      path,
      withIdempotencyKey({ method: 'PATCH', body: JSON.stringify(body) }, opts?.idempotencyKey),
    ),
  put: <T>(path: string, body: unknown, opts?: MutationOptions) =>
    request<T>(
      path,
      withIdempotencyKey({ method: 'PUT', body: JSON.stringify(body) }, opts?.idempotencyKey),
    ),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** Multipart upload (M4). No JSON content-type — the browser sets the boundary. */
  upload: async <T>(path: string, form: FormData, opts?: MutationOptions): Promise<T> => {
    const url = `${API_BASE}${path}`
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'X-CSRFToken': csrfToken(),
        'Idempotency-Key': opts?.idempotencyKey ?? crypto.randomUUID(),
      },
      body: form,
    })
    if (!res.ok) {
      let detail: unknown
      try {
        detail = await res.json()
      } catch {
        detail = await res.text()
      }
      throw new HttpError(res.status, url, `Upload failed: ${res.statusText}`, detail)
    }
    return (await res.json()) as T
  },
}

/** Simulated network latency so loading states are exercised honestly. */
export const delay = (ms = 180) => new Promise<void>((r) => setTimeout(r, api.enabled ? ms : 0))

/** Endpoint constants — single source of truth for the REST paths. */
export const ENDPOINTS = {
  incidents: '/incidents/',
  incidentsAnonymous: '/incidents/anonymous/',
  incident: (id: string) => `/incidents/${id}/`,
  investigations: '/investigations/',
  investigation: (id: string) => `/investigations/${id}/`,
  rca: '/rca/',
  rcaById: (id: string) => `/rca/${id}/`,
  capas: '/capa/',
  capaById: (id: string) => `/capa/${id}/`,
  compliance: '/compliance/requirements/',
  complianceById: (id: string) => `/compliance/requirements/${id}/`,
  complianceSummary: '/compliance/requirements/summary/',
  notifications: '/notifications/',
  audit: '/audit-log/',
  media: '/media/',
  mediaDownload: (id: string) => `/media/${id}/download/`,
  dashboard: '/dashboard/metrics/',
  analytics: '/analytics/',
  users: '/users/',
  aircraft: '/aircraft/',
  authLogin: '/auth/login/',
  authLogout: '/auth/logout/',
  authSession: '/auth/session/',
  authRegister: '/auth/register/',
  authPasswordReset: '/auth/password-reset/',
  authPasswordResetConfirm: '/auth/password-reset/confirm/',
  authInvites: '/auth/invites/',
  authInviteAccept: (token: string) => `/auth/invites/${token}/accept/`,
} as const
