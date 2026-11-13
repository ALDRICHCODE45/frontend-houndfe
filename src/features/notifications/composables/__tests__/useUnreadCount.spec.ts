import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { axiosError, withQuery } from './support'
import { notificationKeys } from '../../constants/queryKeys'
import { createFakeRealtime } from '@/core/realtime/__tests__/fake-realtime'
import { setRealtimeServiceForTests } from '@/core/realtime/useRealtime'

vi.mock('../../api/notifications.api', () => ({ notificationsApi: { unreadCount: vi.fn() } }))

const auth = vi.hoisted(() => ({ tenantId: 'tenant-1', authenticated: true }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    get isAuthenticated() {
      return auth.authenticated
    },
  }),
}))

import { notificationsApi } from '../../api/notifications.api'
import { useUnreadCount } from '../useUnreadCount'

const unreadCount = vi.mocked(notificationsApi.unreadCount)

beforeEach(() => {
  unreadCount.mockReset()
  auth.tenantId = 'tenant-1'
  auth.authenticated = true
  unreadCount.mockResolvedValue({ count: 3 })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useUnreadCount', () => {
  it('reads the count under the tenant key', async () => {
    const { result, client } = withQuery(() => useUnreadCount())
    await flushPromises()

    expect(unreadCount).toHaveBeenCalledWith({ signal: expect.anything() })
    expect(result.count.value).toBe(3)
    expect(client.getQueryData(notificationKeys.unreadCount('tenant-1'))).toEqual({ count: 3 })
  })

  it('sends nothing without a tenant or without a session', async () => {
    auth.tenantId = ''
    const first = withQuery(() => useUnreadCount())
    await flushPromises()
    expect(unreadCount).not.toHaveBeenCalled()
    expect(first.result.count.value).toBeNull()

    auth.tenantId = 'tenant-1'
    auth.authenticated = false
    withQuery(() => useUnreadCount())
    await flushPromises()
    expect(unreadCount).not.toHaveBeenCalled()
  })

  it('polls every 30 s while the tab is visible and pauses while hidden', async () => {
    vi.useFakeTimers()
    withQuery(() => useUnreadCount())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(unreadCount).toHaveBeenCalledTimes(2)

    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await vi.advanceTimersByTimeAsync(90_000)
    expect(unreadCount).toHaveBeenCalledTimes(2)
  })

  it('does not retry a failed read, flags it, and keeps the last known count', async () => {
    unreadCount.mockRejectedValue(axiosError(500))
    const { result } = withQuery(() => useUnreadCount(), new QueryClient())
    await flushPromises()
    expect(unreadCount).toHaveBeenCalledTimes(1)
    expect(result.isError.value).toBe(true)
    expect(result.count.value).toBeNull()
  })
})

describe('useUnreadCount with the realtime stream', () => {
  async function tick(ms: number) {
    await vi.advanceTimersByTimeAsync(ms)
  }

  it('polls every 30 s while the stream is not open, slows down while it is open, and speeds up when it drops', async () => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_REALTIME_SSE', 'true')
    const fake = createFakeRealtime({ state: 'reconnecting', role: 'leader' })
    setRealtimeServiceForTests(fake.service)
    try {
      withQuery(() => useUnreadCount())
      await tick(0)
      await tick(30_000)
      expect(unreadCount).toHaveBeenCalledTimes(2)

      fake.setStatus({ state: 'open', role: 'leader' })
      unreadCount.mockClear()
      await tick(30_000 * 5)
      expect(unreadCount).not.toHaveBeenCalled()

      fake.setStatus({ state: 'reconnecting', role: 'leader' })
      await tick(30_000)
      expect(unreadCount).toHaveBeenCalledTimes(1)
    } finally {
      setRealtimeServiceForTests(null)
      vi.unstubAllEnvs()
    }
  })

  it('flag off: never subscribes to the stream and keeps the 30 s poll', async () => {
    vi.useFakeTimers()
    const fake = createFakeRealtime({ state: 'open', role: 'leader' })
    setRealtimeServiceForTests(fake.service)
    try {
      withQuery(() => useUnreadCount())
      await tick(0)
      await tick(30_000)
      expect(unreadCount).toHaveBeenCalledTimes(2)
      expect(fake.mocks.onStatus).not.toHaveBeenCalled()
    } finally {
      setRealtimeServiceForTests(null)
    }
  })
})
