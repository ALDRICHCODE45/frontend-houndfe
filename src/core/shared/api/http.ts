import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { authStorage } from '@/features/auth/services/auth-storage'
import { emitSessionExpired } from '@/features/auth/services/session-events'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000'

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

const authFreePaths = ['/auth/login', '/auth/register', '/auth/refresh']

export const http = axios.create({
  baseURL: API_BASE_URL,
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

    const isAuthFreePath = authFreePaths.some((path) => requestUrl.includes(path))

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
        const refreshResponse = await axios.post<{ accessToken: string; refreshToken: string }>(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken },
        )

        authStorage.setTokens(refreshResponse.data)
        originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.accessToken}`

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
