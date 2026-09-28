import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosError } from 'axios'
import axios from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { http } from '../http'
import { authStorage } from '@/features/auth/services/auth-storage'
import { emitSessionExpired } from '@/features/auth/services/session-events'

const { setSessionFromTokensMock } = vi.hoisted(() => ({
  setSessionFromTokensMock: vi.fn(),
}))

vi.mock('@/features/auth/services/auth-storage', () => ({
  authStorage: {
    getAccessToken: vi.fn(() => 'access-token'),
    getRefreshToken: vi.fn(() => 'refresh-token'),
    setTokens: vi.fn(),
    clear: vi.fn(),
  },
}))

vi.mock('@/features/auth/services/session-events', () => ({
  emitSessionExpired: vi.fn(),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    setSessionFromTokens: setSessionFromTokensMock,
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
      expect(authStorage.setTokens).toHaveBeenCalledWith({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      })
      expect(setSessionFromTokensMock).toHaveBeenCalledWith('new-access-token', 'new-refresh-token')
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
      expect(authStorage.setTokens).toHaveBeenCalledWith({
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
      expect(authStorage.setTokens).toHaveBeenCalledTimes(1)
    })
  })

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
})
