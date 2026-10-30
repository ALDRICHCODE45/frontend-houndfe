import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '../stores/useAuthStore'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import { resetAbility } from '../authorization/ability'
import type { AuthMeResponse } from '../interfaces/auth.types'

vi.mock('../api/auth.api', () => ({ authApi: {
  switchTenant: vi.fn(), mePermissions: vi.fn(), logout: vi.fn(), me: vi.fn(),
  login: vi.fn(), verifyLoginOtp: vi.fn(), selectTenant: vi.fn(),
} }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const user = { id: 'user', email: 'fixture@example.invalid', name: 'Fixture', isActive: true, createdAt: '' }
function token(tenantId: string, suffix = '') {
  return `e30.${btoa(JSON.stringify({ sub: user.id, tenantId, isSuperAdmin: false }))}.${suffix || 'sig'}`
}
function session(tenant = 'a', suffix = '') {
  return { user, accessToken: token(tenant, suffix), refreshToken: `refresh-${tenant}-${suffix}` }
}
const grants = (code = 'read:Order') => ({ permissions: [], permissionCodes: [code] })

describe('session-owned asynchronous auth effects', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    authStorage.clear()
    vi.resetAllMocks()
    resetAbility()
    vi.mocked(authApi.mePermissions).mockResolvedValue(grants())
  })

  it('does not restore old grants after same-account tenant ABA', async () => {
    const store = useAuthStore()
    store.setSession(session())
    const old = deferred<ReturnType<typeof grants>>()
    vi.mocked(authApi.mePermissions).mockReturnValueOnce(old.promise)
    const pending = store.fetchPermissions()
    store.setSession(session('b'))
    store.setSession(session('a'))
    store.setPermissionCodes(['read:Product'])
    old.resolve(grants('manage:all'))
    expect(await pending).toBeNull()
    expect(store.permissionCodes).toEqual(['read:Product'])
    expect(authStorage.getPermissionCodes()).toEqual(['read:Product'])
    expect(store.userCan('manage', 'all')).toBe(false)
  })

  it.each(['success', 'failure'])('ignores late switch %s after logout/relogin', async (outcome) => {
    const store = useAuthStore()
    store.setSession(session())
    const old = deferred<ReturnType<typeof session>>()
    vi.mocked(authApi.switchTenant).mockReturnValueOnce(old.promise)
    const pending = store.switchTenant('b').catch(error => error)
    store.clearSession()
    store.setSession(session('c'))
    store.setPermissionCodes(['read:Product'])
    const before = JSON.stringify(store.$state)
    if (outcome === 'success') old.resolve(session('b'))
    else old.reject(new Error('old transport failure'))
    await pending
    expect(JSON.stringify(store.$state)).toBe(before)
    expect(authStorage.getAccessToken()).toBe(token('c'))
    expect(authStorage.getPermissionCodes()).toEqual(['read:Product'])
    expect(authApi.mePermissions).not.toHaveBeenCalled()
  })

  it('keeps only the latest overlapping switch and its permissions', async () => {
    const store = useAuthStore()
    store.setSession(session())
    const first = deferred<ReturnType<typeof session>>()
    vi.mocked(authApi.switchTenant).mockReturnValueOnce(first.promise).mockResolvedValueOnce(session('c'))
    const pending = store.switchTenant('b').catch(error => error)
    await store.switchTenant('c')
    first.resolve(session('b'))
    await pending
    expect(store.currentTenantId).toBe('c')
    expect(store.permissionCodes).toEqual(['read:Order'])
    expect(authStorage.getAccessToken()).toBe(token('c'))
    expect(authApi.mePermissions).toHaveBeenCalledTimes(1)
  })

  it('rejects late permissions and failures while a newer switch is pending', async () => {
    const store = useAuthStore()
    store.setSession(session())
    const permissions = deferred<ReturnType<typeof grants>>()
    vi.mocked(authApi.mePermissions).mockReturnValueOnce(permissions.promise)
    vi.mocked(authApi.switchTenant).mockResolvedValueOnce(session('b'))
    const first = store.switchTenant('b').catch(error => error)
    await vi.waitFor(() => expect(authApi.mePermissions).toHaveBeenCalledOnce())
    const next = deferred<ReturnType<typeof session>>()
    vi.mocked(authApi.switchTenant).mockReturnValueOnce(next.promise)
    const second = store.switchTenant('c')
    permissions.reject(new Error('old permissions failed'))
    await first
    expect(store.accessToken).toBe(token('b'))
    expect(store.authPhase).toBe('selecting-tenant')
    next.resolve(session('c'))
    await second
    expect(store.currentTenantId).toBe('c')
    expect(store.permissionsLoaded).toBe(true)
  })

  it('rejects old-tenant permissions fetched while a switch exchange was pending', async () => {
    const store = useAuthStore()
    store.setSession(session())
    const exchange = deferred<ReturnType<typeof session>>()
    vi.mocked(authApi.switchTenant).mockReturnValueOnce(exchange.promise)
    const switching = store.switchTenant('b')
    const old = deferred<ReturnType<typeof grants>>()
    vi.mocked(authApi.mePermissions).mockReturnValueOnce(old.promise)
    const pending = store.fetchPermissions()
    exchange.resolve(session('b'))
    await switching
    old.resolve(grants('manage:all'))
    expect(await pending).toBeNull()
    expect(store.currentTenantId).toBe('b')
    expect(store.permissionCodes).toEqual(['read:Order'])
    expect(authStorage.getPermissionCodes()).toEqual(['read:Order'])
  })

  describe.each(['login', 'otp', 'select'] as const)('%s publication interval', (flow) => {
    it.each([
      { read: 'permissions', outcome: 'success' },
      { read: 'permissions', outcome: 'failure' },
      { read: 'profile', outcome: 'success' },
      { read: 'profile', outcome: 'failure' },
    ] as const)('retires late $read $outcome started during bootstrap', async ({ read, outcome }) => {
      const store = useAuthStore()
      store.setSession(session('a', 'old'))
      store.setPermissionCodes(['read:Order'])
      const nextUser = { ...user, name: 'New session profile' }
      const next = { ...session('a', 'new'), user: nextUser }
      const verified = { ...next, requiresTenantSelection: false as const, tenants: [] }
      const bootstrap = deferred<ReturnType<typeof grants>>()
      vi.mocked(authApi.mePermissions).mockReturnValueOnce(bootstrap.promise)
      const credentials = { email: user.email, password: 'synthetic' }
      let completing: Promise<unknown>
      if (flow === 'login') {
        vi.mocked(authApi.login).mockResolvedValueOnce(verified)
        completing = store.login(credentials)
      } else if (flow === 'otp') {
        vi.mocked(authApi.login).mockResolvedValueOnce({
          requiresOtp: true, challengeId: 'publication-proof', expiresIn: 600, resendAfter: 0,
        })
        await store.login(credentials)
        vi.mocked(authApi.verifyLoginOtp).mockResolvedValueOnce(verified)
        completing = store.verifyLoginOtp('001234')
      } else {
        vi.mocked(authApi.login).mockResolvedValueOnce({
          requiresTenantSelection: true, user, tenants: [],
          tempToken: 'selection-proof', expiresIn: 300,
        })
        await store.login(credentials)
        vi.mocked(authApi.selectTenant).mockResolvedValueOnce(next)
        completing = store.selectTenant('a')
      }
      await vi.waitFor(() => {
        expect(authApi.mePermissions).toHaveBeenCalledWith(next.accessToken)
      })
      expect(store.loginBusy).toBe(true)
      expect(store.accessToken).toBe(token('a', 'old'))

      const oldPermissions = deferred<ReturnType<typeof grants>>()
      const oldProfile = deferred<AuthMeResponse>()
      if (read === 'permissions') {
        vi.mocked(authApi.mePermissions).mockReturnValueOnce(oldPermissions.promise)
      } else {
        vi.mocked(authApi.me).mockReturnValueOnce(oldProfile.promise)
      }
      const pending = (read === 'permissions' ? store.fetchPermissions() : store.fetchMe()).then(
        value => ({ status: 'fulfilled', value }),
        error => ({ status: 'rejected', error }),
      )
      bootstrap.resolve(grants('read:Product'))
      expect(await completing).toEqual(flow === 'select' ? undefined : verified)
      expect(store.loginBusy).toBe(false)
      expect(store.otpChallenge).toBeNull()
      expect(store.tempToken).toBeNull()
      expect(store.authPhase).toBe('authenticated')
      expect(store.accessToken).toBe(next.accessToken)
      expect(store.user).toEqual(nextUser)
      expect(store.permissionCodes).toEqual(['read:Product'])
      if (flow === 'otp') {
        expect(authApi.verifyLoginOtp).toHaveBeenCalledExactlyOnceWith({
          challengeId: 'publication-proof', code: '001234',
        })
      }
      const before = JSON.stringify(store.$state)
      const persisted = () => ({
        accessToken: authStorage.getAccessToken(), refreshToken: authStorage.getRefreshToken(),
        user: authStorage.getUser(), permissions: authStorage.getPermissionCodes(),
        tenant: authStorage.getCurrentTenant(), memberships: authStorage.getMemberships(),
      })
      const storedBefore = persisted()
      if (outcome === 'failure') {
        const failure = new Error('old-session read failed')
        if (read === 'permissions') oldPermissions.reject(failure)
        else oldProfile.reject(failure)
      } else if (read === 'permissions') {
        oldPermissions.resolve(grants('manage:all'))
      } else {
        oldProfile.resolve({
          ...user, name: 'Old session profile',
          tenant: { id: 'a', name: 'Old branch', slug: 'old' }, memberships: [],
        })
      }
      expect(await pending).toEqual({ status: 'fulfilled', value: null })
      expect(JSON.stringify(store.$state)).toBe(before)
      expect(persisted()).toEqual(storedBefore)
      expect(store.userCan('manage', 'all')).toBe(false)
      vi.mocked(authApi.mePermissions).mockResolvedValueOnce(grants('read:Product'))
      expect(await store.fetchPermissions()).toEqual(grants('read:Product'))
      expect(store.permissionsLoaded).toBe(true)
      expect(store.loginBusy).toBe(false)
    })
  })

  it('retains current successful permission fetch, switch and persisted hydration', async () => {
    const store = useAuthStore()
    store.setSession(session())
    expect(await store.fetchPermissions()).toEqual(grants())
    expect(store.userCan('read', 'Order')).toBe(true)
    vi.mocked(authApi.switchTenant).mockResolvedValue(session('b'))
    await store.switchTenant('b')
    expect(store.authPhase).toBe('authenticated')
    expect(store.currentTenantId).toBe('b')
    const hydrated = useAuthStore(createPinia())
    hydrated.hydrateFromStorage()
    expect(hydrated.permissionCodes).toEqual(['read:Order'])
    expect(hydrated.currentTenantId).toBe('b')
  })

  it('cannot hydrate grants left behind by a credential replacement', () => {
    const store = useAuthStore()
    store.setSession(session())
    store.setPermissionCodes(['manage:all'])
    store.setSessionFromTokens(token('b'), 'refresh-b')
    const hydrated = useAuthStore(createPinia())
    hydrated.hydrateFromStorage()
    expect(store.permissionsLoaded).toBe(false)
    expect(hydrated.permissionsLoaded).toBe(false)
    expect(hydrated.permissionCodes).toEqual([])
  })

  it.each(['success', 'failure'])('isolates late profile %s across relogin in the same tenant', async (outcome) => {
    const store = useAuthStore()
    store.setSession(session())
    const me = { ...user, tenant: { id: 'a', name: 'Branch', slug: 'a' }, memberships: [] }
    vi.mocked(authApi.me).mockResolvedValueOnce(me)
    expect(await store.fetchMe()).toEqual(me)
    const old = deferred<typeof me>()
    vi.mocked(authApi.me).mockReturnValueOnce(old.promise)
    const pending = store.fetchMe()
    store.clearSession()
    store.setSession(session('a', 'new-login'))
    const before = JSON.stringify(store.$state)
    if (outcome === 'success') old.resolve({ ...me, name: 'Old profile' })
    else old.reject(new Error('old profile failure'))
    expect(await pending).toBeNull()
    expect(JSON.stringify(store.$state)).toBe(before)
    expect(authStorage.getUser()).toEqual(user)
  })

  it('suppresses a stale permission failure but preserves current failure identity', async () => {
    const store = useAuthStore()
    store.setSession(session())
    const old = deferred<ReturnType<typeof grants>>()
    vi.mocked(authApi.mePermissions).mockReturnValueOnce(old.promise)
    const pending = store.fetchPermissions()
    store.setSession(session('c'))
    store.setPermissionCodes(['read:Product'])
    old.reject(new Error('old permission failure'))
    expect(await pending).toBeNull()
    expect(store.permissionCodes).toEqual(['read:Product'])
    const failure = new Error('current permission failure')
    vi.mocked(authApi.mePermissions).mockRejectedValueOnce(failure)
    await expect(store.fetchPermissions()).rejects.toBe(failure)
    expect(store.permissionCodes).toEqual(['read:Product'])
  })

  it.each(['recoverable', 'unrecoverable'])('retains current switch error semantics: %s', async (kind) => {
    const store = useAuthStore()
    store.setSession(session())
    store.setPermissionCodes(['read:Order'])
    const failure = kind === 'recoverable'
      ? { response: { status: 403, data: { code: 'TENANT_ACCESS_DENIED' } } }
      : new Error('network failure')
    vi.mocked(authApi.switchTenant).mockRejectedValueOnce(failure)
    await expect(store.switchTenant('b')).rejects.toBe(failure)
    expect(store.loginBusy).toBe(false)
    if (kind === 'recoverable') {
      expect(store.currentTenantId).toBe('a')
      expect(store.permissionCodes).toEqual(['read:Order'])
      expect(store.authPhase).toBe('authenticated')
    } else {
      expect(store.accessToken).toBeNull()
      expect(authStorage.getAccessToken()).toBeNull()
      expect(store.permissionsLoaded).toBe(false)
    }
  })

  it('does not clear a new login when an old logout finishes', async () => {
    const store = useAuthStore()
    store.setSession(session())
    const old = deferred<{ message: string }>()
    vi.mocked(authApi.logout).mockReturnValueOnce(old.promise)
    const pending = store.logout()
    store.setSession(session('c'))
    old.resolve({ message: 'ok' })
    await pending
    expect(store.accessToken).toBe(token('c'))
    expect(authStorage.getAccessToken()).toBe(token('c'))
  })
})
