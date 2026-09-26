import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/useAuthStore'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import { decodeJwtClaims } from '../services/jwt.utils'
import { ability, resetAbility } from '../authorization/ability'

vi.mock('../api/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    verifyLoginOtp: vi.fn(),
    selectTenant: vi.fn(),
    mePermissions: vi.fn(),
  },
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
  email: 'multi@hound.test',
  name: 'Multi User',
  isActive: true,
  createdAt: '',
}
const tenants = [
  { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
  { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
]

describe('Multi-tenant password → OTP → selection', () => {
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
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'verified-selection',
      expiresIn: 300,
    })
    vi.mocked(authApi.selectTenant).mockResolvedValue({
      user,
      accessToken: 'selected',
      refreshToken: 'refresh',
    })
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: 'tenant-1',
      tenantSlug: 'centro',
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [{ subject: 'Order', action: 'read' }],
      permissionCodes: ['read:Order'],
    })
  })

  async function passwordThenProof() {
    const store = useAuthStore()
    await store.login({ email: user.email, password: 'synthetic' })
    expect(store.tempToken).toBeNull()
    expect(store.memberships).toEqual([])
    expect(authStorage.setTempToken).not.toHaveBeenCalled()
    expect(authApi.mePermissions).not.toHaveBeenCalled()
    await store.verifyLoginOtp('001234')
    return store
  }

  it('populates pending selection only after OTP', async () => {
    const store = await passwordThenProof()
    expect(store.authPhase).toBe('needs-tenant-selection')
    expect(store.memberships).toEqual(tenants)
    expect(store.accessToken).toBeNull()
    expect(authApi.mePermissions).not.toHaveBeenCalled()
  })

  it('persists only the backend-issued verified selection token', async () => {
    const store = await passwordThenProof()
    expect(store.tempToken).toBe('verified-selection')
    expect(authStorage.setTempToken).toHaveBeenCalledWith('verified-selection')
  })

  it('authenticates after tenant exchange', async () => {
    const store = await passwordThenProof()
    await store.selectTenant('tenant-1')
    expect(store.authPhase).toBe('authenticated')
    expect(store.currentTenant).toEqual(tenants[0])
    expect(authApi.selectTenant).toHaveBeenCalledWith({
      tempToken: 'verified-selection',
      tenantId: 'tenant-1',
    })
  })

  it('clears the temporary token after exchange', async () => {
    const store = await passwordThenProof()
    await store.selectTenant('tenant-1')
    expect(store.tempToken).toBeNull()
    expect(authStorage.setTempToken).toHaveBeenLastCalledWith(null)
  })

  it('loads CASL permissions for the selected tenant', async () => {
    const store = await passwordThenProof()
    await store.selectTenant('tenant-1')
    expect(store.permissionsLoaded).toBe(true)
    expect(store.permissionCodes).toEqual(['read:Order'])
    expect(ability.can('read', 'Order')).toBe(true)
    expect(authApi.mePermissions).toHaveBeenCalledWith('selected')
  })

  it.each(['legacy', 'expired', 'unrecognized'])(
    'rejects %s selection and clears pending state without fallback',
    async (token) => {
      const store = useAuthStore()
      store.tempToken = token
      store.memberships = tenants
      const error = { response: { status: 401, data: { code: 'INVALID_TEMP_TOKEN' } } }
      vi.mocked(authApi.selectTenant).mockRejectedValue(error)
      await expect(store.selectTenant('tenant-1')).rejects.toBe(error)
      expect(store.tempToken).toBeNull()
      expect(store.memberships).toEqual([])
      expect(store.authPhase).toBe('idle')
      expect(authApi.selectTenant).toHaveBeenCalledOnce()
      expect(authApi.mePermissions).not.toHaveBeenCalled()
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
    },
  )
})
