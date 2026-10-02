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
    verifyLoginOtp: vi.fn(),
    resendLoginOtp: vi.fn(),
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

const challenge = {
  requiresOtp: true as const,
  challengeId: 'same-handle',
  expiresIn: 600,
  resendAfter: 0,
}
const credentials = { email: 'user@hound.test', password: 'secret' }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('mandatory OTP boundary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    vi.mocked(authApi.login).mockResolvedValue(challenge)
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user',
      email: credentials.email,
      tenantId: 'tenant',
      tenantSlug: 'tenant',
      isSuperAdmin: false,
      iat: 1,
      exp: 2,
    })
    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: ['product.read'],
    })
  })

  const session = {
    requiresTenantSelection: false as const,
    accessToken: 'verified',
    refreshToken: 'refresh',
    user: { id: 'user', email: credentials.email, name: 'User', isActive: true, createdAt: '' },
    tenants: [],
  }

  it('holds only a challenge after password, without session/storage/permissions', async () => {
    const store = useAuthStore()
    await store.login(credentials)
    expect(store.otpChallenge?.challengeId).toBe(challenge.challengeId)
    expect(store.accessToken).toBeNull()
    expect(store.user).toBeNull()
    expect(store.tempToken).toBeNull()
    expect(authApi.mePermissions).not.toHaveBeenCalled()
    for (const [name, fn] of Object.entries(authStorage)) {
      if (name.startsWith('set') || name.startsWith('clear')) expect(fn).not.toHaveBeenCalled()
    }
  })

  async function existingSession() {
    const store = useAuthStore()
    store.setSession({
      accessToken: 'existing',
      refreshToken: 'existing-refresh',
      user: session.user,
    })
    store.setPermissionCodes(['read:Product'])
    vi.clearAllMocks()
    await store.login(credentials)
    return store
  }

  function expectExistingSession(store: ReturnType<typeof useAuthStore>) {
    expect(store.accessToken).toBe('existing')
    expect(store.refreshToken).toBe('existing-refresh')
    expect(store.user).toEqual(session.user)
    expect(store.permissionCodes).toEqual(['read:Product'])
    expect(store.userCan('read', 'Product')).toBe(true)
    expect(authStorage.setTokens).not.toHaveBeenCalled()
    expect(authStorage.setUser).not.toHaveBeenCalled()
    expect(authStorage.setPermissionCodes).not.toHaveBeenCalled()
    expect(authStorage.clear).not.toHaveBeenCalled()
  }

  const badTokens = [undefined, null, '', ' ', 123, {}]
  it.each(
    badTokens.flatMap((value) =>
      ['accessToken', 'refreshToken'].map((field) => ({ field, value })),
    ),
  )(
    'rejects malformed final-session $field ($value) before bootstrap or commit',
    async ({ field, value }) => {
      const store = await existingSession()
      vi.mocked(authApi.verifyLoginOtp).mockResolvedValue({ ...session, [field]: value } as never)
      await expect(store.verifyLoginOtp('001234')).rejects.toThrow()
      expectExistingSession(store)
      expect(authApi.mePermissions).not.toHaveBeenCalled()
      expect(authStorage.setMemberships).not.toHaveBeenCalled()
      expect(authStorage.setTempToken).not.toHaveBeenCalled()
      expect(store.otpRestartRequired).toBe(true)
      expect(store.otpChallenge).toBeNull()
    },
  )

  const selection = {
    requiresTenantSelection: true,
    user: session.user,
    tenants: [],
    tempToken: 'selection',
    expiresIn: 300,
  }
  it.each([
    null,
    {},
    { ...session, requiresTenantSelection: undefined },
    { ...session, user: null },
    { ...session, user: { ...session.user, isActive: 'yes' } },
    { ...session, tenants: null },
    { ...session, tenants: [{}] },
    { requiresTenantSelection: false, user: session.user, tenants: [] },
    { requiresTenantSelection: true, user: session.user, tenants: [] },
    ...badTokens.map((tempToken) => ({ ...selection, tempToken })),
    { ...selection, user: { id: 'incomplete' } },
    { ...selection, tenants: [null] },
    { ...selection, expiresIn: undefined },
    { ...selection, expiresIn: '300' },
  ])('rejects malformed login-result envelope %# without partial mutation', async (response) => {
    const store = await existingSession()
    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue(response as never)
    await expect(store.verifyLoginOtp('001234')).rejects.toThrow()
    expectExistingSession(store)
    expect(authApi.mePermissions).not.toHaveBeenCalled()
    expect(authStorage.setTempToken).not.toHaveBeenCalled()
    expect(authStorage.setMemberships).not.toHaveBeenCalled()
    expect(store.otpRestartRequired).toBe(true)
  })

  it.each([
    { user: session.user },
    ...badTokens.flatMap((value) =>
      ['accessToken', 'refreshToken'].map((field) => ({ ...session, [field]: value })),
    ),
    { ...session, user: undefined },
  ])(
    'rejects malformed select response %# without ordinary bootstrap or session replacement',
    async (response) => {
      const store = await existingSession()
      store.cancelLogin()
      store.tempToken = 'pending-selection'
      vi.mocked(authApi.selectTenant).mockResolvedValue(response as never)
      await expect(store.selectTenant('tenant')).rejects.toMatchObject({
        response: { status: 401 },
      })
      expectExistingSession(store)
      expect(authApi.mePermissions).not.toHaveBeenCalled()
      expect(store.tempToken).toBeNull()
      expect(authStorage.setTempToken).toHaveBeenCalledExactlyOnceWith(null)
    },
  )

  it.each([
    undefined,
    null,
    {},
    { permissionCodes: null },
    { permissionCodes: 'read:Product' },
    { permissionCodes: [123] },
  ])(
    'rejects malformed permissions %# before final or selection session commit',
    async (permissions) => {
      for (const kind of ['verify', 'select']) {
        setActivePinia(createPinia())
        const store = await existingSession()
        vi.mocked(authApi.mePermissions).mockResolvedValue(permissions as never)
        vi.mocked(authApi.verifyLoginOtp).mockResolvedValue(session)
        vi.mocked(authApi.selectTenant).mockResolvedValue(session)
        if (kind === 'verify') {
          await expect(store.verifyLoginOtp('001234')).rejects.toThrow()
          expect(store.otpRestartRequired).toBe(true)
        } else {
          store.cancelLogin()
          store.tempToken = 'pending-selection'
          await expect(store.selectTenant('tenant')).rejects.toMatchObject({
            response: { status: 401 },
          })
          expect(store.tempToken).toBeNull()
        }
        expectExistingSession(store)
        expect(authApi.mePermissions).toHaveBeenCalledExactlyOnceWith('verified')
      }
    },
  )

  it('rejects legacy direct password sessions fail closed', async () => {
    vi.mocked(authApi.login).mockResolvedValue(session as never)
    const store = useAuthStore()
    await expect(store.login(credentials)).rejects.toThrow()
    expect(store.accessToken).toBeNull()
    expect(authStorage.setTokens).not.toHaveBeenCalled()
  })

  it('preserves zeros and prepares permissions with the verified token before commit', async () => {
    const store = useAuthStore()
    await store.login(credentials)
    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue(session)
    const permissions = deferred<{ permissions: []; permissionCodes: string[] }>()
    vi.mocked(authApi.mePermissions).mockReturnValue(permissions.promise)
    const pending = store.verifyLoginOtp(' 001234 ')
    await Promise.resolve()
    expect(authApi.verifyLoginOtp).toHaveBeenCalledWith({
      challengeId: challenge.challengeId,
      code: '001234',
    })
    expect(authApi.mePermissions).toHaveBeenCalledWith('verified')
    expect(authStorage.setTokens).not.toHaveBeenCalled()
    permissions.resolve({ permissions: [], permissionCodes: ['product.read'] })
    await expect(pending).resolves.toEqual(session)
    expect(store.accessToken).toBe('verified')
    expect(store.permissionCodes).toEqual(['product.read'])
  })

  it.each(['12345', '1234567', '１２３４５６', '12 3456', 'abcdef'])(
    'rejects invalid code %s locally',
    async (code) => {
      const store = useAuthStore()
      await store.login(credentials)
      await expect(store.verifyLoginOtp(code)).rejects.toThrow()
      expect(authApi.verifyLoginOtp).not.toHaveBeenCalled()
    },
  )

  it('guards synchronous duplicate and cross-operation requests', async () => {
    const store = useAuthStore()
    const login = deferred<typeof challenge>()
    vi.mocked(authApi.login).mockReturnValue(login.promise)
    const first = store.login(credentials)
    await expect(store.login(credentials)).resolves.toBeNull()
    login.resolve(challenge)
    await first
    const verify = deferred<typeof session>()
    vi.mocked(authApi.verifyLoginOtp).mockReturnValue(verify.promise)
    const pending = store.verifyLoginOtp('001234')
    await expect(store.verifyLoginOtp('001234')).resolves.toBeNull()
    await expect(store.resendLoginOtp()).resolves.toBeNull()
    expect(authApi.verifyLoginOtp).toHaveBeenCalledTimes(1)
    expect(authApi.resendLoginOtp).not.toHaveBeenCalled()
    verify.resolve(session)
    await pending
  })

  it.each(['resolve', 'reject'] as const)(
    'fences stale password %s/finally across an ABA restart',
    async (outcome) => {
      const store = useAuthStore()
      const old = deferred<typeof challenge>()
      vi.mocked(authApi.login).mockReturnValueOnce(old.promise)
      const pending = store.login(credentials)
      store.cancelLogin()
      await store.login(credentials)
      const current = deferred<typeof session>()
      vi.mocked(authApi.verifyLoginOtp).mockReturnValue(current.promise)
      const verifying = store.verifyLoginOtp('001234')
      if (outcome === 'resolve') old.resolve(challenge)
      else old.reject(new Error('old'))
      await expect(pending).resolves.toBeNull()
      expect(store.loginBusy).toBe(true)
      expect(store.otpError).toBeNull()
      current.resolve(session)
      await verifying
    },
  )

  it.each(['resolve', 'reject'] as const)(
    'fences permission %s after cancellation, preserving a newer session',
    async (outcome) => {
      const store = useAuthStore()
      await store.login(credentials)
      vi.mocked(authApi.verifyLoginOtp).mockResolvedValue(session)
      const permissions = deferred<{ permissions: []; permissionCodes: string[] }>()
      vi.mocked(authApi.mePermissions).mockReturnValue(permissions.promise)
      const pending = store.verifyLoginOtp('001234')
      await Promise.resolve()
      store.cancelLogin()
      store.setSessionFromTokens('newer', 'newer-refresh')
      vi.mocked(authStorage.setTokens).mockClear()
      if (outcome === 'resolve') permissions.resolve({ permissions: [], permissionCodes: ['old'] })
      else permissions.reject(new Error('old failure'))
      await expect(pending).resolves.toBeNull()
      expect(store.accessToken).toBe('newer')
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(store.permissionCodes).toEqual([])
    },
  )

  it('cancels pending OTP without logging out a valid session', async () => {
    const store = useAuthStore()
    store.setSessionFromTokens('existing', 'refresh')
    await store.login(credentials)
    store.cancelLogin()
    expect(store.accessToken).toBe('existing')
    expect(store.otpChallenge).toBeNull()
    expect(authStorage.clear).not.toHaveBeenCalled()
  })

  it('atomically replaces resend envelope and measures seconds from response', async () => {
    const store = useAuthStore()
    const now = vi.spyOn(Date, 'now').mockReturnValue(10000)
    await store.login(credentials)
    vi.mocked(authApi.resendLoginOtp).mockResolvedValue({
      ...challenge,
      challengeId: 'replacement',
      expiresIn: 90,
      resendAfter: 20,
    })
    await store.resendLoginOtp()
    expect(store.otpChallenge).toEqual({
      requiresOtp: true,
      challengeId: 'replacement',
      expiresIn: 90,
      resendAfter: 20,
      expiresAt: 100000,
      resendAt: 30000,
    })
    await expect(store.resendLoginOtp()).resolves.toBeNull()
    expect(authApi.resendLoginOtp).toHaveBeenCalledTimes(1)
    now.mockRestore()
  })

  it.each([401, 503, 0])('requires restart after resend failure %s', async (status) => {
    const store = useAuthStore()
    await store.login(credentials)
    vi.mocked(authApi.resendLoginOtp).mockRejectedValue(
      status ? { response: { status } } : new Error('Network'),
    )
    await expect(store.resendLoginOtp()).rejects.toBeDefined()
    expect(store.otpChallenge).toBeNull()
    expect(store.otpRestartRequired).toBe(true)
  })

  it('retains the handle on resend 429 and uses retryAfter seconds', async () => {
    const store = useAuthStore()
    await store.login(credentials)
    vi.mocked(authApi.resendLoginOtp).mockRejectedValue({
      response: { status: 429, data: { retryAfter: 25 } },
    })
    const now = Date.now()
    await expect(store.resendLoginOtp()).rejects.toBeDefined()
    expect(store.otpChallenge?.challengeId).toBe(challenge.challengeId)
    expect(store.otpChallenge!.resendAt).toBeGreaterThanOrEqual(now + 25000)
    expect(store.otpRestartRequired).toBe(false)
  })

  it('uses a generic verify 401 without exposing backend details', async () => {
    const store = useAuthStore()
    await store.login(credentials)
    vi.mocked(authApi.verifyLoginOtp).mockRejectedValue({
      response: { status: 401, data: { message: 'Exhausted 3 attempts' } },
    })
    await expect(store.verifyLoginOtp('001234')).rejects.toBeDefined()
    expect(store.otpError).toBe(
      'No se pudo verificar el código. Intenta de nuevo o vuelve a iniciar sesión.',
    )
    expect(store.otpChallenge).not.toBeNull()
  })

  it.each(['verify', 'resend'] as const)(
    'fences late %s responses and errors across identical server handles',
    async (kind) => {
      for (const outcome of ['resolve', 'reject']) {
        setActivePinia(createPinia())
        const store = useAuthStore()
        await store.login(credentials)
        const old = deferred<never>()
        if (kind === 'verify') vi.mocked(authApi.verifyLoginOtp).mockReturnValueOnce(old.promise)
        else vi.mocked(authApi.resendLoginOtp).mockReturnValueOnce(old.promise)
        const pending = kind === 'verify' ? store.verifyLoginOtp('001234') : store.resendLoginOtp()
        store.cancelLogin()
        await store.login(credentials)
        const current = store.otpChallenge
        if (outcome === 'resolve')
          old.resolve(
            (kind === 'verify'
              ? session
              : { ...challenge, challengeId: 'old-replacement' }) as never,
          )
        else old.reject({ response: { status: 503 } })
        await expect(pending).resolves.toBeNull()
        expect(store.otpChallenge).toEqual(current)
        expect(store.otpError).toBeNull()
        expect(store.otpRestartRequired).toBe(false)
        expect(authApi.mePermissions).not.toHaveBeenCalled()
        expect(authStorage.setTokens).not.toHaveBeenCalled()
      }
    },
  )

  it('uses Retry-After for verify rate limits and rejects duplicate resends synchronously', async () => {
    const store = useAuthStore()
    await store.login(credentials)
    vi.mocked(authApi.verifyLoginOtp).mockRejectedValue({
      response: { status: 429, headers: { 'retry-after': '15' } },
    })
    await expect(store.verifyLoginOtp('001234')).rejects.toBeDefined()
    expect(store.otpRetryAt).toBeGreaterThan(Date.now())
    await expect(store.verifyLoginOtp('001234')).resolves.toBeNull()
    expect(authApi.verifyLoginOtp).toHaveBeenCalledOnce()
    store.cancelLogin()
    await store.login(credentials)
    const result = deferred<typeof challenge>()
    vi.mocked(authApi.resendLoginOtp).mockReturnValue(result.promise)
    const pending = store.resendLoginOtp()
    await expect(store.resendLoginOtp()).resolves.toBeNull()
    expect(authApi.resendLoginOtp).toHaveBeenCalledOnce()
    result.resolve(challenge)
    await pending
  })

  it.each(['verify', 'resend'] as const)(
    'retains a usable challenge after %s validation error',
    async (kind) => {
      const store = useAuthStore()
      await store.login(credentials)
      const error = { response: { status: 400 } }
      vi.mocked(authApi.verifyLoginOtp).mockRejectedValue(error)
      vi.mocked(authApi.resendLoginOtp).mockRejectedValue(error)
      await expect(
        kind === 'verify' ? store.verifyLoginOtp('001234') : store.resendLoginOtp(),
      ).rejects.toBe(error)
      expect(store.otpChallenge?.challengeId).toBe(challenge.challengeId)
      expect(store.otpRestartRequired).toBe(false)
      expect(authStorage.setTokens).not.toHaveBeenCalled()
    },
  )

  it('rejects a challenge envelope containing session fields', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ ...challenge, ...session } as never)
    await expect(useAuthStore().login(credentials)).rejects.toThrow('Invalid login challenge')
    expect(authStorage.setTokens).not.toHaveBeenCalled()
  })

  it('requires fresh password after a lost verification response', async () => {
    const store = useAuthStore()
    await store.login(credentials)
    vi.mocked(authApi.verifyLoginOtp).mockRejectedValue(new Error('Network'))
    await expect(store.verifyLoginOtp('001234')).rejects.toThrow()
    expect(store.otpRestartRequired).toBe(true)
    expect(store.otpChallenge).toBeNull()
  })
})

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
    vi.mocked(authApi.login).mockResolvedValue(challenge)
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

    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue({
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
    expect(store.accessToken).toBeNull()
    await store.verifyLoginOtp('001234')

    expect(store.authPhase).toBe('authenticated')
    expect(store.currentTenant).toEqual(tenants[0]!)
    expect(store.isSuperAdmin).toBe(false)
  })

  it('transitions idle -> authenticating -> needs-tenant-selection for multi-tenant login', async () => {
    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue({
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
    expect(store.tempToken).toBeNull()
    await store.verifyLoginOtp('001234')

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

    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue({
      requiresTenantSelection: false,
      user,
      tenants,
      accessToken: 'access-super',
      refreshToken: 'refresh-super',
    })

    const store = useAuthStore()
    await store.login({ email: user.email, password: 'secret' })
    expect(store.accessToken).toBeNull()
    await store.verifyLoginOtp('001234')

    expect(store.authPhase).toBe('needs-tenant-selection')
    expect(store.isSuperAdmin).toBe(true)
    expect(store.currentTenant).toBeNull()
    expect(store.memberships).toEqual(tenants)
    expect(vi.mocked(authApi.mePermissions)).not.toHaveBeenCalled()
  })

  it('transitions selecting-tenant -> authenticated when tenant selection completes', async () => {
    vi.mocked(authApi.verifyLoginOtp).mockResolvedValue({
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
    await store.verifyLoginOtp('001234')

    const promise = store.selectTenant(tenants[1]!.id)

    expect(store.authPhase).toBe('selecting-tenant')
    await promise

    expect(store.authPhase).toBe('authenticated')
    expect(store.tempToken).toBeNull()
    expect(store.currentTenant?.id).toBe(tenants[1]!.id)
  })

  it('clears rejected legacy selection without touching a valid final session', async () => {
    const store = useAuthStore()
    store.accessToken = 'existing'
    store.tempToken = 'legacy'
    store.memberships = tenants
    vi.mocked(authApi.selectTenant).mockRejectedValue({ response: { status: 401 } })
    await expect(store.selectTenant('tenant-1')).rejects.toBeDefined()
    expect(store.tempToken).toBeNull()
    expect(store.accessToken).toBe('existing')
    expect(store.authPhase).toBe('authenticated')
    expect(authStorage.clear).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)(
    'fences stale tenant selection %s without apparent success',
    async (outcome) => {
      const store = useAuthStore()
      store.tempToken = 'legacy'
      const old = deferred<{ user: AuthUser; accessToken: string; refreshToken: string }>()
      vi.mocked(authApi.selectTenant).mockReturnValue(old.promise)
      const pending = store.selectTenant('tenant-1')
      store.cancelLogin()
      store.tempToken = 'new-selection'
      if (outcome === 'resolve') old.resolve({ user, accessToken: 'old', refreshToken: 'old' })
      else old.reject({ response: { status: 401 } })
      await expect(pending).rejects.toThrow('Login operation cancelled')
      expect(store.tempToken).toBe('new-selection')
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(authApi.mePermissions).not.toHaveBeenCalled()
    },
  )

  it.each(['resolve', 'reject'] as const)(
    'fences selection permissions %s after a newer session arrives',
    async (outcome) => {
      const store = useAuthStore()
      store.tempToken = 'selection'
      vi.mocked(authApi.selectTenant).mockResolvedValue({
        user,
        accessToken: 'selected',
        refreshToken: 'selected-refresh',
      })
      const permissions = deferred<{ permissions: []; permissionCodes: string[] }>()
      vi.mocked(authApi.mePermissions).mockReturnValue(permissions.promise)
      const pending = store.selectTenant('tenant-1')
      await Promise.resolve()
      store.setSessionFromTokens('new-session', 'new-refresh')
      vi.mocked(authStorage.setTokens).mockClear()
      if (outcome === 'resolve') permissions.resolve({ permissions: [], permissionCodes: ['old'] })
      else permissions.reject({ response: { status: 401 } })
      await expect(pending).rejects.toThrow('Login operation cancelled')
      expect(store.accessToken).toBe('new-session')
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(store.permissionCodes).toEqual([])
    },
  )

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

  it('clears query cache BEFORE fetchPermissions to avoid stale tenant cache', async () => {
    let permissionsCalledAfterClear = false
    vi.mocked(authApi.mePermissions).mockImplementation(async () => {
      permissionsCalledAfterClear = clearMock.mock.calls.length > 0
      return { permissions: [], permissionCodes: [] }
    })

    const store = useAuthStore()
    await store.switchTenant('tenant-2')

    expect(permissionsCalledAfterClear).toBe(true)
    expect(clearMock).toHaveBeenCalledOnce()
  })

  it('clears old permission codes before loading new tenant permissions', async () => {
    const store = useAuthStore()
    store.permissionCodes = ['product.read', 'sale.read']

    vi.mocked(authApi.mePermissions).mockResolvedValue({
      permissions: [],
      permissionCodes: ['customer.read'],
    })

    await store.switchTenant('tenant-2')

    expect(authStorage.clearPermissionCodes).toHaveBeenCalled()
    expect(store.permissionCodes).toEqual(['customer.read'])
  })

  it('clears session when fetchPermissions fails after switchTenant', async () => {
    vi.mocked(authApi.mePermissions).mockRejectedValue(new Error('permissions failed'))
    const store = useAuthStore()

    await expect(store.switchTenant('tenant-2')).rejects.toThrow('permissions failed')
    expect(store.authPhase).toBe('idle')
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
  })

  it('does NOT clear session on recoverable 403 SUPER_ADMIN_REQUIRED error', async () => {
    const error403 = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: {
        status: 403,
        data: { code: 'SUPER_ADMIN_REQUIRED', message: 'Super admin required' },
      },
    })
    vi.mocked(authApi.switchTenant).mockRejectedValue(error403)

    const store = useAuthStore()
    store.setSessionFromTokens('access-token', 'refresh-token')

    await expect(store.switchTenant('tenant-2')).rejects.toThrow()

    // Session should NOT be cleared for recoverable errors
    expect(store.accessToken).toBe('access-token')
    expect(store.refreshToken).toBe('refresh-token')
    expect(store.authPhase).toBe('authenticated')
  })

  it('does NOT clear session on recoverable 403 TENANT_INACTIVE error', async () => {
    const error403 = Object.assign(new Error('Request failed with status code 403'), {
      isAxiosError: true,
      response: {
        status: 403,
        data: { code: 'TENANT_INACTIVE', message: 'Tenant is inactive' },
      },
    })
    vi.mocked(authApi.switchTenant).mockRejectedValue(error403)

    const store = useAuthStore()
    store.setSessionFromTokens('access-token', 'refresh-token')

    await expect(store.switchTenant('tenant-2')).rejects.toThrow()

    // Session should NOT be cleared for recoverable errors
    expect(store.accessToken).toBe('access-token')
    expect(store.refreshToken).toBe('refresh-token')
    expect(store.authPhase).toBe('authenticated')
  })

  it('DOES clear session on unrecoverable network error', async () => {
    const networkError = new Error('Network Error')
    vi.mocked(authApi.switchTenant).mockRejectedValue(networkError)

    const store = useAuthStore()
    store.setSessionFromTokens('access-token', 'refresh-token')

    await expect(store.switchTenant('tenant-2')).rejects.toThrow('Network Error')

    // Session SHOULD be cleared for unrecoverable errors
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.authPhase).toBe('idle')
  })

  it('DOES clear session on unrecoverable 500 error', async () => {
    const error500 = Object.assign(new Error('Request failed with status code 500'), {
      isAxiosError: true,
      response: {
        status: 500,
        data: { message: 'Internal server error' },
      },
    })
    vi.mocked(authApi.switchTenant).mockRejectedValue(error500)

    const store = useAuthStore()
    store.setSessionFromTokens('access-token', 'refresh-token')

    await expect(store.switchTenant('tenant-2')).rejects.toThrow()

    // Session SHOULD be cleared for unrecoverable errors
    expect(store.accessToken).toBeNull()
    expect(store.refreshToken).toBeNull()
    expect(store.authPhase).toBe('idle')
  })
})

describe('fetchMe synchronization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(decodeJwtClaims).mockReturnValue({
      sub: 'user-1',
      email: 'user@hound.test',
      tenantId: 'tenant-1',
      tenantSlug: 'centro',
      isSuperAdmin: false,
      iat: 1,
      exp: 9999999999,
    })
  })

  it('enriches /auth/me tenant metadata only within the JWT tenant', async () => {
    const store = useAuthStore()
    store.setSessionFromTokens('access', 'refresh')

    vi.mocked(authApi.me).mockResolvedValue({
      id: 'user-1',
      email: 'user@hound.test',
      name: 'User One',
      isActive: true,
      createdAt: '2026-05-02T00:00:00.000Z',
      tenant: { id: 'tenant-1', name: 'Sucursal Norte', slug: 'norte' },
      memberships: [{ id: 'tenant-1', name: 'Sucursal Norte', slug: 'norte' }],
    })

    await store.fetchMe()

    expect(store.user?.email).toBe('user@hound.test')
    expect(store.currentTenant).toEqual({ id: 'tenant-1', name: 'Sucursal Norte', slug: 'norte' })
    expect(store.memberships).toEqual([{ id: 'tenant-1', name: 'Sucursal Norte', slug: 'norte' }])
    expect(authStorage.setCurrentTenant).toHaveBeenCalledWith({
      id: 'tenant-1',
      name: 'Sucursal Norte',
      slug: 'norte',
    })
    expect(authStorage.setMemberships).toHaveBeenCalledWith([
      { id: 'tenant-1', name: 'Sucursal Norte', slug: 'norte' },
    ])
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

    expect(store.authError).toBe('No tienes acceso a ninguna sucursal. Contacta al administrador.')
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
