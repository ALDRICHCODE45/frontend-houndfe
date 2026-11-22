import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { getActivePinia } from 'pinia'
import { authStorage, type SessionRotationReceipt } from '@/features/auth/services/auth-storage'
import { decodeJwtClaims } from '@/features/auth/services/jwt.utils'
import { isSessionSealed } from '@/features/auth/services/session-seal'
import { emitSessionExpired } from '@/features/auth/services/session-events'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { csvParamsSerializer } from './paramsSerializer'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000'

export interface VerifiedLoginPermissionsConfig extends AxiosRequestConfig {
  verifiedLoginPermissions: true
}

function isVerifiedPermissionsRequest(config?: AxiosRequestConfig) {
  return (
    (config as Partial<VerifiedLoginPermissionsConfig> | undefined)?.verifiedLoginPermissions ===
      true &&
    config?.url === '/auth/me/permissions' &&
    (config.method ?? 'get').toLowerCase() === 'get'
  )
}

/**
 * The logout call of an already fenced (sealed) session. It carries the credentials captured
 * before the fence in its own Authorization header, is never given stored ones and never
 * starts a refresh, proactively or on a 401.
 */
export interface ExplicitLogoutConfig extends AxiosRequestConfig {
  explicitLogoutCredentials: true
}

function isExplicitLogoutRequest(config?: AxiosRequestConfig) {
  return (
    (config as Partial<ExplicitLogoutConfig> | undefined)?.explicitLogoutCredentials === true &&
    config?.url === '/auth/logout' &&
    (config.method ?? 'get').toLowerCase() === 'post'
  )
}

/**
 * Request opt-in for `responseType: 'blob'` calls whose 401 body still carries
 * the backend `message`. `responseType: 'blob'` hides that message from the
 * synchronous `response.data.message` read, so without this flag a
 * `Tenant context required` 401 would take the refresh path instead of the
 * tenant-required path. Only the caller that sets it is affected.
 */
export interface TenantContextBlobErrorConfig extends AxiosRequestConfig {
  tenantContextBlobError: true
}

function isTenantContextBlobErrorRequest(config?: AxiosRequestConfig) {
  return (
    (config as Partial<TenantContextBlobErrorConfig> | undefined)?.tenantContextBlobError === true
  )
}

/** Upper bound on an error body we are willing to read from a Blob. */
const TENANT_CONTEXT_BLOB_MAX_BYTES = 4 * 1024

/**
 * Recover `response.data.message` for an opted-in Blob 401.
 *
 * Strictly bounded and defensive: a non-opted-in request, a non-401 response, a
 * non-Blob body, an oversized blob, an already-aborted signal, invalid JSON or a
 * non-object/non-string `message` all yield `undefined`, which leaves the
 * ordinary 401 handling untouched. The error and its response are never mutated,
 * so the original Axios error/config still reach the refresh retry and the
 * feature's own normalization.
 */
async function readTenantContextBlobMessage(
  error: AxiosError,
  config?: RetryableRequestConfig,
): Promise<string | undefined> {
  const response = error.response
  if (!isTenantContextBlobErrorRequest(config) || response?.status !== 401) return undefined
  if (config?.signal?.aborted) return undefined

  const data: unknown = response.data
  if (!(data instanceof Blob) || data.size > TENANT_CONTEXT_BLOB_MAX_BYTES) return undefined

  try {
    const parsed: unknown = JSON.parse(await data.text())
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
    const message = (parsed as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
  } catch {
    return undefined
  }
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _sessionGeneration?: number
}

const authFreePaths = ['/auth/login', '/auth/register', '/auth/refresh']
/** An access token expiring within this window is refreshed before the request is sent. */
const ACCESS_TOKEN_EXPIRY_SKEW_MS = 10_000
let refreshFlight: { generation: number; promise: Promise<SessionRotationReceipt | null> } | null =
  null

function isAuthFreeRequest(config?: AxiosRequestConfig) {
  const url = config?.url ?? ''
  const isTenantSelection =
    config?.method?.toLowerCase() === 'post' && /^\/auth\/select-tenant\/?(?:[?#].*)?$/.test(url)
  return isTenantSelection || authFreePaths.some((path) => url.includes(path))
}

/** True only for a readable JWT `exp` that is past or inside the skew window. */
export function isAccessTokenExpiring(token: string): boolean {
  try {
    const { exp } = decodeJwtClaims(token) as { exp?: unknown }
    return (
      typeof exp === 'number' &&
      Number.isFinite(exp) &&
      exp * 1000 <= Date.now() + ACCESS_TOKEN_EXPIRY_SKEW_MS
    )
  } catch {
    return false
  }
}

function bearerToken(config?: AxiosRequestConfig): string | null {
  return /^Bearer (\S+)$/.exec(String(config?.headers?.Authorization ?? ''))?.[1] ?? null
}

/**
 * Start (or join) the single refresh of `generation`. A superseded session resolves
 * `null`; a failure of the still-current session logs out exactly once, here, so every
 * joiner only has to reject.
 */
function refreshSession(
  generation: number,
  refreshToken: string,
): Promise<SessionRotationReceipt | null> {
  if (refreshFlight && refreshFlight.generation === generation) return refreshFlight.promise
  const isCurrent = () => generation === authStorage.getSessionGeneration()
  const flight = {
    generation,
    promise: axios
      .post<{ accessToken: string; refreshToken: string }>(`${API_BASE_URL}/auth/refresh`, {
        refreshToken,
      })
      .then((res) => {
        if (!isCurrent()) return null
        const receipt = authStorage.commitRotation(generation, res.data)
        if (!receipt) throw new Error('Invalid session rotation')
        const activePinia = getActivePinia()
        if (activePinia) useAuthStore(activePinia).applySessionRotation(receipt)
        return receipt
      })
      .catch((refreshError: unknown) => {
        if (isCurrent()) {
          authStorage.clear()
          emitSessionExpired('refresh-failed')
        }
        throw refreshError
      })
      .finally(() => {
        if (refreshFlight === flight) refreshFlight = null
      }),
  }
  refreshFlight = flight
  return flight.promise
}

/**
 * Renew the current session's access token through the shared refresh (same generation,
 * same `commitRotation` path) so a call that must reach the server, such as logout, does
 * not go out expired. Resolves the new token, or `null` when the refresh failed (the
 * session was then ended here, as for any failed refresh) or the session changed.
 */
export async function renewAccessToken(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken()
  if (!refreshToken) return null
  try {
    return (
      (await refreshSession(authStorage.getSessionGeneration(), refreshToken))?.accessToken ?? null
    )
  } catch {
    return null
  }
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  paramsSerializer: {
    serialize: csvParamsSerializer,
  },
})

http.interceptors.request.use(async (config: RetryableRequestConfig) => {
  const generation = authStorage.getSessionGeneration()
  if (config._sessionGeneration !== undefined && config._sessionGeneration !== generation) {
    throw new axios.CanceledError('Session changed')
  }
  config._sessionGeneration = generation
  if (isVerifiedPermissionsRequest(config)) {
    if (!/^Bearer \S+$/.test(String(config.headers.Authorization ?? ''))) {
      throw new Error('Verified permissions token missing')
    }
  } else if (isExplicitLogoutRequest(config)) {
    if (!/^Bearer \S+$/.test(String(config.headers.Authorization ?? ''))) {
      throw new Error('Logout token missing')
    }
  } else {
    // A logout is ending this session: nothing else goes out with its tokens, so no 401
    // (and no refresh) can come back for it. Auth-free calls such as a new login still pass.
    if (isSessionSealed() && !isAuthFreeRequest(config)) {
      throw new axios.CanceledError('Session ending')
    }
    let token = authStorage.getAccessToken()
    const refreshToken = authStorage.getRefreshToken()
    if (
      token &&
      refreshToken &&
      !config._retry &&
      !isAuthFreeRequest(config) &&
      isAccessTokenExpiring(token)
    ) {
      const rotated = await refreshSession(generation, refreshToken)
      if (!rotated || generation !== authStorage.getSessionGeneration() || config.signal?.aborted) {
        throw new axios.CanceledError('Session changed')
      }
      token = rotated.accessToken
    }
    if (token) config.headers.Authorization = `Bearer ${token}`
  }

  // Disable HTTP cache on authenticated GETs.
  // TanStack Query already handles client-side caching; HTTP-level 304s with
  // stale bodies break cache-invalidation after mutations (e.g. a fresh
  // salary-history GET after POST returning the previous empty array).
  if ((config.method ?? 'get').toLowerCase() === 'get') {
    config.headers['Cache-Control'] = 'no-cache'
    config.headers.Pragma = 'no-cache'
  }

  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    const jsonMessage = (error.response?.data as { message?: string } | undefined)?.message

    const isAuthFreePath = isAuthFreeRequest(originalRequest)

    // This bootstrap belongs to an uncommitted login, never the persisted session.
    if (isVerifiedPermissionsRequest(originalRequest)) return Promise.reject(error)
    // The logout call never refreshes or expires the session it is ending.
    if (isExplicitLogoutRequest(originalRequest)) return Promise.reject(error)

    const generation = originalRequest?._sessionGeneration ?? authStorage.getSessionGeneration()
    const isCurrent = () => generation === authStorage.getSessionGeneration()
    if (!isCurrent() || isSessionSealed() || originalRequest?.signal?.aborted) {
      return Promise.reject(error)
    }

    // A Blob 401 (opted-in) hides its message from the synchronous read above:
    // recover it from a bounded JSON read so the tenant-context case is
    // classified before the refresh flow. Any other request is unchanged.
    let message = typeof jsonMessage === 'string' ? jsonMessage : undefined
    if (
      message === undefined &&
      error.response?.status === 401 &&
      isTenantContextBlobErrorRequest(originalRequest)
    ) {
      message = await readTenantContextBlobMessage(error, originalRequest)
      // The read is async: if the request was cancelled while it ran, the
      // cancelled work must not produce global side effects (a session-expired
      // event, a refresh attempt or an auth clear). Reject the original error
      // untouched, with no further async gap before this decision.
      if (!isCurrent() || originalRequest?.signal?.aborted) return Promise.reject(error)
    }

    if (
      !isAuthFreePath &&
      error.response?.status === 401 &&
      message === 'Tenant context required'
    ) {
      emitSessionExpired('tenant-required')
      return Promise.reject(error)
    }

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthFreePath
    ) {
      originalRequest._retry = true

      // The token this request carried was already rotated: replay once with the
      // current one; only a 401 sent with the current token may refresh.
      const sentToken = bearerToken(originalRequest)
      const currentToken = authStorage.getAccessToken()
      if (sentToken && currentToken && sentToken !== currentToken) {
        originalRequest._sessionGeneration = generation
        originalRequest.headers.Authorization = `Bearer ${currentToken}`
        return http(originalRequest)
      }

      const refreshToken = authStorage.getRefreshToken()
      if (!refreshToken) {
        authStorage.clear()
        emitSessionExpired('missing-refresh-token')
        return Promise.reject(error)
      }

      // A failed refresh already logged out (once) inside `refreshSession`.
      const tokens = await refreshSession(generation, refreshToken)
      if (!tokens || !isCurrent() || originalRequest.signal?.aborted) return Promise.reject(error)
      originalRequest._sessionGeneration = generation
      originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`
      return http(originalRequest)
    }

    return Promise.reject(error)
  },
)
