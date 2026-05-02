import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '../auth.api'
import { http } from '@/core/shared/api/http'
import type { LoginResponse, SelectTenantResponse, SwitchTenantResponse } from '../../interfaces/auth.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('login returns LoginResponse union payload', async () => {
    const response: LoginResponse = {
      requiresTenantSelection: true,
      user: {
        id: 'user-1',
        email: 'user@hound.test',
        name: 'User One',
        isActive: true,
        createdAt: '2026-05-02T00:00:00.000Z',
      },
      tenants: [{ id: 'tenant-1', name: 'Sucursal Norte', slug: 'sucursal-norte' }],
      tempToken: 'temp-token',
      expiresIn: 300,
    }

    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await authApi.login({ email: 'user@hound.test', password: 'secret' })

    expect(http.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@hound.test',
      password: 'secret',
    })
    expect(result.requiresTenantSelection).toBe(true)
  })

  it('selectTenant exchanges temp token for session', async () => {
    const response: SelectTenantResponse = {
      user: {
        id: 'user-1',
        email: 'user@hound.test',
        name: 'User One',
        isActive: true,
        createdAt: '2026-05-02T00:00:00.000Z',
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    }

    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await authApi.selectTenant({ tempToken: 'temp-token', tenantId: 'tenant-1' })

    expect(http.post).toHaveBeenCalledWith('/auth/select-tenant', {
      tempToken: 'temp-token',
      tenantId: 'tenant-1',
    })
    expect(result.accessToken).toBe('access-token')
  })

  it('switchTenant exchanges current context tokens', async () => {
    const response: SwitchTenantResponse = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }

    vi.mocked(http.post).mockResolvedValue({ data: response })

    const result = await authApi.switchTenant({ tenantId: 'tenant-2' })

    expect(http.post).toHaveBeenCalledWith('/auth/switch-tenant', { tenantId: 'tenant-2' })
    expect(result.refreshToken).toBe('new-refresh-token')
  })
})
