import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../useAuthStore'
import { authApi } from '../../api/auth.api'
import { authStorage } from '../../services/auth-storage'
import { decodeJwtClaims } from '../../services/jwt.utils'
import type { AuthUser, TenantSummary } from '../../interfaces/auth.types'

// ─── Mock queryClient ─────────────────────────────────────────────────────────
const { clearMock } = vi.hoisted(() => ({ clearMock: vi.fn() }))
vi.mock('@/core/shared/api/queryClient', () => ({
  queryClient: { clear: clearMock },
}))

vi.mock('../../api/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    selectTenant: vi.fn(),
    switchTenant: vi.fn(),
    me: vi.fn(),
    mePermissions: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('../../services/auth-storage', () => ({
  authStorage: {
    getAccessToken: vi.fn(() => null),
    getRefreshToken: vi.fn(() => null),
    getUser: vi.fn(() => null),
    getPermissionCodes: vi.fn(() => null),
    getCurrentTenant: vi.fn(() => null),
    getMemberships: vi.fn(() => null),
    getIsSuperAdmin: vi.fn(() => null),
    getTempToken: vi.fn(() => null),
    setTokens: vi.fn(),
    setUser: vi.fn(),
    setPermissionCodes: vi.fn(),
    setCurrentTenant: vi.fn(),
    setMemberships: vi.fn(),
    setIsSuperAdmin: vi.fn(),
    setTempToken: vi.fn(),
    clearPermissionCodes: vi.fn(),
    clearTenantState: vi.fn(),
    clear: vi.fn(),
  },
}))

vi.mock('../../services/jwt.utils', () => ({
  decodeJwtClaims: vi.fn(),
}))

describe('useAuthStore state machine', () => {
  const user: AuthUser = {
    id: 'user-1',
    email: 'user@hound.test',
    name: 'User One',
    isActive: true,
    createdAt: '2026-05-02T00:00:00.000Z',
  }

  const tenants: TenantSummary[] = [
    { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
    { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
  ]

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(authApi.mePermissions).mockResolvedValue({ permissions: [], permissionCodes: [] })
  })

  it('transitions idle -> authenticating -> authenticated for single-tenant login', async () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user-1',
      email: user.email,
      tenantId: tenants[0]!.id,
      tenantSlug: tenants[0]!.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 2,
    })

    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants: [tenants[0]!],
      accessToken: 'access-single',
      refreshToken: 'refresh-single',
    })

    const store = useAuthStore()

    const promise = store.login({ email: user.email, password: 'secret' })

    expect(store.authPhase).toBe('authenticating')

    await promise

    expect(store.authPhase).toBe('authenticated')
    expect(store.currentTenant).toEqual(tenants[0]!)
    expect(store.isSuperAdmin).toBe(false)
  })

  it('transitions idle -> authenticating -> needs-tenant-selection for multi-tenant login', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-token',
      expiresIn: 300,
    })

    const store = useAuthStore()

    const promise = store.login({ email: user.email, password: 'secret' })

    expect(store.authPhase).toBe('authenticating')

    await promise

    expect(store.authPhase).toBe('needs-tenant-selection')
    expect(store.memberships).toEqual(tenants)
    expect(store.tempToken).toBe('temp-token')
  })

  it('transitions idle -> authenticating -> needs-tenant-selection for super-admin global login', async () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user-1',
      email: user.email,
      tenantId: null,
      tenantSlug: null,
      isSuperAdmin: true,
      iat: 1,
      exp: 2,
    })

    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants,
      accessToken: 'access-super',
      refreshToken: 'refresh-super',
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    expect(store.authPhase).toBe('needs-tenant-selection')
    expect(store.isSuperAdmin).toBe(true)
    expect(store.currentTenant).toBeNull()
    expect(store.memberships).toEqual(tenants)
    expect(vi.mocked(authApi.mePermissions)).not.toHaveBeenCalled()
  })

  it('transitions selecting-tenant -> authenticated when tenant selection completes', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-token',
      expiresIn: 300,
    })

    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user-1',
      email: user.email,
      tenantId: tenants[1]!.id,
      tenantSlug: tenants[1]!.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 2,
    })

    vi.mocked(authApi.selectTenant).mockResolvedValue({
      user,
      accessToken: 'selected-access',
      refreshToken: 'selected-refresh',
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    const promise = store.selectTenant(tenants[1]!.id)

    expect(store.authPhase).toBe('selecting-tenant')
    await promise

    expect(store.authPhase).toBe('authenticated')
    expect(store.tempToken).toBeNull()
    expect(store.currentTenant?.id).toBe(tenants[1]!.id)
  })

  it('clearSession wipes tenant state', () => {
    const store = useAuthStore()

    store.memberships = tenants
    store.tempToken = 'temp-token'
    store.currentTenant = tenants[0] ?? null
    store.isSuperAdmin = true
    store.authPhase = 'needs-tenant-selection'

    store.clearSession()

    expect(store.authPhase).toBe('idle')
    expect(store.memberships).toEqual([])
    expect(store.tempToken).toBeNull()
    expect(store.currentTenant).toBeNull()
    expect(store.isSuperAdmin).toBe(false)
  })

  it('setSessionFromTokens decodes claims and updates tenant context', () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user-1',
      email: user.email,
      tenantId: tenants[0]!.id,
      tenantSlug: tenants[0]!.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 2,
    })

    const store = useAuthStore()
    store.setSessionFromTokens('access-1', 'refresh-1')

    expect(decodeJwtClaims).toHaveBeenCalledWith('access-1')
    expect(store.currentTenant).toEqual({ id: tenants[0]!.id, name: '', slug: tenants[0]!.slug })
    expect(store.isSuperAdmin).toBe(false)
    expect(vi.mocked(authStorage.setCurrentTenant)).toHaveBeenCalledWith({
      id: tenants[0]!.id,
      name: '',
      slug: tenants[0]!.slug,
    })
    expect(vi.mocked(authStorage.setIsSuperAdmin)).toHaveBeenCalledWith(false)
  })
})

// ─── CRITICAL 1: switchTenant must clear query cache ─────────────────────────

describe('switchTenant — query cache invalidation', () => {
  const user: AuthUser = {
    id: 'user-1',
    email: 'user@hound.test',
    name: 'User One',
    isActive: true,
    createdAt: '2026-05-02T00:00:00.000Z',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(authApi.mePermissions).mockResolvedValue({ permissions: [], permissionCodes: [] })
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user-1',
      email: user.email,
      tenantId: 'tenant-2',
      tenantSlug: 'norte',
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.switchTenant).mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    })
  })

  it('calls queryClient.clear() after switching tenant', async () => {
    const store = useAuthStore()
    await store.switchTenant('tenant-2')

    expect(clearMock).toHaveBeenCalledOnce()
  })

  it('clears query cache AFTER fetchPermissions completes (not before)', async () => {
    let permissionsCalledBeforeClear = false
    vi.mocked(authApi.mePermissions).mockImplementation(async () => {
      permissionsCalledBeforeClear = !clearMock.mock.calls.length
      return { permissions: [], permissionCodes: [] }
    })

    const store = useAuthStore()
    await store.switchTenant('tenant-2')

    // permissions were called before clear
    expect(permissionsCalledBeforeClear).toBe(true)
    // AND clear was called at least once
    expect(clearMock).toHaveBeenCalledOnce()
  })
})

// ─── CRITICAL 2: login 403 "No active tenants" scenario ──────────────────────

describe('login — 403 no active tenants', () => {
  const user: AuthUser = {
    id: 'user-1',
    email: 'user@hound.test',
    name: 'User One',
    isActive: true,
    createdAt: '2026-05-02T00:00:00.000Z',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('sets authError when login returns 403 with no-active-tenants message', async () => {
    const error403 = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: {
        status: 403,
        data: { message: 'User does not belong to an active tenant' },
      },
    })
    vi.mocked(authApi.login).mockRejectedValue(error403)

    const store = useAuthStore()
    await expect(store.login({ email: user.email, password: 'secret' })).rejects.toThrow()

    expect(store.authError).toBe(
      'No tienes acceso a ninguna sucursal. Contacta al administrador.',
    )
    expect(store.authPhase).toBe('idle')
  })

  it('resets authPhase to idle on 403 no-active-tenants error', async () => {
    const error403 = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: {
        status: 403,
        data: { message: 'User does not belong to an active tenant' },
      },
    })
    vi.mocked(authApi.login).mockRejectedValue(error403)

    const store = useAuthStore()
    try {
      await store.login({ email: user.email, password: 'secret' })
    } catch {
      // expected to throw
    }

    expect(store.authPhase).toBe('idle')
  })

  it('does NOT set authError for other errors (generic 500)', async () => {
    const error500 = Object.assign(new Error('Request failed with status code 500'), {
      isAxiosError: true,
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    })
    vi.mocked(authApi.login).mockRejectedValue(error500)

    const store = useAuthStore()
    try {
      await store.login({ email: user.email, password: 'secret' })
    } catch {
      // expected
    }

    // authError should be null for non-403 errors
    expect(store.authError).toBeNull()
  })
})
