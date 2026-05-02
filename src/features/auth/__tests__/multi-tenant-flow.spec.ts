/**
 * Integration tests — Multi-tenant full flow + tempToken expiry (8.2 + 8.4)
 *
 * 8.2: login() → needs-tenant-selection → selectTenant() → authenticated → CASL loaded
 * 8.4: selectTenant() with expired tempToken → store clears temp state, authPhase resets
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
    selectTenant: vi.fn(),
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
  email: 'multi@hound.test',
  name: 'Multi User',
  isActive: true,
  createdAt: '2026-05-02T00:00:00.000Z',
}

const tenants: TenantSummary[] = [
  { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' },
  { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Multi-tenant full flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('login() → authPhase becomes needs-tenant-selection with memberships populated', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-abc',
      expiresIn: 300,
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    expect(store.authPhase).toBe('needs-tenant-selection')
    expect(store.memberships).toHaveLength(2)
    expect(store.memberships[0]!.id).toBe('tenant-1')
    expect(store.memberships[1]!.id).toBe('tenant-2')
  })

  it('login() → tempToken is stored when tenant selection is required', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-abc',
      expiresIn: 300,
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    expect(store.tempToken).toBe('temp-abc')
  })

  it('selectTenant() → authPhase transitions to authenticated after token exchange', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-abc',
      expiresIn: 300,
    })
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenants[1]!.id,
      tenantSlug: tenants[1]!.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.selectTenant).mockResolvedValue({
      user,
      accessToken: 'selected-access',
      refreshToken: 'selected-refresh',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: [],
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })
    await store.selectTenant(tenants[1]!.id)

    expect(store.authPhase).toBe('authenticated')
  })

  it('selectTenant() → tempToken is cleared after successful selection', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-abc',
      expiresIn: 300,
    })
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenants[0]!.id,
      tenantSlug: tenants[0]!.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.selectTenant).mockResolvedValue({
      user,
      accessToken: 'selected-access',
      refreshToken: 'selected-refresh',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: [],
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })
    await store.selectTenant(tenants[0]!.id)

    expect(store.tempToken).toBeNull()
  })

  it('selectTenant() → CASL permissions are loaded after tenant selection', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'temp-abc',
      expiresIn: 300,
    })
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: user.id,
      email: user.email,
      tenantId: tenants[0]!.id,
      tenantSlug: tenants[0]!.slug,
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
    vi.mocked(authApi.selectTenant).mockResolvedValue({
      user,
      accessToken: 'selected-access',
      refreshToken: 'selected-refresh',
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [{ subject: 'Order', action: 'read' }],
      permissionCodes: ['read:Order'],
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })
    await store.selectTenant(tenants[0]!.id)

    expect(store.permissionsLoaded).toBe(true)
    expect(store.permissionCodes).toContain('read:Order')
    expect(ability.can('read', 'Order')).toBe(true)
  })

  // ── 8.4 tempToken expiry ──────────────────────────────────────────────────

  it('selectTenant() with INVALID_TEMP_TOKEN → throws error', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'expired-temp',
      expiresIn: 300,
    })

    const expiredError = Object.assign(new Error('Request failed with status code 401'), {
      isAxiosError: true,
      response: {
        status: 401,
        data: { code: 'INVALID_TEMP_TOKEN', message: 'Temp token has expired' },
      },
    })

    vi.mocked(authApi.selectTenant).mockRejectedValue(expiredError)

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    await expect(store.selectTenant(tenants[0]!.id)).rejects.toThrow()
  })

  it('selectTenant() with INVALID_TEMP_TOKEN → tempToken is cleared', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'expired-temp',
      expiresIn: 300,
    })

    const expiredError = Object.assign(new Error('Request failed with status code 401'), {
      isAxiosError: true,
      response: {
        status: 401,
        data: { code: 'INVALID_TEMP_TOKEN', message: 'Temp token has expired' },
      },
    })

    vi.mocked(authApi.selectTenant).mockRejectedValue(expiredError)

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    try {
      await store.selectTenant(tenants[0]!.id)
    } catch {
      // expected
    }

    expect(store.tempToken).toBeNull()
  })

  it('selectTenant() with INVALID_TEMP_TOKEN → authPhase resets to idle', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      requiresTenantSelection: true,
      user,
      tenants,
      tempToken: 'expired-temp',
      expiresIn: 300,
    })

    const expiredError = Object.assign(new Error('Request failed with status code 401'), {
      isAxiosError: true,
      response: {
        status: 401,
        data: { code: 'INVALID_TEMP_TOKEN', message: 'Temp token has expired' },
      },
    })

    vi.mocked(authApi.selectTenant).mockRejectedValue(expiredError)

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })

    try {
      await store.selectTenant(tenants[0]!.id)
    } catch {
      // expected
    }

    expect(store.authPhase).toBe('idle')
  })
})
