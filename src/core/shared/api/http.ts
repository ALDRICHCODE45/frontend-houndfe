import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { getActivePinia } from 'pinia'
import { authStorage } from '@/features/auth/services/auth-storage'
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
}

const authFreePaths = ['/auth/login', '/auth/register', '/auth/refresh']
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null

export const http = axios.create({
  baseURL: API_BASE_URL,
  paramsSerializer: {
    serialize: csvParamsSerializer,
  },
})

http.interceptors.request.use((config) => {
  if (isVerifiedPermissionsRequest(config)) {
    if (!/^Bearer \S+$/.test(String(config.headers.Authorization ?? ''))) {
      throw new Error('Verified permissions token missing')
    }
  } else {
    const token = authStorage.getAccessToken()
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
    const requestUrl = originalRequest?.url ?? ''
    const jsonMessage = (error.response?.data as { message?: string } | undefined)?.message

    const isTenantSelection =
      originalRequest?.method?.toLowerCase() === 'post' &&
      /^\/auth\/select-tenant\/?(?:[?#].*)?$/.test(requestUrl)
    const isAuthFreePath =
      isTenantSelection || authFreePaths.some((path) => requestUrl.includes(path))

    // This bootstrap belongs to an uncommitted login, never the persisted session.
    if (isVerifiedPermissionsRequest(originalRequest)) return Promise.reject(error)

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
      if (originalRequest?.signal?.aborted) return Promise.reject(error)
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

      const refreshToken = authStorage.getRefreshToken()
      if (!refreshToken) {
        authStorage.clear()
        emitSessionExpired('missing-refresh-token')
        return Promise.reject(error)
      }

      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post<{ accessToken: string; refreshToken: string }>(`${API_BASE_URL}/auth/refresh`, {
              refreshToken,
            })
            .then((res) => res.data)
            .finally(() => {
              refreshPromise = null
            })
        }

        const tokens = await refreshPromise

        authStorage.setTokens(tokens)

        const activePinia = getActivePinia()
        if (activePinia) {
          const authStore = useAuthStore(activePinia)
          authStore.setSessionFromTokens(tokens.accessToken, tokens.refreshToken)
        }

        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`

        return http(originalRequest)
      } catch (refreshError) {
        authStorage.clear()
        emitSessionExpired('refresh-failed')
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
