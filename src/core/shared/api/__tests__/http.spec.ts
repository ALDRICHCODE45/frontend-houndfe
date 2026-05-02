import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosError } from 'axios'
import axios from 'axios'
import { http } from '../http'
import { authStorage } from '@/features/auth/services/auth-storage'
import { emitSessionExpired } from '@/features/auth/services/session-events'

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

describe('http response interceptor', () => {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const responseRejected = (
    http.interceptors.response.handlers as NonNullable<typeof http.interceptors.response.handlers>
  )[0]!.rejected as (error: AxiosError) => Promise<unknown>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('skips refresh and emits tenant-required event for 401 Tenant context required', async () => {
    const refreshSpy = vi.spyOn(axios, 'post')

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

  it('keeps regular 401 refresh flow', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' },
    })

    const adapterSpy = vi.fn().mockResolvedValue({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} },
    })

    http.defaults.adapter = adapterSpy

    const error = {
      response: {
        status: 401,
        data: { message: 'Token expired' },
      },
      config: {
        url: '/orders',
        headers: {},
      },
    } as AxiosError

    await responseRejected(error)

    expect(axios.post).toHaveBeenCalledTimes(1)
    expect(authStorage.setTokens).toHaveBeenCalledWith({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })
    expect(adapterSpy).toHaveBeenCalledTimes(1)
  })
})
