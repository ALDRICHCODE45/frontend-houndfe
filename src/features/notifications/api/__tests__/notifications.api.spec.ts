/**
 * Notifications transport. Mocks the shared axios `http`; pins exact URLs, the params that are
 * sent (and the ones that never are) and the unwrapped bodies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http } from '@/core/shared/api/http'
import { notificationsApi } from '../notifications.api'

vi.mock('@/core/shared/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() } }))

const get = vi.mocked(http.get)
const post = vi.mocked(http.post)
const signal = new AbortController().signal

beforeEach(() => {
  get.mockReset()
  post.mockReset()
})

describe('notificationsApi reads', () => {
  it('list: GET /notifications with cursor, limit and unread=true, plus the signal', async () => {
    const page = { items: [], nextCursor: 'c2' }
    get.mockResolvedValue({ data: page })

    const result = await notificationsApi.list({ cursor: 'c1', limit: 20, unread: true }, { signal })

    expect(get).toHaveBeenCalledWith('/notifications', {
      params: { cursor: 'c1', limit: 20, unread: true },
      signal,
    })
    expect(result).toBe(page)
  })

  it('list: omits unread when false, and blank cursor, and never sends unknown params', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } })

    await notificationsApi.list({
      unread: false,
      cursor: '',
      // @ts-expect-error unknown params must never reach the wire
      foo: 'bar',
    })

    expect(get).toHaveBeenCalledWith('/notifications', { params: {}, signal: undefined })
  })

  it('unreadCount: GET /notifications/unread-count and unwraps the body', async () => {
    get.mockResolvedValue({ data: { count: 3 } })

    await expect(notificationsApi.unreadCount({ signal })).resolves.toEqual({ count: 3 })
    expect(get).toHaveBeenCalledWith('/notifications/unread-count', { signal })
  })

  it('getPreferences: GET /me/notification-preferences (not /notifications/preferences)', async () => {
    get.mockResolvedValue({ data: { emailEnabled: true, soundEnabled: false } })

    await expect(notificationsApi.getPreferences({ signal })).resolves.toEqual({
      emailEnabled: true,
      soundEnabled: false,
    })
    expect(get).toHaveBeenCalledWith('/me/notification-preferences', { signal })
  })
})

describe('notificationsApi commands', () => {
  it('markRead: POST /notifications/:id/read with no body', async () => {
    post.mockResolvedValue({ data: { id: 'n1', readAt: '2026-11-11T10:05:00.000Z' } })

    await expect(notificationsApi.markRead('n1')).resolves.toEqual({
      id: 'n1',
      readAt: '2026-11-11T10:05:00.000Z',
    })
    expect(post).toHaveBeenCalledWith('/notifications/n1/read')
  })

  it('markRead: encodes the id in the path', async () => {
    post.mockResolvedValue({ data: { id: 'a/b', readAt: 'x' } })
    await notificationsApi.markRead('a/b')
    expect(post).toHaveBeenCalledWith('/notifications/a%2Fb/read')
  })

  it('markAllRead: POST /notifications/read-all with no body', async () => {
    post.mockResolvedValue({ data: { updated: 4 } })

    await expect(notificationsApi.markAllRead()).resolves.toEqual({ updated: 4 })
    expect(post).toHaveBeenCalledWith('/notifications/read-all')
  })
})
