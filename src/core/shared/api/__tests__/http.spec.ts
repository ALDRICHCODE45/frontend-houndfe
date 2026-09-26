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
})
