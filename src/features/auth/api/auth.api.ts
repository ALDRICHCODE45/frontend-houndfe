import { http, type VerifiedLoginPermissionsConfig } from '@/core/shared/api/http'
import type {
  AuthLoginRequest,
  AuthMeResponse,
  AuthTokens,
  LoginResponse,
  LoginOtpChallenge,
  VerifyLoginOtpRequest,
  SelectTenantRequest,
  SelectTenantResponse,
  SwitchTenantRequest,
  SwitchTenantResponse,
  UserPermissionsResponse,
} from '../interfaces/auth.types'

export const authApi = {
  async login(payload: AuthLoginRequest) {
    const { data } = await http.post<LoginOtpChallenge>('/auth/login', payload)
    return data
  },

  async verifyLoginOtp(payload: VerifyLoginOtpRequest) {
    const { data } = await http.post<LoginResponse>('/auth/login/otp/verify', payload)
    return data
  },

  async resendLoginOtp(payload: { challengeId: string }) {
    const { data } = await http.post<LoginOtpChallenge>('/auth/login/otp/resend', payload)
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

  async mePermissions(...args: [] | [verifiedToken: string]) {
    // Explicit bootstrap calls never fall back to persisted credentials, even
    // when a malformed runtime value bypasses the required-token tuple type.
    if (args.length > 0) {
      const [verifiedToken] = args
      if (typeof verifiedToken !== 'string' || !/^\S+$/.test(verifiedToken)) {
        throw new Error('Verified token missing')
      }
      const config: VerifiedLoginPermissionsConfig = {
        verifiedLoginPermissions: true,
        headers: { Authorization: `Bearer ${verifiedToken}` },
      }
      const { data } = await http.get<UserPermissionsResponse>('/auth/me/permissions', config)
      return data
    }
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
