import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { axiosError, withQuery } from './support'
import { notificationKeys } from '../../constants/queryKeys'

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
