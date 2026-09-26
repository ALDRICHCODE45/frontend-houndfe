import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/useAuthStore'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import { decodeJwtClaims } from '../services/jwt.utils'
import { ability, resetAbility } from '../authorization/ability'

vi.mock('../api/auth.api', () => ({
  authApi: { login: vi.fn(), verifyLoginOtp: vi.fn(), mePermissions: vi.fn() },
}))
vi.mock('../services/jwt.utils', () => ({ decodeJwtClaims: vi.fn() }))
vi.mock('../services/auth-storage', () => ({
  authStorage: {
    setTokens: vi.fn(),
    setUser: vi.fn(),
    setPermissionCodes: vi.fn(),
    setCurrentTenant: vi.fn(),
    setMemberships: vi.fn(),
    setIsSuperAdmin: vi.fn(),
    setTempToken: vi.fn(),
    clearPermissionCodes: vi.fn(),
    clear: vi.fn(),
  },
}))

const user = {
  id: 'user-1',
  email: 'admin@hound.test',
  name: 'Admin',
  isActive: true,
  createdAt: '',
}
const tenant = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }

describe('Single-tenant password → OTP → final session', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    resetAbility()
    vi.mocked(authApi.login).mockResolvedValue({
      requiresOtp: true,
      challengeId: 'challenge',
      expiresIn: 600,
      resendAfter: 60,
    })
    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants: [tenant],
      accessToken: 'verified',
      refreshToken: 'refresh',
    })
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [{ subject: 'Product', action: 'read' }],
      permissionCodes: ['read:Product'],
    })
  })

  async function passwordThenProof() {
    const store = useAuthStore()
    expect(store.authPhase).toBe('idle')
    const pending = store.login({ email: user.email, password: 'synthetic' })
    expect(store.authPhase).toBe('authenticating')
    await pending
    expect(store.isAuthenticated).toBe(false)
    expect(store.currentTenant).toBeNull()
    expect(store.user).toBeNull()
    expect(authStorage.setTokens).not.toHaveBeenCalled()
    expect(authApi.mePermissions).not.toHaveBeenCalled()
    expect(ability.can('read', 'Product')).toBe(false)
    await store.verifyLoginOtp('001234')
    return store
  }

  it('authenticates only after proof', async () => {
    const store = await passwordThenProof()
    expect(store.authPhase).toBe('authenticated')
    expect(store.otpChallenge).toBeNull()
    expect(authStorage.setTokens).toHaveBeenCalledWith({
      accessToken: 'verified',
      refreshToken: 'refresh',
    })
  })

  it('populates the tenant and user after proof', async () => {
    const store = await passwordThenProof()
    expect(store.currentTenant).toEqual(tenant)
    expect(store.user).toEqual(user)
  })

  it('loads CASL permissions after proof', async () => {
    const store = await passwordThenProof()
    expect(store.permissionsLoaded).toBe(true)
    expect(store.permissionCodes).toEqual(['read:Product'])
    expect(ability.can('read', 'Product')).toBe(true)
  })

  it('bootstraps permissions exactly once with the verified token', async () => {
    await passwordThenProof()
    expect(authApi.mePermissions).toHaveBeenCalledExactlyOnceWith('verified')
  })
})
