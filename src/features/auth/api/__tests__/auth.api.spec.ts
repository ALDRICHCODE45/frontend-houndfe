import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../auth.api'
import { http } from '@/core/shared/api/http'

vi.mock('@/core/shared/api/http', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

const challenge = { requiresOtp: true, challengeId: 'challenge', expiresIn: 600, resendAfter: 60 }

describe('authApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unwraps the password challenge without changing the password DTO', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: challenge })
    const payload = { email: 'user@hound.test', password: 'secret' }
    expect(await authApi.login(payload)).toEqual(challenge)
    expect(http.post).toHaveBeenCalledWith('/auth/login', payload)
  })

  it('verifies a string code, preserving leading zeros', async () => {
    const result = { requiresTenantSelection: true, tempToken: 'verified-selection' }
    vi.mocked(http.post).mockResolvedValue({ data: result })
    expect(await authApi.verifyLoginOtp({ challengeId: 'challenge', code: '001234' })).toEqual(
      result,
    )
    expect(http.post).toHaveBeenCalledWith('/auth/login/otp/verify', {
      challengeId: 'challenge',
      code: '001234',
    })
  })

  it('unwraps the complete replacement challenge', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: challenge })
    expect(await authApi.resendLoginOtp({ challengeId: 'old' })).toEqual(challenge)
    expect(http.post).toHaveBeenCalledWith('/auth/login/otp/resend', { challengeId: 'old' })
  })

  it('opts only the verified-token permissions bootstrap into isolation', async () => {
    const permissions = { permissions: [], permissionCodes: [] }
    vi.mocked(http.get).mockResolvedValue({ data: permissions })
    expect(await authApi.mePermissions('verified')).toEqual(permissions)
    expect(http.get).toHaveBeenCalledWith('/auth/me/permissions', {
      verifiedLoginPermissions: true,
      headers: { Authorization: 'Bearer verified' },
    })
    await authApi.mePermissions()
    expect(http.get).toHaveBeenLastCalledWith('/auth/me/permissions')
  })

  it.each([undefined, null, '', '   ', 123, {}, ['token']])(
    'rejects an explicitly supplied invalid bootstrap token without any request (%j)',
    async (token) => {
      await expect(authApi.mePermissions(token as never)).rejects.toThrow()
      expect(http.get).not.toHaveBeenCalled()
      expect(http.post).not.toHaveBeenCalled()
    },
  )

  it('preserves tenant selection and switching DTOs', async () => {
    vi.mocked(http.post).mockResolvedValue({
      data: { accessToken: 'access', refreshToken: 'refresh' },
    })
    await authApi.selectTenant({ tempToken: 'verified-selection', tenantId: 'tenant' })
    expect(http.post).toHaveBeenCalledWith('/auth/select-tenant', {
      tempToken: 'verified-selection',
      tenantId: 'tenant',
    })
    await authApi.switchTenant({ tenantId: 'tenant' })
    expect(http.post).toHaveBeenCalledWith('/auth/switch-tenant', { tenantId: 'tenant' })
  })
})
