import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { InfiniteData } from '@tanstack/vue-query'
import { axiosError, deferred, makeNotice, withQuery } from './support'
import { notificationKeys } from '../../constants/queryKeys'
import type { NotificationsPage } from '../../interfaces/notifications.types'

vi.mock('../../api/notifications.api', () => ({
  notificationsApi: { markRead: vi.fn(), markAllRead: vi.fn(), unreadCount: vi.fn(), list: vi.fn() },
}))

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
import { useMarkRead } from '../useMarkRead'
import { useMarkAllRead } from '../useMarkAllRead'

const markRead = vi.mocked(notificationsApi.markRead)
const markAllRead = vi.mocked(notificationsApi.markAllRead)

type Cache = InfiniteData<NotificationsPage, string | undefined>
const countKey = notificationKeys.unreadCount('tenant-1')
const allKey = notificationKeys.list('tenant-1', { unread: false })
const unreadKey = notificationKeys.list('tenant-1', { unread: true })

function seed(client: ReturnType<typeof withQuery>['client']) {
  const items = [makeNotice('a'), makeNotice('b'), makeNotice('c', { readAt: '2026-11-11T10:30:00.000Z' })]
  client.setQueryData(countKey, { count: 2 })
  client.setQueryData<Cache>(allKey, { pages: [{ items, nextCursor: null }], pageParams: [undefined] })
  client.setQueryData<Cache>(unreadKey, {
    pages: [{ items: items.slice(0, 2), nextCursor: null }],
    pageParams: [undefined],
  })
}
const readAtOf = (client: ReturnType<typeof withQuery>['client'], key: readonly unknown[], id: string) =>
  client.getQueryData<Cache>(key)?.pages.flatMap((p) => p.items).find((n) => n.id === id)?.readAt

beforeEach(() => {
  markRead.mockReset()
  markAllRead.mockReset()
  auth.tenantId = 'tenant-1'
  auth.authenticated = true
})

describe('useMarkRead', () => {
  it('posts the read and, before it answers, decrements the count and stamps the row', async () => {
    const pending = deferred<{ id: string; readAt: string }>()
    markRead.mockReturnValue(pending.promise)
    const { result, client } = withQuery(() => useMarkRead())
    seed(client)

    result.mutate('a')
    await flushPromises()

    expect(markRead).toHaveBeenCalledWith('a')
    expect(client.getQueryData(countKey)).toEqual({ count: 1 })
    expect(readAtOf(client, allKey, 'a')).toEqual(expect.any(String))
    expect(readAtOf(client, unreadKey, 'a')).toEqual(expect.any(String))
    expect(readAtOf(client, allKey, 'b')).toBeNull()

    const invalidate = vi.spyOn(client, 'invalidateQueries')
    pending.resolve({ id: 'a', readAt: '2026-11-11T10:05:00.000Z' })
    await flushPromises()
    // settled: the count and the lists are read again from the server
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all('tenant-1') })
  })

  it('does not decrement for a notice that is already read or not loaded', async () => {
    markRead.mockResolvedValue({ id: 'c', readAt: 'x' })
    const { result, client } = withQuery(() => useMarkRead())
    seed(client)

    result.mutate('c')
    await flushPromises()
    expect(client.getQueryData(countKey)).toEqual({ count: 2 })

    result.mutate('unknown')
    await flushPromises()
    expect(client.getQueryData(countKey)).toEqual({ count: 2 })
  })

  it('rolls the count and the rows back when the server refuses', async () => {
    const pending = deferred<{ id: string; readAt: string }>()
    markRead.mockReturnValue(pending.promise)
    const { result, client } = withQuery(() => useMarkRead())
    seed(client)

    result.mutate('a')
    await flushPromises()
    expect(client.getQueryData(countKey)).toEqual({ count: 1 })

    pending.reject(axiosError(500))
    await flushPromises()

    expect(client.getQueryData(countKey)).toEqual({ count: 2 })
    expect(readAtOf(client, allKey, 'a')).toBeNull()
    expect(readAtOf(client, unreadKey, 'a')).toBeNull()
    expect(result.isError.value).toBe(true)
  })

  it('never goes below zero', async () => {
    markRead.mockResolvedValue({ id: 'a', readAt: 'x' })
    const { result, client } = withQuery(() => useMarkRead())
    seed(client)
    client.setQueryData(countKey, { count: 0 })

    result.mutate('a')
    await flushPromises()
    expect(client.getQueryData(countKey)).toEqual({ count: 0 })
  })
})

describe('useMarkAllRead', () => {
  it('posts read-all and zeroes the count and stamps every row before it answers', async () => {
    const pending = deferred<{ updated: number }>()
    markAllRead.mockReturnValue(pending.promise)
    const { result, client } = withQuery(() => useMarkAllRead())
    seed(client)

    result.mutate()
    await flushPromises()

    expect(markAllRead).toHaveBeenCalledTimes(1)
    expect(client.getQueryData(countKey)).toEqual({ count: 0 })
    expect(readAtOf(client, allKey, 'a')).toEqual(expect.any(String))
    expect(readAtOf(client, allKey, 'b')).toEqual(expect.any(String))
    // the one that was read keeps its original stamp
    expect(readAtOf(client, allKey, 'c')).toBe('2026-11-11T10:30:00.000Z')

    const invalidate = vi.spyOn(client, 'invalidateQueries')
    pending.resolve({ updated: 2 })
    await flushPromises()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: notificationKeys.all('tenant-1') })
  })

  it('rolls everything back when the server refuses, and can be retried', async () => {
    markAllRead.mockRejectedValueOnce(axiosError(500))
    const { result, client } = withQuery(() => useMarkAllRead())
    seed(client)

    result.mutate()
    await flushPromises()

    expect(client.getQueryData(countKey)).toEqual({ count: 2 })
    expect(readAtOf(client, allKey, 'a')).toBeNull()
    expect(readAtOf(client, allKey, 'b')).toBeNull()
    expect(result.isError.value).toBe(true)

    markAllRead.mockResolvedValueOnce({ updated: 2 })
    result.mutate()
    await flushPromises()
    expect(result.isError.value).toBe(false)
    expect(markAllRead).toHaveBeenCalledTimes(2)
  })
})
