import { http } from '@/core/shared/api/http'
import type { AuthLoginRequest, AuthResponse, AuthTokens, AuthUser } from '../interfaces/auth.types'

export const authApi = {
  async login(payload: AuthLoginRequest) {
    const { data } = await http.post<AuthResponse>('/auth/login', payload)
    return data
  },

  async me() {
    const { data } = await http.get<AuthUser>('/auth/me')
    return data
  },

  async refresh(refreshToken: string) {
    const { data } = await http.post<AuthTokens>('/auth/refresh', { refreshToken })
    return data
  },

  async logout() {
    const { data } = await http.post<{ message: string }>('/auth/logout')
    return data
  },
}
