import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, type InfiniteData } from '@tanstack/vue-query'
import { createFakeRealtime } from '@/core/realtime/__tests__/fake-realtime'
import { notificationKeys } from '../../constants/queryKeys'
import type { NotificationsPage } from '../../interfaces/notifications.types'
import { makeNotice } from '../../composables/__tests__/support'
import { startNotificationsRealtimeSync } from '../notifications-realtime-sync'

const TENANT = 'tenant-1'
type ListCache = InfiniteData<NotificationsPage, string | undefined>
const list = (...items: ReturnType<typeof makeNotice>[]): ListCache => ({
  pages: [{ items, nextCursor: null }],
  pageParams: [undefined],
})
const invalidated = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated === true

let client: QueryClient
let fake: ReturnType<typeof createFakeRealtime>
let stop: () => void
let tenant = TENANT

function start() {
  stop = startNotificationsRealtimeSync({ client, service: fake.service, getTenantId: () => tenant })
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  fake = createFakeRealtime({ state: 'open', role: 'leader' })
  tenant = TENANT
  start()
})
afterEach(() => stop())

const allKey = notificationKeys.list(TENANT, { unread: false })
const unreadKey = notificationKeys.list(TENANT, { unread: true })

describe('notification.created', () => {
  it('sets the badge from unreadCount (not +1) and refetches the lists', () => {
    client.setQueryData(notificationKeys.unreadCount(TENANT), { count: 1 })
    client.setQueryData(allKey, list())
    client.setQueryData(unreadKey, list())
    fake.emit('notification.created', { notification: makeNotice('n-1'), unreadCount: 7 })
    expect(client.getQueryData(notificationKeys.unreadCount(TENANT))).toEqual({ count: 7 })
    expect(invalidated(client, allKey)).toBe(true)
    expect(invalidated(client, unreadKey)).toBe(true)
  })

  it('refetches the count when the payload carries no usable number', () => {
    client.setQueryData(notificationKeys.unreadCount(TENANT), { count: 1 })
    fake.emit('notification.created', { notification: makeNotice('n-1') })
    expect(client.getQueryData(notificationKeys.unreadCount(TENANT))).toEqual({ count: 1 })
    expect(invalidated(client, notificationKeys.unreadCount(TENANT))).toBe(true)
  })

  it('does not touch another branch\'s cache, nor anything without a tenant', () => {
    client.setQueryData(notificationKeys.unreadCount('tenant-2'), { count: 4 })
    fake.emit('notification.created', { notification: makeNotice('n-1'), unreadCount: 9 })
    expect(client.getQueryData(notificationKeys.unreadCount('tenant-2'))).toEqual({ count: 4 })
    tenant = ''
    fake.emit('notification.created', { notification: makeNotice('n-2'), unreadCount: 11 })
    expect(client.getQueryData(notificationKeys.unreadCount(''))).toBeUndefined()
  })
})

describe('notification.read', () => {
  it('sets the badge, stamps the listed ids as read and refetches the lists', () => {
    client.setQueryData(notificationKeys.unreadCount(TENANT), { count: 3 })
    client.setQueryData(allKey, list(makeNotice('a'), makeNotice('b')))
    fake.emit('notification.read', { ids: ['a'], all: false, unreadCount: 2 })
    expect(client.getQueryData(notificationKeys.unreadCount(TENANT))).toEqual({ count: 2 })
    const items = client.getQueryData<ListCache>(allKey)!.pages[0]!.items
    expect(items.find((n) => n.id === 'a')!.readAt).not.toBeNull()
    expect(items.find((n) => n.id === 'b')!.readAt).toBeNull()
    expect(invalidated(client, allKey)).toBe(true)
  })

  it('all: true stamps every notice and zeroes the badge from the payload', () => {
    client.setQueryData(notificationKeys.unreadCount(TENANT), { count: 3 })
    client.setQueryData(allKey, list(makeNotice('a'), makeNotice('b')))
    fake.emit('notification.read', { ids: null, all: true, unreadCount: 0 })
    expect(client.getQueryData(notificationKeys.unreadCount(TENANT))).toEqual({ count: 0 })
    expect(client.getQueryData<ListCache>(allKey)!.pages[0]!.items.every((n) => n.readAt !== null)).toBe(true)
  })
})

describe('ready and resync', () => {
  it.each(['ready', 'resync'] as const)('%s refetches the unread count and the lists, not the preferences', (type) => {
    client.setQueryData(notificationKeys.unreadCount(TENANT), { count: 3 })
    client.setQueryData(allKey, list())
    client.setQueryData(notificationKeys.preferences(TENANT), { soundEnabled: true })
    fake.emit(type, {})
    expect(invalidated(client, notificationKeys.unreadCount(TENANT))).toBe(true)
    expect(invalidated(client, allKey)).toBe(true)
    expect(invalidated(client, notificationKeys.preferences(TENANT))).toBe(false)
  })
})

describe('stop', () => {
  it('unsubscribes every handler', () => {
    for (const type of ['notification.created', 'notification.read', 'ready', 'resync']) {
      expect(fake.handlerCount(type), type).toBe(1)
    }
    stop()
    for (const type of ['notification.created', 'notification.read', 'ready', 'resync']) {
      expect(fake.handlerCount(type), type).toBe(0)
    }
    start()
  })
})
