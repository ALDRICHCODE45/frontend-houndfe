import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosError } from 'axios'
import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { http } from '../http'
import { authStorage } from '@/features/auth/services/auth-storage'
import { isSessionSealed } from '@/features/auth/services/session-seal'
import { emitSessionExpired } from '@/features/auth/services/session-events'

const { setSessionFromTokensMock, applySessionRotationMock } = vi.hoisted(() => ({
  setSessionFromTokensMock: vi.fn(),
  applySessionRotationMock: vi.fn(),
}))

vi.mock('@/features/auth/services/auth-storage', () => ({
  authStorage: {
    getAccessToken: vi.fn(() => 'access-token'),
    getRefreshToken: vi.fn(() => 'refresh-token'),
    getSessionGeneration: vi.fn(() => 0),
    commitRotation: vi.fn((generation, tokens) => ({ ...tokens, generation })),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}))

vi.mock('@/features/auth/services/session-seal', () => ({
  isSessionSealed: vi.fn(() => false),
}))

vi.mock('@/features/auth/services/session-events', () => ({
  emitSessionExpired: vi.fn(),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    setSessionFromTokens: setSessionFromTokensMock,
    applySessionRotation: applySessionRotationMock,
  }),
}))

describe('http response interceptor', () => {
  const responseRejected = (
    http.interceptors.response.handlers as NonNullable<typeof http.interceptors.response.handlers>
  )[0]!.rejected as (error: AxiosError) => Promise<unknown>

  const originalAdapter = http.defaults.adapter
  const unexpectedRefresh = vi.fn()
  const unexpectedTransport = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authStorage.getSessionGeneration).mockReturnValue(0)
    vi.mocked(isSessionSealed).mockReturnValue(false)
    vi.mocked(authStorage.getAccessToken).mockReturnValue('access-token')
    vi.mocked(authStorage.commitRotation).mockImplementation((generation, tokens) => {
      const pair = tokens as { accessToken: string; refreshToken: string }
      vi.mocked(authStorage.getAccessToken).mockReturnValue(pair.accessToken)
      return { ...pair, generation }
    })
    setActivePinia(createPinia())
    unexpectedRefresh.mockRejectedValue(new Error('Unexpected refresh transport'))
    unexpectedTransport.mockRejectedValue(new Error('Unexpected HTTP transport'))
    vi.spyOn(axios, 'post').mockImplementation(unexpectedRefresh)
    http.defaults.adapter = unexpectedTransport
  })

  afterEach(() => {
    try {
      // Catch accidental transport even when application code swallows its rejection.
      expect(unexpectedRefresh).not.toHaveBeenCalled()
      expect(unexpectedTransport).not.toHaveBeenCalled()
    } finally {
      http.defaults.adapter = originalAdapter
      vi.restoreAllMocks()
    }
  })

  it('skips refresh and emits tenant-required event for 401 Tenant context required', async () => {
    const refreshSpy = vi.mocked(axios.post)

    const error = {
      response: {
        status: 401,
        data: { message: 'Tenant context required' },
      },
      config: {
        url: '/orders',
        headers: {},
      },
    } as AxiosError

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(refreshSpy).not.toHaveBeenCalled()
    expect(emitSessionExpired).toHaveBeenCalledWith('tenant-required')
  })

  it.each(['/auth/login', '/auth/login/otp/verify', '/auth/login/otp/resend'])(
    'isolates both ordinary and tenant-required 401 on %s',
    async (url) => {
      const refresh = vi.mocked(axios.post)
      for (const message of ['Invalid', 'Tenant context required']) {
        const error = {
          response: { status: 401, data: { message } },
          config: { url, headers: {} },
        } as AxiosError
        await expect(responseRejected(error)).rejects.toBe(error)
      }
      expect(refresh).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(emitSessionExpired).not.toHaveBeenCalled()
    },
  )

  it.each(['Invalid', 'Tenant context required'])(
    'isolates verified bootstrap 401: %s',
    async (message) => {
      const refresh = vi.mocked(axios.post)
      const error = {
        response: { status: 401, data: { message } },
        config: {
          url: '/auth/me/permissions',
          method: 'get',
          verifiedLoginPermissions: true,
          headers: { Authorization: 'Bearer verified' },
        },
      } as unknown as AxiosError
      await expect(responseRejected(error)).rejects.toBe(error)
      expect(refresh).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(setSessionFromTokensMock).not.toHaveBeenCalled()
      expect(emitSessionExpired).not.toHaveBeenCalled()
    },
  )

  it('uses only the opted-in verified token and keeps GET cache headers', async () => {
    const adapter = vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} })
    await http.get('/auth/me/permissions', {
      verifiedLoginPermissions: true,
      headers: { Authorization: 'Bearer verified' },
      adapter,
    } as import('../http').VerifiedLoginPermissionsConfig)
    expect(adapter.mock.calls[0]![0].headers.Authorization).toBe('Bearer verified')
    expect(adapter.mock.calls[0]![0].headers['Cache-Control']).toBe('no-cache')
    expect(adapter.mock.calls[0]![0].headers.Pragma).toBe('no-cache')
    await http.get('/orders', { headers: { Authorization: 'Bearer arbitrary' }, adapter })
    expect(adapter.mock.calls[1]![0].headers.Authorization).toBe('Bearer access-token')
  })

  it.each(['Invalid selection', 'Tenant context required'])(
    'does not refresh or expire selection 401: %s',
    async (message) => {
      for (const url of ['/auth/select-tenant', '/auth/select-tenant/?source=login']) {
        const error = {
          response: { status: 401, data: { message } },
          config: { method: 'post', url, headers: {} },
        } as AxiosError
        await expect(responseRejected(error)).rejects.toBe(error)
      }
      expect(axios.post).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(emitSessionExpired).not.toHaveBeenCalled()
    },
  )

  it.each(['/orders', '/auth/switch-tenant', '/auth/select-tenant-extra'])(
    'keeps regular 401 refresh flow for %s',
    async (url) => {
      vi.mocked(axios.post).mockResolvedValue({
        data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
      })

      const adapterSpy = vi.fn().mockResolvedValue({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      })

      const error = {
        response: {
          status: 401,
          data: { message: 'Token expired' },
        },
        config: {
          url,
          method: 'post',
          headers: {},
          adapter: adapterSpy,
        },
      } as unknown as AxiosError

      await responseRejected(error)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(authStorage.commitRotation).toHaveBeenCalledWith(0, {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
      expect(applySessionRotationMock).toHaveBeenCalledWith({
        generation: 0,
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
      expect(adapterSpy).toHaveBeenCalledTimes(1)
    },
  )

  // ── Opt-in blob error bodies ────────────────────────────────────────────
  //
  // `responseType: 'blob'` hides a JSON error body from the synchronous
  // `response.data.message` read, so an authenticated request without a tenant
  // would take the refresh path instead of the tenant-required path. An explicit
  // typed opt-in lets the interceptor read a BOUNDED JSON message from the Blob
  // before classifying, without changing any other request.

  describe('opted-in blob tenant-context 401', () => {
    function blobError(body: unknown, config: Record<string, unknown> = {}): AxiosError {
      const data =
        body instanceof Blob
          ? body
          : new Blob([typeof body === 'string' ? body : JSON.stringify(body)], {
              type: 'application/json',
            })
      return {
        response: {
          status: 401,
          data,
        },
        config: {
          url: '/analytics/sales/sellers/8f14e45f-ceea-4a2b-9c3d-1a2b3c4d5e6f/report/pdf',
          method: 'get',
          tenantContextBlobError: true,
          headers: {},
          ...config,
        },
      } as unknown as AxiosError
    }

    function createDeferred<T>() {
      let resolve!: (value: T) => void
      const promise = new Promise<T>((res) => {
        resolve = res
      })
      return { promise, resolve }
    }

    function refreshedAdapter() {
      return vi.fn().mockResolvedValue({
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: {} },
      })
    }

    it('classifies an opted-in blob 401 "Tenant context required" without refreshing', async () => {
      const error = blobError({ statusCode: 401, message: 'Tenant context required' })

      await expect(responseRejected(error)).rejects.toBe(error)

      expect(axios.post).not.toHaveBeenCalled()
      expect(emitSessionExpired).toHaveBeenCalledWith('tenant-required')
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(setSessionFromTokensMock).not.toHaveBeenCalled()
    })

    it('keeps tenant-required precedence over the refresh-token lookup', async () => {
      // Even if a refresh token exists, the tenant check runs first and never
      // consults it, so the session is not silently rotated away.
      const error = blobError({ message: 'Tenant context required' })

      await expect(responseRejected(error)).rejects.toBe(error)

      expect(authStorage.getRefreshToken).not.toHaveBeenCalled()
      expect(axios.post).not.toHaveBeenCalled()
      expect(emitSessionExpired).toHaveBeenCalledWith('tenant-required')
      expect(emitSessionExpired).not.toHaveBeenCalledWith('missing-refresh-token')
      expect(authStorage.clear).not.toHaveBeenCalled()
    })

    it('still refreshes an opted-in blob 401 whose message is unrelated', async () => {
      vi.mocked(axios.post).mockResolvedValue({
        data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
      })
      const adapter = refreshedAdapter()
      const error = blobError({ message: 'Token expired' }, { adapter })

      await responseRejected(error)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(authStorage.commitRotation).toHaveBeenCalledWith(0, {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
      expect(adapter).toHaveBeenCalledTimes(1)
    })

    it('falls back to refresh for malformed, message-less or oversized opt-in blobs', async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'b' } })
      const bodies = [
        'not json at all',
        '{}',
        JSON.stringify({ tenant: 'missing' }),
        JSON.stringify({ message: 'Tenant context required', pad: 'x'.repeat(9000) }),
      ]
      const refreshCounts: number[] = []
      const tenantEvents: boolean[] = []

      for (const body of bodies) {
        vi.mocked(axios.post).mockClear()
        const adapter = refreshedAdapter()
        await responseRejected(blobError(body, { adapter }))
        refreshCounts.push(vi.mocked(axios.post).mock.calls.length)
        tenantEvents.push(
          vi.mocked(emitSessionExpired).mock.calls.some(([reason]) => reason === 'tenant-required'),
        )
      }

      expect(refreshCounts).toEqual([1, 1, 1, 1])
      expect(tenantEvents).toEqual([false, false, false, false])
    })

    it('leaves a non-opted-in blob 401 on the normal refresh flow', async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'b' } })
      const adapter = refreshedAdapter()
      const error = blobError(
        { message: 'Tenant context required' },
        { tenantContextBlobError: undefined, adapter },
      )

      await responseRejected(error)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(emitSessionExpired).not.toHaveBeenCalledWith('tenant-required')
    })

    it('stays silent for an opted-in blob 401 whose signal was already aborted', async () => {
      const controller = new AbortController()
      controller.abort()
      const error = blobError({ message: 'Tenant context required' }, { signal: controller.signal })

      // Cancelled work produces no side effects: no tenant event, no refresh, no
      // auth clear. The original error is rejected untouched.
      await expect(responseRejected(error)).rejects.toBe(error)

      expect(emitSessionExpired).not.toHaveBeenCalled()
      expect(axios.post).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
    })

    it('does not emit tenant-required when the request is aborted during the blob read', async () => {
      // `data.text()` is async: the request can be cancelled while the bounded
      // read is still running. Those bytes must never produce a global
      // session-expired event, a refresh attempt or an auth clear.
      const textDeferred = createDeferred<string>()
      const data = new Blob(['ignored'], { type: 'application/json' })
      Object.defineProperty(data, 'text', { value: () => textDeferred.promise })

      const controller = new AbortController()
      const error = blobError(data, { signal: controller.signal })

      const settled = responseRejected(error).then(
        () => null,
        (caught: unknown) => caught,
      )
      // Let the interceptor reach `await data.text()` before cancelling.
      await Promise.resolve()
      controller.abort()
      textDeferred.resolve(JSON.stringify({ statusCode: 401, message: 'Tenant context required' }))

      await expect(settled).resolves.toBe(error)

      expect(emitSessionExpired).not.toHaveBeenCalled()
      expect(axios.post).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(setSessionFromTokensMock).not.toHaveBeenCalled()
    })

    it('leaves a normal JWT blob 401 with an unrelated status/body on the refresh flow', async () => {
      vi.mocked(axios.post).mockResolvedValue({ data: { accessToken: 'a', refreshToken: 'b' } })
      const adapter = refreshedAdapter()
      const error = blobError({ message: 'Invalid credentials' }, { adapter })

      await responseRejected(error)

      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(authStorage.commitRotation).toHaveBeenCalledTimes(1)
    })
  })

  it.each(['success', 'failure'])(
    'isolates a late refresh %s from a newer session',
    async (outcome) => {
      let resolve!: (value: unknown) => void
      let reject!: (reason: unknown) => void
      const refresh = new Promise((yes, no) => {
        resolve = yes
        reject = no
      })
      vi.mocked(axios.post).mockReturnValueOnce(refresh as ReturnType<typeof axios.post>)
      const replay = vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} })
      const pending = http
        .get('/protected-old', {
          adapter: async (config) => {
            if (config.headers.Authorization === 'Bearer new-session') return replay(config)
            throw { config, response: { status: 401, data: {} } }
          },
        })
        .catch((error) => error)
      await vi.waitFor(() => expect(axios.post).toHaveBeenCalledOnce())
      vi.mocked(authStorage.getSessionGeneration).mockReturnValue(1)
      vi.mocked(authStorage.getAccessToken).mockReturnValue('new-session')
      if (outcome === 'success')
        resolve({ data: { accessToken: 'old-rotated', refreshToken: 'old-refresh' } })
      else reject(new Error('old refresh failure'))
      await pending
      expect(authStorage.setTokens).not.toHaveBeenCalled()
      expect(authStorage.commitRotation).not.toHaveBeenCalled()
      expect(setSessionFromTokensMock).not.toHaveBeenCalled()
      expect(applySessionRotationMock).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(emitSessionExpired).not.toHaveBeenCalled()
      expect(replay).not.toHaveBeenCalled()
    },
  )

  it('never refreshes an old request whose 401 arrives after session replacement', async () => {
    let fail!: () => void
    const adapter = vi.fn(
      (config) =>
        new Promise<never>((_resolve, reject) => {
          fail = () => reject({ config, response: { status: 401, data: {} } })
        }),
    )
    const pending = http.get('/old-request', { adapter }).catch((error) => error)
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce())
    vi.mocked(authStorage.getSessionGeneration).mockReturnValue(1)
    fail()
    await pending
    expect(axios.post).not.toHaveBeenCalled()
    expect(authStorage.clear).not.toHaveBeenCalled()
    expect(emitSessionExpired).not.toHaveBeenCalled()
  })

  it('shares one current-scope rotation and replays both original requests with its token', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(axios.post).mockReturnValueOnce(
      new Promise((yes) => {
        resolve = yes
      }) as ReturnType<typeof axios.post>,
    )
    const replayed: string[] = []
    const adapter = vi.fn(async (config) => {
      if (config.headers.Authorization !== 'Bearer rotated') {
        throw { config, response: { status: 401, data: {} } }
      }
      replayed.push(config.url)
      return { data: config.url, status: 200, statusText: 'OK', headers: {}, config }
    })
    const first = http.get('/first', { adapter })
    const second = http.get('/second', { adapter })
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(2))
    expect(axios.post).toHaveBeenCalledOnce()
    resolve({ data: { accessToken: 'rotated', refreshToken: 'rotated-refresh' } })
    expect((await first).data).toBe('/first')
    expect((await second).data).toBe('/second')
    expect(replayed).toEqual(['/first', '/second'])
    expect(authStorage.commitRotation).toHaveBeenCalledOnce()
    expect(applySessionRotationMock).toHaveBeenCalledOnce()
    expect(authStorage.clear).not.toHaveBeenCalled()
  })

  it.each(['transport', 'invalid-context'])(
    'retains current refresh failure handling: %s',
    async (kind) => {
      const failure = new Error('refresh denied')
      if (kind === 'transport') vi.mocked(axios.post).mockRejectedValueOnce(failure)
      else {
        vi.mocked(axios.post).mockResolvedValueOnce({
          data: { accessToken: 'wrong-scope', refreshToken: 'r' },
        })
        vi.mocked(authStorage.commitRotation).mockReturnValueOnce(null)
      }
      const replay = vi.fn()
      const error = {
        config: { url: '/protected', headers: {}, adapter: replay },
        response: { status: 401, data: {} },
      } as unknown as AxiosError
      await expect(responseRejected(error)).rejects.toBeInstanceOf(Error)
      expect(authStorage.clear).toHaveBeenCalledOnce()
      expect(emitSessionExpired).toHaveBeenCalledWith('refresh-failed')
      expect(applySessionRotationMock).not.toHaveBeenCalled()
      expect(replay).not.toHaveBeenCalled()
    },
  )

  it('clears the session with missing-refresh-token for a normal JWT 401 without a refresh token', async () => {
    vi.mocked(authStorage.getRefreshToken).mockReturnValueOnce(null)
    const error = {
      response: { status: 401, data: { message: 'Token expired' } },
      config: { url: '/orders', method: 'get', headers: {} },
    } as unknown as AxiosError

    await expect(responseRejected(error)).rejects.toBe(error)

    expect(axios.post).not.toHaveBeenCalled()
    expect(authStorage.clear).toHaveBeenCalled()
    expect(emitSessionExpired).toHaveBeenCalledWith('missing-refresh-token')
  })

  // ── S2/S3: proactive refresh and no double refresh ───────────────────────
  describe('proactive refresh and rotated-token replay', () => {
    const b64 = (value: unknown) =>
      btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const jwt = (claims: Record<string, unknown>) => `${b64({ alg: 'none' })}.${b64(claims)}.sig`
    const expiringIn = (seconds: number, tag = 'old') =>
      jwt({ tag, exp: Math.floor(Date.now() / 1000) + seconds })
    const fresh = expiringIn(900, 'fresh')
    const ok = (config: { url?: string }) => ({
      data: config.url,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
    const refreshResolves = () =>
      vi.mocked(axios.post).mockResolvedValue({ data: { accessToken: fresh, refreshToken: 'r2' } })

    /** Adapter that 401s every request not carrying `accepted`, counting those 401s. */
    function strictAdapter(accepted: string) {
      const seen = { unauthorized: 0, tokens: [] as string[] }
      const adapter = vi.fn(async (config) => {
        seen.tokens.push(config.headers.Authorization)
        if (config.headers.Authorization === `Bearer ${accepted}`) return ok(config)
        seen.unauthorized += 1
        throw { config, response: { status: 401, data: {} } }
      })
      return { adapter, seen }
    }

    it('(a) refreshes once for concurrent requests with an expired token and never sees a 401', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue(expiringIn(-30))
      refreshResolves()
      const { adapter, seen } = strictAdapter(fresh)

      await Promise.all(['/a', '/b', '/c'].map((url) => http.get(url, { adapter })))

      expect(axios.post).toHaveBeenCalledOnce()
      expect(authStorage.commitRotation).toHaveBeenCalledOnce()
      expect(applySessionRotationMock).toHaveBeenCalledOnce()
      expect(seen.unauthorized).toBe(0)
      expect(seen.tokens).toEqual(Array(3).fill(`Bearer ${fresh}`))
      expect(authStorage.clear).not.toHaveBeenCalled()
    })

    it.each([
      ['already expired', expiringIn(-1), 1],
      ['within the skew window', expiringIn(5), 1],
      ['comfortably valid', expiringIn(600), 0],
      ['without an exp claim', jwt({ sub: 'u' }), 0],
      ['not a readable JWT', 'opaque-token', 0],
    ])('(b) token %s -> %s proactive refresh(es)', async (_label, token, refreshes) => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue(token)
      refreshResolves()
      const adapter = vi.fn(async (config) => ok(config))

      await http.get('/orders', { adapter })

      expect(vi.mocked(axios.post).mock.calls.length).toBe(refreshes)
      const sent = adapter.mock.calls[0]![0].headers.Authorization
      expect(sent).toBe(refreshes ? `Bearer ${fresh}` : `Bearer ${token}`)
    })

    it.each(['transport', 'invalid-context'])(
      '(c) a failed proactive refresh logs out once and rejects every request: %s',
      async (kind) => {
        vi.mocked(authStorage.getAccessToken).mockReturnValue(expiringIn(-30))
        vi.mocked(authStorage.clear).mockImplementation(() => {
          vi.mocked(authStorage.getSessionGeneration).mockReturnValue(1)
        })
        if (kind === 'transport') vi.mocked(axios.post).mockRejectedValue(new Error('denied'))
        else {
          refreshResolves()
          vi.mocked(authStorage.commitRotation).mockReturnValue(null)
        }
        const adapter = vi.fn()

        const results = await Promise.allSettled(
          ['/a', '/b', '/c'].map((url) => http.get(url, { adapter })),
        )

        expect(results.map((result) => result.status)).toEqual(Array(3).fill('rejected'))
        expect(axios.post).toHaveBeenCalledOnce()
        expect(authStorage.clear).toHaveBeenCalledOnce()
        expect(emitSessionExpired).toHaveBeenCalledExactlyOnceWith('refresh-failed')
        expect(adapter).not.toHaveBeenCalled()
      },
    )

    it.each(['/auth/refresh', '/auth/login', '/auth/register'])(
      '(d) %s never triggers a proactive refresh',
      async (url) => {
        const token = expiringIn(-30)
        vi.mocked(authStorage.getAccessToken).mockReturnValue(token)
        const adapter = vi.fn(async (config) => ok(config))

        await http.post(url, {}, { adapter })

        expect(axios.post).not.toHaveBeenCalled()
        expect(adapter.mock.calls[0]![0].headers.Authorization).toBe(`Bearer ${token}`)
      },
    )

    it('(e) replays a late 401 sent with an already-rotated token without refreshing', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue('old-access')
      let fail!: () => void
      const adapter = vi.fn((config) =>
        adapter.mock.calls.length === 1
          ? new Promise<never>((_resolve, reject) => {
              fail = () => reject({ config, response: { status: 401, data: {} } })
            })
          : Promise.resolve(ok(config)),
      )
      const pending = http.get('/late', { adapter })
      await vi.waitFor(() => expect(adapter).toHaveBeenCalledOnce())
      expect(adapter.mock.calls[0]![0].headers.Authorization).toBe('Bearer old-access')

      vi.mocked(authStorage.getAccessToken).mockReturnValue('rotated-access')
      fail()
      await pending

      expect(axios.post).not.toHaveBeenCalled()
      expect(adapter).toHaveBeenCalledTimes(2)
      expect(adapter.mock.calls[1]![0].headers.Authorization).toBe('Bearer rotated-access')
      expect(authStorage.commitRotation).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
    })

    it('(e) replays a rotated-token 401 only once', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue('old-access')
      const adapter = vi.fn(async (config) => {
        vi.mocked(authStorage.getAccessToken).mockReturnValue(
          `rotated-${adapter.mock.calls.length}`,
        )
        throw { config, response: { status: 401, data: {} } }
      })

      await expect(http.get('/late', { adapter })).rejects.toMatchObject({
        response: { status: 401 },
      })

      expect(adapter).toHaveBeenCalledTimes(2)
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('(f) a 401 sent with the current token starts exactly one refresh and replays', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue('current')
      refreshResolves()
      const { adapter, seen } = strictAdapter(fresh)

      await Promise.all([http.get('/a', { adapter }), http.get('/b', { adapter })])

      expect(axios.post).toHaveBeenCalledOnce()
      expect(seen.unauthorized).toBe(2)
      expect(adapter).toHaveBeenCalledTimes(4)
      expect(authStorage.commitRotation).toHaveBeenCalledOnce()
    })

    it('(g) rejects a request whose session changes during the proactive refresh', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue(expiringIn(-30))
      let settle!: (value: unknown) => void
      vi.mocked(axios.post).mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve
        }) as ReturnType<typeof axios.post>,
      )
      const adapter = vi.fn()
      const pending = http.get('/orders', { adapter }).catch((error: unknown) => error)
      await vi.waitFor(() => expect(axios.post).toHaveBeenCalledOnce())

      vi.mocked(authStorage.getSessionGeneration).mockReturnValue(1)
      settle({ data: { accessToken: fresh, refreshToken: 'r2' } })

      await expect(pending).resolves.toBeInstanceOf(axios.CanceledError)
      expect(adapter).not.toHaveBeenCalled()
      expect(authStorage.commitRotation).not.toHaveBeenCalled()
      expect(applySessionRotationMock).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(emitSessionExpired).not.toHaveBeenCalled()
    })
  })

  describe('session sealed by logout', () => {
    const expired = () => {
      const b64 = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '')
      return `${b64({ alg: 'none' })}.${b64({ exp: Math.floor(Date.now() / 1000) - 60 })}.sig`
    }
    const logoutConfig = (adapter: unknown) =>
      ({
        explicitLogoutCredentials: true,
        headers: { Authorization: 'Bearer captured-access' },
        adapter,
      }) as import('../http').ExplicitLogoutConfig

    beforeEach(() => {
      vi.mocked(isSessionSealed).mockReturnValue(true)
    })

    it('never refreshes a 401 of a request stamped with the sealed generation', async () => {
      const error = {
        response: { status: 401, data: {} },
        config: { url: '/orders', headers: { Authorization: 'Bearer access-token' } },
      } as AxiosError
      await expect(responseRejected(error)).rejects.toBe(error)
      expect(axios.post).not.toHaveBeenCalled()
      expect(authStorage.commitRotation).not.toHaveBeenCalled()
      expect(authStorage.clear).not.toHaveBeenCalled()
      expect(emitSessionExpired).not.toHaveBeenCalled()
    })

    it('cancels new requests, even with an expired token, instead of sending or refreshing', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue(expired())
      const adapter = vi.fn()
      await expect(http.get('/orders', { adapter })).rejects.toBeInstanceOf(axios.CanceledError)
      expect(adapter).not.toHaveBeenCalled()
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('still lets auth-free requests through', async () => {
      const adapter = vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} })
      await http.post('/auth/login', {}, { adapter })
      expect(adapter).toHaveBeenCalledOnce()
    })

    it('sends the explicit logout token, not the stored one, and never proactively refreshes', async () => {
      vi.mocked(authStorage.getAccessToken).mockReturnValue(expired())
      const adapter = vi.fn().mockResolvedValue({ data: {}, status: 200, headers: {} })
      await http.post('/auth/logout', undefined, logoutConfig(adapter))
      expect(adapter.mock.calls[0]![0].headers.Authorization).toBe('Bearer captured-access')
      expect(axios.post).not.toHaveBeenCalled()
    })

    it('rejects an explicit logout request without its token', async () => {
      const adapter = vi.fn()
      const config = { ...logoutConfig(adapter), headers: {} }
      await expect(http.post('/auth/logout', undefined, config)).rejects.toThrow(
        'Logout token missing',
      )
      expect(adapter).not.toHaveBeenCalled()
    })

    it.each([true, false])(
      'does not refresh or expire a logout 401 (sealed: %s)',
      async (sealed) => {
        vi.mocked(isSessionSealed).mockReturnValue(sealed)
        const error = {
          response: { status: 401, data: {} },
          config: {
            url: '/auth/logout',
            method: 'post',
            explicitLogoutCredentials: true,
            headers: { Authorization: 'Bearer captured-access' },
          },
        } as unknown as AxiosError
        await expect(responseRejected(error)).rejects.toBe(error)
        expect(axios.post).not.toHaveBeenCalled()
        expect(authStorage.clear).not.toHaveBeenCalled()
        expect(emitSessionExpired).not.toHaveBeenCalled()
      },
    )

    it('ignores a refresh that settles after the logout fence', async () => {
      vi.mocked(isSessionSealed).mockReturnValue(false)
      vi.mocked(authStorage.getAccessToken).mockReturnValue(expired())
      let settle!: (value: unknown) => void
      vi.mocked(axios.post).mockReturnValueOnce(
        new Promise((resolve) => {
          settle = resolve
        }) as ReturnType<typeof axios.post>,
      )
      const adapter = vi.fn()
      const pending = http.get('/orders', { adapter }).catch((error: unknown) => error)
      await vi.waitFor(() => expect(axios.post).toHaveBeenCalledOnce())
      vi.mocked(authStorage.getSessionGeneration).mockReturnValue(1)
      vi.mocked(isSessionSealed).mockReturnValue(true)
      settle({ data: { accessToken: 'late', refreshToken: 'late-r' } })
      await expect(pending).resolves.toBeInstanceOf(axios.CanceledError)
      expect(authStorage.commitRotation).not.toHaveBeenCalled()
      expect(adapter).not.toHaveBeenCalled()
    })
  })
})
