import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { type AxiosAdapter, type AxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { http } from '@/core/shared/api/http'
import { useAuthStore } from '../stores/useAuthStore'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import { isSessionSealed } from '../services/session-seal'
import { onSessionExpired } from '../services/session-events'
import { ability, resetAbility } from '../authorization/ability'

const { clearCache } = vi.hoisted(() => ({ clearCache: vi.fn() }))
vi.mock('@/core/shared/api/queryClient', () => ({ queryClient: { clear: clearCache } }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const user = { id: 'u', email: 'u@example.invalid', name: 'U', isActive: true, createdAt: '' }
const accessToken = `e30.${btoa(JSON.stringify({ sub: 'u', tenantId: 'a', isSuperAdmin: false }))}.sig`
const session = { user, accessToken, refreshToken: 'refresh-a' }
const ok = (config: AxiosRequestConfig) => ({
  data: { message: 'ok' },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

describe('logout fences the session before awaiting the API', () => {
  const originalAdapter = http.defaults.adapter
  const expired = vi.fn()
  let stopListening: () => void
  let refresh: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    authStorage.clear()
    resetAbility()
    vi.clearAllMocks()
    refresh = vi.spyOn(axios, 'post').mockRejectedValue(new Error('Unexpected refresh'))
    stopListening = onSessionExpired(expired)
  })

  afterEach(() => {
    stopListening()
    http.defaults.adapter = originalAdapter
    vi.restoreAllMocks()
  })

  function loggedIn() {
    const store = useAuthStore()
    store.setSession(session)
    store.setPermissionCodes(['read:Order'])
    return store
  }

  it('moves the generation at the start, keeps tokens for the API and clears once when it settles', async () => {
    const store = loggedIn()
    const before = authStorage.getSessionGeneration()
    const reply = deferred<{ message: string }>()
    const logoutSpy = vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
    const clear = vi.spyOn(authStorage, 'clear')

    const pending = store.logout()

    expect(authStorage.getSessionGeneration()).toBeGreaterThan(before)
    expect(isSessionSealed()).toBe(true)
    expect(logoutSpy).toHaveBeenCalledWith(accessToken)
    expect(clear).not.toHaveBeenCalled()
    expect(clearCache).not.toHaveBeenCalled()

    reply.resolve({ message: 'ok' })
    await pending

    expect(clear).toHaveBeenCalledOnce()
    expect(clearCache).toHaveBeenCalledOnce()
    expect(authStorage.getAccessToken()).toBeNull()
    expect(authStorage.getPermissionCodes()).toBeNull()
    expect(isSessionSealed()).toBe(false)
    expect(store.accessToken).toBeNull()
    expect(store.permissionCodes).toEqual([])
    expect(ability.can('read', 'Order')).toBe(false)
  })

  it('never refreshes or rotates for 401s that arrive while the logout is pending', async () => {
    const store = loggedIn()
    const sent: Array<{ url?: string; authorization?: unknown }> = []
    const oldRequest = deferred<never>()
    const logoutReply = deferred<ReturnType<typeof ok>>()
    http.defaults.adapter = vi.fn(((config) => {
      sent.push({ url: config.url, authorization: config.headers.get('Authorization') })
      if (config.url === '/old') return oldRequest.promise
      return logoutReply.promise
    }) as AxiosAdapter)

    const old = http.get('/old').catch((error: unknown) => error)
    await vi.waitFor(() => expect(sent).toHaveLength(1))
    const pending = store.logout()
    await vi.waitFor(() => expect(sent).toHaveLength(2))
    const late = http.get('/late').catch((error: unknown) => error)

    oldRequest.reject({ config: { url: '/old', headers: {} }, response: { status: 401, data: {} } })
    await old
    await expect(late).resolves.toBeInstanceOf(axios.CanceledError)
    logoutReply.resolve(ok({ url: '/auth/logout' }))
    await pending

    expect(sent.map((request) => request.url)).toEqual(['/old', '/auth/logout'])
    expect(sent[1]!.authorization).toBe(`Bearer ${accessToken}`)
    expect(refresh).not.toHaveBeenCalled()
    expect(expired).not.toHaveBeenCalled()
    expect(authStorage.getAccessToken()).toBeNull()
  })

  it('does not refresh or expire when the logout request itself gets a 401', async () => {
    const store = loggedIn()
    http.defaults.adapter = vi.fn(((config) =>
      Promise.reject({ config, response: { status: 401, data: {} } })) as AxiosAdapter)
    await store.logout()
    expect(refresh).not.toHaveBeenCalled()
    expect(expired).not.toHaveBeenCalled()
    expect(authStorage.getAccessToken()).toBeNull()
  })

  it.each([
    ['fails', Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })],
    [
      'times out',
      Object.assign(new Error('timeout of 10000ms exceeded'), { code: 'ECONNABORTED' }),
    ],
  ])('still clears exactly once and resolves when the logout API %s', async (_name, failure) => {
    const store = loggedIn()
    vi.spyOn(authApi, 'logout').mockRejectedValue(failure)
    const clear = vi.spyOn(authStorage, 'clear')

    await expect(store.logout()).resolves.toBeUndefined()

    expect(clear).toHaveBeenCalledOnce()
    expect(clearCache).toHaveBeenCalledOnce()
    expect(authStorage.getAccessToken()).toBeNull()
    expect(store.accessToken).toBeNull()
    expect(store.permissionCodes).toEqual([])
  })

  it('shares one logout between concurrent calls without double clearing or throwing', async () => {
    const store = loggedIn()
    const reply = deferred<{ message: string }>()
    const logoutSpy = vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
    const clear = vi.spyOn(authStorage, 'clear')

    const first = store.logout()
    const second = store.logout()
    reply.resolve({ message: 'ok' })

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
    expect(logoutSpy).toHaveBeenCalledOnce()
    expect(clear).toHaveBeenCalledOnce()
    expect(clearCache).toHaveBeenCalledOnce()
  })

  it('can log out again after the previous logout finished', async () => {
    const store = loggedIn()
    const logoutSpy = vi.spyOn(authApi, 'logout').mockResolvedValue({ message: 'ok' })
    await store.logout()
    store.setSession(session)
    await store.logout()
    expect(logoutSpy).toHaveBeenCalledTimes(2)
    expect(authStorage.getAccessToken()).toBeNull()
  })

  it('leaves a login that started during the logout untouched', async () => {
    const store = loggedIn()
    const reply = deferred<{ message: string }>()
    vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
    const pending = store.logout()
    store.setSession({ ...session, refreshToken: 'refresh-new' })
    reply.resolve({ message: 'ok' })
    await pending
    expect(authStorage.getRefreshToken()).toBe('refresh-new')
    expect(isSessionSealed()).toBe(false)
    expect(clearCache).not.toHaveBeenCalled()
  })

  describe('expiring access token (F1)', () => {
    const tokenExpiring = (seconds: number, tag: string) =>
      `e30.${btoa(
        JSON.stringify({
          sub: 'u',
          tenantId: 'a',
          tenantSlug: 'a',
          isSuperAdmin: false,
          tag,
          exp: Math.floor(Date.now() / 1000) + seconds,
        }),
      )}.sig`

    function loggedInExpired() {
      const store = useAuthStore()
      store.setSession({ ...session, accessToken: tokenExpiring(-60, 'old') })
      return store
    }

    it('renews once before the fence and sends the fresh token to the logout API', async () => {
      const store = loggedInExpired()
      const fresh = tokenExpiring(900, 'fresh')
      refresh.mockResolvedValue({ data: { accessToken: fresh, refreshToken: 'refresh-b' } })
      const logoutSpy = vi.spyOn(authApi, 'logout').mockResolvedValue({ message: 'ok' })

      await store.logout()

      expect(refresh).toHaveBeenCalledOnce()
      expect(refresh.mock.calls[0]![1]).toEqual({ refreshToken: 'refresh-a' })
      expect(logoutSpy).toHaveBeenCalledExactlyOnceWith(fresh)
      expect(authStorage.getAccessToken()).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(clearCache).toHaveBeenCalledOnce()
    })

    it('does not renew a token that is still valid', async () => {
      const store = useAuthStore()
      const valid = tokenExpiring(900, 'valid')
      store.setSession({ ...session, accessToken: valid })
      const logoutSpy = vi.spyOn(authApi, 'logout').mockResolvedValue({ message: 'ok' })
      await store.logout()
      expect(refresh).not.toHaveBeenCalled()
      expect(logoutSpy).toHaveBeenCalledWith(valid)
    })

    it('ends the session locally, once and without throwing, when the renewal fails', async () => {
      const store = loggedInExpired()
      store.setPermissionCodes(['read:Order'])
      refresh.mockRejectedValue(new Error('refresh rejected'))
      const logoutSpy = vi.spyOn(authApi, 'logout').mockResolvedValue({ message: 'ok' })
      const clear = vi.spyOn(authStorage, 'clear')

      await expect(store.logout()).resolves.toBeUndefined()

      expect(logoutSpy).not.toHaveBeenCalled()
      expect(clear).toHaveBeenCalledOnce()
      expect(expired).toHaveBeenCalledOnce()
      expect(authStorage.getAccessToken()).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.permissionCodes).toEqual([])
      expect(ability.can('read', 'Order')).toBe(false)
      expect(clearCache).toHaveBeenCalledOnce()
      expect(isSessionSealed()).toBe(false)
    })
  })

  describe('sessions that change during a pending logout', () => {
    it('clears the query cache when a cancelled tenant switch ended the session first (F2)', async () => {
      const store = loggedIn()
      const reply = deferred<{ message: string }>()
      vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
      vi.spyOn(authApi, 'switchTenant').mockRejectedValue(new axios.CanceledError('Session ending'))

      const pending = store.logout()
      await expect(store.switchTenant('b')).rejects.toBeDefined()
      expect(store.accessToken).toBeNull()
      expect(clearCache).not.toHaveBeenCalled()
      reply.resolve({ message: 'ok' })
      await pending

      expect(clearCache).toHaveBeenCalledOnce()
      expect(store.accessToken).toBeNull()
      expect(isSessionSealed()).toBe(false)
    })

    it('ends the old session and releases the seal after a failed login (F3)', async () => {
      const store = loggedIn()
      const reply = deferred<{ message: string }>()
      vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
      vi.spyOn(authApi, 'login').mockRejectedValue(new Error('bad credentials'))

      const pending = store.logout()
      await expect(store.login({ email: 'x@example.invalid', password: 'x' })).rejects.toThrow(
        'bad credentials',
      )
      reply.resolve({ message: 'ok' })
      await pending

      expect(isSessionSealed()).toBe(false)
      expect(authStorage.getAccessToken()).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.permissionCodes).toEqual([])
      expect(ability.can('read', 'Order')).toBe(false)
      expect(clearCache).toHaveBeenCalledOnce()
      http.defaults.adapter = vi.fn(((config) => Promise.resolve(ok(config))) as AxiosAdapter)
      await expect(http.get('/orders')).resolves.toBeDefined()
    })

    it('keeps the OTP challenge of a login started during the logout (F3)', async () => {
      const store = loggedIn()
      const reply = deferred<{ message: string }>()
      vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
      vi.spyOn(authApi, 'login').mockResolvedValue({
        requiresOtp: true,
        challengeId: 'challenge',
        expiresIn: 300,
        resendAfter: 30,
      })

      const pending = store.logout()
      await store.login({ email: 'x@example.invalid', password: 'x' })
      reply.resolve({ message: 'ok' })
      await pending

      expect(store.otpChallenge?.challengeId).toBe('challenge')
      expect(isSessionSealed()).toBe(false)
      expect(authStorage.getAccessToken()).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(clearCache).toHaveBeenCalledOnce()
    })

    it('releases the seal without touching a new session that started meanwhile', async () => {
      const store = loggedIn()
      const reply = deferred<{ message: string }>()
      vi.spyOn(authApi, 'logout').mockReturnValue(reply.promise)
      const pending = store.logout()
      store.setSession({ ...session, refreshToken: 'refresh-new' })
      store.setPermissionCodes(['read:Product'])
      reply.resolve({ message: 'ok' })
      await pending
      expect(isSessionSealed()).toBe(false)
      expect(store.accessToken).toBe(accessToken)
      expect(store.permissionCodes).toEqual(['read:Product'])
      expect(authStorage.getRefreshToken()).toBe('refresh-new')
      expect(clearCache).not.toHaveBeenCalled()
    })
  })
})
