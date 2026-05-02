/**
 * Integration test — Single-tenant full flow
 *
 * Verifies: login() → store authenticated → currentTenant set → CASL permissions loaded
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/useAuthStore'
import { authApi } from '../api/auth.api'
import { decodeJwtClaims } from '../services/jwt.utils'
import { ability } from '../authorization/ability'
import type { AuthUser, TenantSummary } from '../interfaces/auth.types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../api/auth.api', () => ({
  authApi: {
    login: vi.fn(),
    mePermissions: vi.fn(),
    logout: vi.fn(),
  },
}))

vi.mock('../services/auth-storage', () => ({
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
    clear: vi.fn(),
  },
}))

vi.mock('../services/jwt.utils', () => ({
  decodeJwtClaims: vi.fn(),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const user: AuthUser = {
  id: 'user-1',
  email: 'admin@hound.test',
  name: 'Admin User',
  isActive: true,
  createdAt: '2026-05-02T00:00:00.000Z',
}

const tenant: TenantSummary = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Single-tenant full flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login() → authPhase transitions idle → authenticating → authenticated', async () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants: [tenant],
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: ['read:Product', 'read:Order'],
    })

    const store = useAuthStore()

    expect(store.authPhase).toBe('idle')

    const loginPromise = store.login({ email: user.email, password: 'secret' })
    expect(store.authPhase).toBe('authenticating')

    await loginPromise

    expect(store.authPhase).toBe('authenticated')
  })

  it('login() → currentTenant is populated after single-tenant login', async () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants: [tenant],
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: [],
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    expect(store.currentTenant).not.toBeNull()
    expect(store.currentTenant!.id).toBe(tenant.id)
    expect(store.currentTenant!.slug).toBe(tenant.slug)
  })

  it('login() → CASL permissions are loaded from mePermissions response', async () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants: [tenant],
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [{ subject: 'Product', action: 'read' }],
      permissionCodes: ['read:Product'],
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    expect(store.permissionsLoaded).toBe(true)
    expect(store.permissionCodes).toContain('read:Product')
    // CASL ability is updated
    expect(ability.can('read', 'Product')).toBe(true)
  })

  it('login() → mePermissions is called exactly once after successful login', async () => {
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants: [tenant],
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: [],
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    expect(vi.mocked(authApi.mePermissions)).toHaveBeenCalledOnce()
  })
})
