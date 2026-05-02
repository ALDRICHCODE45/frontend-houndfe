/**
 * Integration test — Page refresh hydration (8.3)
 *
 * Seed localStorage with tokens + tenant metadata →
 * call hydrateTenantFromStorage() →
 * verify currentTenant, isSuperAdmin, authPhase === 'authenticated'
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/useAuthStore'
import type { TenantSummary, AuthUser } from '../interfaces/auth.types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// We mock auth-storage to control what "localStorage" returns
const mockStorage: {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  permissionCodes: string[] | null
  currentTenant: TenantSummary | null
  memberships: TenantSummary[] | null
  isSuperAdmin: boolean | null
  tempToken: string | null
} = {
  accessToken: null,
  refreshToken: null,
  user: null,
  permissionCodes: null,
  currentTenant: null,
  memberships: null,
  isSuperAdmin: null,
  tempToken: null,
}

vi.mock('../services/auth-storage', () => ({
  authStorage: {
    getAccessToken: vi.fn(() => mockStorage.accessToken),
    getRefreshToken: vi.fn(() => mockStorage.refreshToken),
    getUser: vi.fn(() => mockStorage.user),
    getPermissionCodes: vi.fn(() => mockStorage.permissionCodes),
    getCurrentTenant: vi.fn(() => mockStorage.currentTenant),
    getMemberships: vi.fn(() => mockStorage.memberships),
    getIsSuperAdmin: vi.fn(() => mockStorage.isSuperAdmin),
    getTempToken: vi.fn(() => mockStorage.tempToken),
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

// updateAbilityFromPermissionCodes is called by setPermissionCodes — mock to avoid CASL side effects
vi.mock('../authorization/ability', () => ({
  ability: { can: vi.fn(() => false) },
  resetAbility: vi.fn(),
  updateAbilityFromPermissionCodes: vi.fn(),
}))

// ─── Fixtures ────────────────────────────────────────────────────────────────

const user: AuthUser = {
  id: 'user-1',
  email: 'hydrate@hound.test',
  name: 'Hydrate User',
  isActive: true,
  createdAt: '2026-05-02T00:00:00.000Z',
}

const tenant: TenantSummary = { id: 'tenant-1', name: 'Sucursal Centro', slug: 'centro' }

const tenants: TenantSummary[] = [
  tenant,
  { id: 'tenant-2', name: 'Sucursal Norte', slug: 'norte' },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Page refresh hydration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Reset mock storage to clean state
    Object.assign(mockStorage, {
      accessToken: null,
      refreshToken: null,
      user: null,
      permissionCodes: null,
      currentTenant: null,
      memberships: null,
      isSuperAdmin: null,
      tempToken: null,
    })
  })

  it('hydrateTenantFromStorage() restores currentTenant from storage', () => {
    mockStorage.currentTenant = tenant
    mockStorage.memberships = tenants
    mockStorage.isSuperAdmin = false

    const store = useAuthStore()
    store.hydrateTenantFromStorage()

    expect(store.currentTenant).toEqual(tenant)
    expect(store.currentTenant!.id).toBe('tenant-1')
    expect(store.currentTenant!.name).toBe('Sucursal Centro')
  })

  it('hydrateTenantFromStorage() restores memberships from storage', () => {
    mockStorage.currentTenant = tenant
    mockStorage.memberships = tenants
    mockStorage.isSuperAdmin = false

    const store = useAuthStore()
    store.hydrateTenantFromStorage()

    expect(store.memberships).toHaveLength(2)
    expect(store.memberships[0]!.id).toBe('tenant-1')
    expect(store.memberships[1]!.id).toBe('tenant-2')
  })

  it('hydrateTenantFromStorage() restores isSuperAdmin from storage', () => {
    mockStorage.currentTenant = null
    mockStorage.memberships = tenants
    mockStorage.isSuperAdmin = true

    const store = useAuthStore()
    store.hydrateTenantFromStorage()

    expect(store.isSuperAdmin).toBe(true)
  })

  it('hydrateFromStorage() sets authPhase to authenticated when accessToken exists', () => {
    mockStorage.accessToken = 'stored-access-tok'
    mockStorage.refreshToken = 'stored-refresh-tok'
    mockStorage.user = user
    mockStorage.currentTenant = tenant
    mockStorage.memberships = tenants
    mockStorage.isSuperAdmin = false
    mockStorage.permissionCodes = ['read:Product']

    const store = useAuthStore()
    store.hydrateFromStorage()

    expect(store.authPhase).toBe('authenticated')
  })

  it('hydrateFromStorage() restores currentTenant when accessToken exists', () => {
    mockStorage.accessToken = 'stored-access-tok'
    mockStorage.refreshToken = 'stored-refresh-tok'
    mockStorage.user = user
    mockStorage.currentTenant = tenant
    mockStorage.memberships = tenants
    mockStorage.isSuperAdmin = false
    mockStorage.permissionCodes = null

    const store = useAuthStore()
    store.hydrateFromStorage()

    expect(store.currentTenant).toEqual(tenant)
  })

  it('hydrateFromStorage() restores super-admin flag from storage', () => {
    mockStorage.accessToken = 'stored-access-tok'
    mockStorage.refreshToken = 'stored-refresh-tok'
    mockStorage.user = user
    mockStorage.currentTenant = null
    mockStorage.memberships = tenants
    mockStorage.isSuperAdmin = true
    mockStorage.permissionCodes = null

    const store = useAuthStore()
    store.hydrateFromStorage()

    expect(store.isSuperAdmin).toBe(true)
  })

  it('hydrateFromStorage() sets authPhase to idle when no accessToken in storage', () => {
    mockStorage.accessToken = null
    mockStorage.currentTenant = tenant
    mockStorage.memberships = tenants

    const store = useAuthStore()
    store.hydrateFromStorage()

    expect(store.authPhase).toBe('idle')
  })
})
