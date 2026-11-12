import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { makeNotice, withQuery } from './support'
import { notificationKeys } from '../../constants/queryKeys'

vi.mock('../../api/notifications.api', () => ({ notificationsApi: { list: vi.fn() } }))

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
import { useNotifications } from '../useNotifications'

const list = vi.mocked(notificationsApi.list)

beforeEach(() => {
  list.mockReset()
  auth.tenantId = 'tenant-1'
  auth.authenticated = true
  list.mockResolvedValue({ items: [makeNotice('a'), makeNotice('b')], nextCursor: 'c2' })
})

describe('useNotifications', () => {
  it('loads the first page without a cursor and under the tenant + filter key', async () => {
    const { result, client } = withQuery(() => useNotifications({ unread: ref(false) }))
    await flushPromises()

    expect(list).toHaveBeenCalledWith(
      { cursor: undefined, limit: 20, unread: false },
      { signal: expect.anything() },
    )
    expect(result.items.value.map((n) => n.id)).toEqual(['a', 'b'])
    expect(result.hasNextPage.value).toBe(true)
    expect(client.getQueryData(notificationKeys.list('tenant-1', { unread: false }))).toBeDefined()
  })

  it('«Ver anteriores» sends the cursor unchanged and appends, without duplicates', async () => {
    const { result } = withQuery(() => useNotifications({ unread: ref(false) }))
    await flushPromises()

    list.mockResolvedValueOnce({ items: [makeNotice('b'), makeNotice('c')], nextCursor: null })
    await result.fetchNextPage()
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(
      { cursor: 'c2', limit: 20, unread: false },
      { signal: expect.anything() },
    )
    expect(result.items.value.map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(result.hasNextPage.value).toBe(false)
  })

  it('the unread tab asks for unread=true under its own key', async () => {
    const unread = ref(false)
    const { result, client } = withQuery(() => useNotifications({ unread }))
    await flushPromises()

    list.mockResolvedValueOnce({ items: [makeNotice('z')], nextCursor: null })
    unread.value = true
    await flushPromises()

    expect(list).toHaveBeenLastCalledWith(
      { cursor: undefined, limit: 20, unread: true },
      { signal: expect.anything() },
    )
    expect(result.items.value.map((n) => n.id)).toEqual(['z'])
    expect(client.getQueryData(notificationKeys.list('tenant-1', { unread: true }))).toBeDefined()
  })

  it('sends nothing while inactive (panel closed) or without a tenant', async () => {
    const active = ref(false)
    const { result } = withQuery(() => useNotifications({ unread: ref(false), active }))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
    expect(result.items.value).toEqual([])

    active.value = true
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(1)

    list.mockClear()
    auth.tenantId = ''
    withQuery(() => useNotifications({ unread: ref(false) }))
    await flushPromises()
    expect(list).not.toHaveBeenCalled()
  })

  it('flags a failed read and offers a reload', async () => {
    list.mockRejectedValue(new Error('boom'))
    const { result } = withQuery(() => useNotifications({ unread: ref(false) }))
    await flushPromises()
    expect(result.isError.value).toBe(true)

    list.mockResolvedValue({ items: [makeNotice('a')], nextCursor: null })
    await result.reload()
    await flushPromises()
    expect(result.isError.value).toBe(false)
    expect(result.items.value).toHaveLength(1)
  })
})
