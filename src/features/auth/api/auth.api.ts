import { http } from '@/core/shared/api/http'
import type {
  AuthLoginRequest,
  AuthMeResponse,
  AuthTokens,
  LoginResponse,
  SelectTenantRequest,
  SelectTenantResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  UserPermissionsResponse,
} from '../interfaces/auth.types'

export const authApi = {
  async login(payload: AuthLoginRequest) {
    const { data } = await http.post<LoginResponse>('/auth/login', payload)
    return data
  },

  async selectTenant(payload: SelectTenantRequest) {
    const { data } = await http.post<SelectTenantResponse>('/auth/select-tenant', payload)
    return data
  },

  async switchTenant(payload: SwitchTenantRequest) {
    const { data } = await http.post<SwitchTenantResponse>('/auth/switch-tenant', payload)
    return data
  },

  async me() {
    const { data } = await http.get<AuthMeResponse>('/auth/me')
    return data
  },

  async mePermissions() {
    const { data } = await http.get<UserPermissionsResponse>('/auth/me/permissions')
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
