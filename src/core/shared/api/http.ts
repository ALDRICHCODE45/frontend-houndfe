import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getActivePinia } from 'pinia'
import { authStorage } from '@/features/auth/services/auth-storage'
import { emitSessionExpired } from '@/features/auth/services/session-events'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { csvParamsSerializer } from './paramsSerializer'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000'

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
  const token = authStorage.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined
    const requestUrl = originalRequest?.url ?? ''
    const message = (error.response?.data as { message?: string } | undefined)?.message

    const isAuthFreePath = authFreePaths.some((path) => requestUrl.includes(path))

    if (error.response?.status === 401 && message === 'Tenant context required') {
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
