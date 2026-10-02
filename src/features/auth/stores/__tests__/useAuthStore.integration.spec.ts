import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, disposePinia, setActivePinia, type Pinia } from 'pinia'
import { watch } from 'vue'
import { useAuthStore } from '../useAuthStore'
import { authStorage } from '../../services/auth-storage'
import { decodeJwtClaims } from '../../services/jwt.utils'
import { resetAbility } from '../../authorization/ability'

// Only external effects are mocked. Store, storage, JWT and CASL remain real.
const { blockedApi, clearCache } = vi.hoisted(() => ({
  blockedApi: vi.fn(() => {
    throw new Error('Unexpected auth API call in local baseline')
  }),
  clearCache: vi.fn(),
}))
vi.mock('../../api/auth.api', () => ({
  authApi: {
    login: blockedApi,
    verifyLoginOtp: blockedApi,
    resendLoginOtp: blockedApi,
    selectTenant: blockedApi,
    switchTenant: blockedApi,
    me: blockedApi,
    mePermissions: blockedApi,
    logout: blockedApi,
  },
}))
vi.mock('@/core/shared/api/queryClient', () => ({ queryClient: { clear: clearCache } }))

const tenant = { id: 'tenant-a', name: 'Branch A', slug: 'a' }
const user = {
  id: 'user-a',
  email: 'user@hound.test',
  name: 'User',
  isActive: true,
  createdAt: '2024-01-01',
}
function credentials(tenantId: string | null = tenant.id, isSuperAdmin = false) {
  const claims = {
    sub: user.id,
    email: user.email,
    tenantId,
    tenantSlug: tenantId ? tenant.slug : null,
    isSuperAdmin,
    iat: 1704067200,
    exp: 4102444800,
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return { accessToken: `e30.${payload}.test-signature`, refreshToken: 'opaque-refresh' }
}
function persistSession(permissionCodes: string[] | null) {
  const tokens = credentials()
  authStorage.setTokens(tokens)
  authStorage.setUser(user)
  authStorage.setCurrentTenant(tenant)
  authStorage.setMemberships([tenant])
  authStorage.setIsSuperAdmin(false)
  if (permissionCodes !== null) authStorage.setPermissionCodes(permissionCodes)
  return tokens
}

describe('auth store integration baseline (owner not activated)', () => {
  let pinia: Pinia
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    authStorage.clear()
    resetAbility()
    pinia = createPinia()
    setActivePinia(pinia)
  })
  afterEach(() => {
    disposePinia(pinia)
    resetAbility()
    authStorage.clear()
    expectNoExternalEffects()
  })
  function expectNoExternalEffects() {
    expect(blockedApi).not.toHaveBeenCalled()
    expect(clearCache).not.toHaveBeenCalled()
  }

  it.each([
    { codes: ['read:Product'], loaded: true, canRead: true },
    { codes: [], loaded: true, canRead: false },
    { codes: null, loaded: false, canRead: false },
  ])('hydrates persisted permissions $codes with loaded=$loaded', ({ codes, loaded, canRead }) => {
    const tokens = persistSession(codes)
    const store = useAuthStore()
    store.hydrateFromStorage()
    expect(store.accessToken).toBe(tokens.accessToken)
    expect(store.refreshToken).toBe(tokens.refreshToken)
    expect(store.user).toEqual(user)
    expect(store.currentTenant).toEqual(tenant)
    expect(store.currentTenantId).toBe(tenant.id)
    expect(store.memberships).toEqual([tenant])
    expect(store.isSuperAdmin).toBe(false)
    expect(store.isAuthenticated).toBe(true)
    expect(store.authPhase).toBe('authenticated')
    expect(store.permissionCodes).toEqual(codes ?? [])
    expect(store.permissionsLoaded).toBe(loaded)
    expect(store.userCan('read', 'Product')).toBe(canRead)
    expect(authStorage.getPermissionCodes()).toEqual(codes)
    expect(authStorage.getAccessToken()).toBe(tokens.accessToken)
  })

  it.each([null, 'selection-token'])('hydrates without access credentials (%s)', (tempToken) => {
    authStorage.setTempToken(tempToken)
    authStorage.setPermissionCodes(['read:Product'])
    const store = useAuthStore()
    store.hydrateFromStorage()
    expect(store.isAuthenticated).toBe(false)
    expect(store.tempToken).toBe(tempToken)
    expect(store.authPhase).toBe(tempToken ? 'needs-tenant-selection' : 'idle')
    expect(store.permissionsLoaded).toBe(false)
    expect(store.permissionCodes).toEqual([])
    expect(store.userCan('read', 'Product')).toBe(false)
    expect(authStorage.getPermissionCodes()).toBeNull()
  })

  it('uses real JWT claims and persists the resolved membership context', () => {
    const store = useAuthStore()
    authStorage.setMemberships([tenant])
    store.hydrateTenantFromStorage()
    const tokens = credentials()
    expect(decodeJwtClaims(tokens.accessToken).tenantId).toBe(tenant.id)
    store.setSession({ ...tokens, user })
    expect(store.accessToken).toBe(tokens.accessToken)
    expect(store.refreshToken).toBe(tokens.refreshToken)
    expect(store.currentTenant).toEqual(tenant)
    expect(store.user).toEqual(user)
    expect(authStorage.getAccessToken()).toBe(tokens.accessToken)
    expect(authStorage.getRefreshToken()).toBe(tokens.refreshToken)
    expect(authStorage.getCurrentTenant()).toEqual(tenant)
    expect(authStorage.getUser()).toEqual(user)
  })

  it('persists tenantless administrator claims without inventing a tenant', () => {
    const store = useAuthStore()
    const tokens = credentials(null, true)
    store.setSessionFromTokens(tokens.accessToken, tokens.refreshToken)
    expect(store.currentTenant).toBeNull()
    expect(store.isSuperAdmin).toBe(true)
    expect(authStorage.getCurrentTenant()).toBeNull()
    expect(authStorage.getIsSuperAdmin()).toBe(true)
    expect(authStorage.getRefreshToken()).toBe(tokens.refreshToken)
  })

  it('runs a synchronous credential watcher before the setter returns', () => {
    const store = useAuthStore()
    const tokens = credentials()
    const observed: string[] = []
    const stop = watch(
      () => store.accessToken,
      (value) => {
        observed.push(value ?? 'empty')
      },
      { flush: 'sync' },
    )
    try {
      store.setSessionFromTokens(tokens.accessToken, tokens.refreshToken)
      observed.push('returned')
      expect(observed).toEqual([tokens.accessToken, 'returned'])
      expect(store.refreshToken).toBe(tokens.refreshToken)
      expect(authStorage.getRefreshToken()).toBe(tokens.refreshToken)
    } finally {
      stop()
    }
    // This asserts watcher timing, not atomicity or ownership of legacy setters.
  })

  it('clears hydrated credentials, context and real permission ability', () => {
    persistSession(['read:Product'])
    authStorage.setTempToken('selection-token')
    const store = useAuthStore()
    store.hydrateFromStorage()
    expect(store.userCan('read', 'Product')).toBe(true)
    store.clearSession()
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.user).toBeNull()
    expect(store.currentTenant).toBeNull()
    expect(store.memberships).toEqual([])
    expect(store.tempToken).toBeNull()
    expect(store.isSuperAdmin).toBe(false)
    expect(store.authPhase).toBe('idle')
    expect(store.permissionsLoaded).toBe(false)
    expect(store.userCan('read', 'Product')).toBe(false)
    expect(localStorage.length).toBe(0)
  })
})
