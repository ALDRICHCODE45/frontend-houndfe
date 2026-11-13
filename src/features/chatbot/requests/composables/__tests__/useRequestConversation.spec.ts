import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { focusManager } from '@tanstack/vue-query'
import { axiosError, withQuery } from './withQuery'
import { chatbotRequestKeys } from '../../constants/queryKeys'
import { makeMessage } from '../../utils/conversation-fixture'
import type { ChatbotConversationPage } from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-conversation.api', () => ({
  chatbotConversationApi: { getPage: vi.fn(), getMedia: vi.fn() },
}))

const auth = vi.hoisted(() => ({ perms: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

import { chatbotConversationApi } from '../../api/chatbot-conversation.api'
import {
  CONVERSATION_LIVE_POLL_MS,
  CONVERSATION_PAGE_SIZE,
  CONVERSATION_POLL_MS,
  useRequestConversation,
} from '../useRequestConversation'

const getPage = vi.mocked(chatbotConversationApi.getPage)
const msgs = (...seqs: number[]) => seqs.map((seq) => makeMessage({ seq }))
const page = (seqs: number[], hasMoreBefore = false): ChatbotConversationPage => ({
  items: msgs(...seqs),
  hasMoreBefore,
})
const seqsOf = (list: { seq: number }[]) => list.map((m) => m.seq)

beforeEach(() => {
  getPage.mockReset()
  auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
  auth.tenantId = 'tenant-1'
  focusManager.setFocused(undefined)
})
afterEach(() => {
  vi.useRealTimers()
  focusManager.setFocused(undefined)
})

describe('useRequestConversation — access', () => {
  it('reads nothing without read:ChatbotConversation (the server would answer an empty page)', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()
    expect(getPage).not.toHaveBeenCalled()
    expect(result.isEnabled.value).toBe(false)
    expect(result.messages.value).toEqual([])
  })

  it('reads nothing without read:ChatbotRequest, a tenant or an id', async () => {
    auth.perms = new Set(['read:ChatbotConversation'])
    withQuery(() => useRequestConversation('req-1'))
    auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
    auth.tenantId = ''
    withQuery(() => useRequestConversation('req-1'))
    auth.tenantId = 'tenant-1'
    withQuery(() => useRequestConversation(null))
    await flushPromises()
    expect(getPage).not.toHaveBeenCalled()
  })
})

describe('useRequestConversation — initial page and older pages', () => {
  it('opens on the latest page (no cursor), ascending by seq, under the tenant key', async () => {
    getPage.mockResolvedValue(page([17, 18, 19], true))
    const { result, client } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    expect(getPage).toHaveBeenCalledTimes(1)
    expect(getPage).toHaveBeenCalledWith('req-1', { limit: CONVERSATION_PAGE_SIZE }, { signal: expect.anything() })
    expect(seqsOf(result.messages.value)).toEqual([17, 18, 19])
    expect(result.hasMoreBefore.value).toBe(true)
    expect(client.getQueryData(chatbotRequestKeys.conversation('tenant-1', 'req-1'))).toBeTruthy()
  })

  it('«Cargar mensajes anteriores» asks before the lowest seq and merges without duplicates', async () => {
    getPage.mockResolvedValueOnce(page([17, 18, 19], true))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    getPage.mockResolvedValueOnce(page([15, 16, 17], false)) // 17 overlaps
    await result.loadOlder()

    expect(getPage).toHaveBeenLastCalledWith('req-1', { before: 17, limit: CONVERSATION_PAGE_SIZE })
    expect(seqsOf(result.messages.value)).toEqual([15, 16, 17, 18, 19])
    expect(result.hasMoreBefore.value).toBe(false)
  })

  it('does not ask for older pages when there are none, nor twice at once', async () => {
    getPage.mockResolvedValueOnce(page([1, 2], false))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()
    await result.loadOlder()
    expect(getPage).toHaveBeenCalledTimes(1)

    getPage.mockReset()
    getPage.mockResolvedValueOnce(page([10, 11], true))
    const second = withQuery(() => useRequestConversation('req-2'))
    await flushPromises()
    let release!: (value: ChatbotConversationPage) => void
    getPage.mockReturnValueOnce(new Promise((resolve) => (release = resolve)))
    const first = second.result.loadOlder()
    void second.result.loadOlder()
    expect(second.result.isLoadingOlder.value).toBe(true)
    release(page([8, 9], false))
    await first
    expect(getPage).toHaveBeenCalledTimes(2)
  })

  it('keeps the thread and reports the failure when an older page fails; a retry works', async () => {
    getPage.mockResolvedValueOnce(page([17, 18], true))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    getPage.mockRejectedValueOnce(axiosError(500))
    await result.loadOlder()
    expect(result.olderError.value).toBeTruthy()
    expect(seqsOf(result.messages.value)).toEqual([17, 18])
    expect(result.hasMoreBefore.value).toBe(true)

    getPage.mockResolvedValueOnce(page([16], false))
    await result.loadOlder()
    expect(result.olderError.value).toBeNull()
    expect(seqsOf(result.messages.value)).toEqual([16, 17, 18])
  })

  it('drops loaded older pages when the request id changes', async () => {
    const id = ref('req-1')
    getPage.mockResolvedValueOnce(page([17, 18], true))
    const { result } = withQuery(() => useRequestConversation(id))
    await flushPromises()
    getPage.mockResolvedValueOnce(page([15, 16], false))
    await result.loadOlder()

    getPage.mockResolvedValueOnce(page([5, 6], true))
    id.value = 'req-2'
    await flushPromises()
    expect(seqsOf(result.messages.value)).toEqual([5, 6])
    expect(result.hasMoreBefore.value).toBe(true)
  })
})

describe('useRequestConversation — states', () => {
  it('is loading, then empty for an empty page (a reader with permission: «Todavía no hay mensajes»)', async () => {
    getPage.mockResolvedValue(page([]))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    expect(result.isLoading.value).toBe(true)
    await flushPromises()
    expect(result.isLoading.value).toBe(false)
    expect(result.isError.value).toBe(false)
    expect(result.messages.value).toEqual([])
  })

  it('reports an error with retry, and does not poll while it has nothing to show', async () => {
    vi.useFakeTimers()
    getPage.mockRejectedValueOnce(axiosError(500))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()
    expect(result.isError.value).toBe(true)

    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS * 2)
    expect(getPage).toHaveBeenCalledTimes(1)

    getPage.mockResolvedValueOnce(page([1]))
    await result.refetch()
    await flushPromises()
    expect(result.isError.value).toBe(false)
    expect(seqsOf(result.messages.value)).toEqual([1])
  })
})

describe('useRequestConversation — polling newer messages', () => {
  it('asks after the highest seq every 15 s and appends, replacing a seq it already holds', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValueOnce({
      items: [makeMessage({ seq: 4 }), makeMessage({ seq: 5, direction: 'OUT', author: 'BOT', deliveryStatus: 'SENT' })],
      hasMoreBefore: true,
    })
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()
    expect(getPage).toHaveBeenCalledTimes(1)

    getPage.mockResolvedValueOnce({
      items: [makeMessage({ seq: 5, direction: 'OUT', author: 'BOT', deliveryStatus: 'READ' }), makeMessage({ seq: 6 })],
      hasMoreBefore: true,
    })
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS)

    expect(getPage).toHaveBeenLastCalledWith('req-1', { after: 5, limit: CONVERSATION_PAGE_SIZE }, { signal: expect.anything() })
    expect(seqsOf(result.messages.value)).toEqual([4, 5, 6])
    expect(result.messages.value[1]!.deliveryStatus).toBe('READ')
    expect(result.hasMoreBefore.value).toBe(true)
  })

  it('keeps asking after the new highest seq while a page comes back full', async () => {
    vi.useFakeTimers()
    const full = Array.from({ length: CONVERSATION_PAGE_SIZE }, (_, i) => 11 + i) // 11..60
    getPage.mockResolvedValueOnce(page([10]))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    getPage.mockResolvedValueOnce(page(full)).mockResolvedValueOnce(page([61]))
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS)

    expect(getPage).toHaveBeenNthCalledWith(3, 'req-1', { after: 60, limit: CONVERSATION_PAGE_SIZE }, { signal: expect.anything() })
    expect(result.messages.value[result.messages.value.length - 1]!.seq).toBe(61)
  })

  it('does not poll while the tab is hidden, and resumes when it is visible again', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValue(page([1]))
    withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    focusManager.setFocused(false)
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS * 3)
    expect(getPage).toHaveBeenCalledTimes(1)

    getPage.mockResolvedValue({ items: [], hasMoreBefore: false })
    focusManager.setFocused(true)
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS)
    expect(getPage.mock.calls.length).toBeGreaterThan(1)
  })

  it('stops polling after a 403 or a 404 and never polls without both permissions', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValueOnce(page([1]))
    withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    getPage.mockRejectedValueOnce(axiosError(403, { code: 'INSUFFICIENT_PERMISSIONS' }))
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS)
    expect(getPage).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS * 3)
    expect(getPage).toHaveBeenCalledTimes(2)

    getPage.mockReset()
    auth.perms = new Set(['read:ChatbotRequest'])
    withQuery(() => useRequestConversation('req-9'))
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS * 3)
    expect(getPage).not.toHaveBeenCalled()
  })

  it('a failed poll keeps the messages already on screen', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValueOnce(page([1, 2]))
    const { result } = withQuery(() => useRequestConversation('req-1'))
    await flushPromises()

    getPage.mockRejectedValueOnce(axiosError(503))
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS)
    expect(seqsOf(result.messages.value)).toEqual([1, 2])
    expect(result.isError.value).toBe(false)
  })
})

describe('useRequestConversation — opening resets the unread count (server side)', () => {
  const key = (name: string) => ['chatbot-requests', 'tenant-1', name, 'x']

  it('invalidates groups and by-customer once after the first load and zeroes the cached detail count without refetching it', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValue(page([1]))
    const { client } = withQuery(() => useRequestConversation('req-1'))
    client.setQueryData(key('groups'), { items: [] })
    client.setQueryData(key('by-customer'), { items: [] })
    client.setQueryData(chatbotRequestKeys.detail('tenant-1', 'req-1'), { id: 'req-1', unreadCustomerMessages: 3 })
    client.setQueryData(key('counts'), {})
    const spy = vi.spyOn(client, 'invalidateQueries')

    await flushPromises()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(key('groups'))!.isInvalidated).toBe(true)
    expect(client.getQueryState(key('by-customer'))!.isInvalidated).toBe(true)
    expect(client.getQueryState(chatbotRequestKeys.detail('tenant-1', 'req-1'))!.isInvalidated).toBe(false)
    expect(client.getQueryData(chatbotRequestKeys.detail('tenant-1', 'req-1'))).toEqual({
      id: 'req-1',
      unreadCustomerMessages: 0,
    })
    expect(client.getQueryState(key('counts'))!.isInvalidated).toBe(false)
    expect(client.getQueryState(chatbotRequestKeys.conversation('tenant-1', 'req-1'))!.isInvalidated).toBe(false)

    getPage.mockResolvedValue({ items: [], hasMoreBefore: false })
    await vi.advanceTimersByTimeAsync(CONVERSATION_POLL_MS * 2)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not invalidate anything when the first load fails', async () => {
    getPage.mockRejectedValue(axiosError(500))
    const { client } = withQuery(() => useRequestConversation('req-1'))
    const spy = vi.spyOn(client, 'invalidateQueries')
    await flushPromises()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('useRequestConversation — the attendee without read:ChatbotConversation (handoff 20 §5)', () => {
  it('reads the session thread when the caller says they are the attendee', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    getPage.mockResolvedValue(page([21, 22]))
    const { result } = withQuery(() => useRequestConversation('req-1', { asAttendee: () => true }))
    await flushPromises()

    expect(getPage).toHaveBeenCalledTimes(1)
    expect(result.isEnabled.value).toBe(true)
    expect(seqsOf(result.messages.value)).toEqual([21, 22])
  })

  it('still reads nothing for someone who is neither a reader nor the attendee', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    const { result } = withQuery(() => useRequestConversation('req-1', { asAttendee: () => false }))
    await flushPromises()
    expect(getPage).not.toHaveBeenCalled()
    expect(result.isEnabled.value).toBe(false)
  })

  it('never reads without read:ChatbotRequest, even as the attendee', async () => {
    auth.perms = new Set()
    withQuery(() => useRequestConversation('req-1', { asAttendee: () => true }))
    await flushPromises()
    expect(getPage).not.toHaveBeenCalled()
  })

  it('does not zero the unread count nor invalidate the lists: opening as attendee does not move the marker', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    getPage.mockResolvedValue(page([21]))
    const { client } = withQuery(() => useRequestConversation('req-1', { asAttendee: () => true }))
    const detailKey = chatbotRequestKeys.detail('tenant-1', 'req-1')
    client.setQueryData(detailKey, { id: 'req-1', unreadCustomerMessages: 3 })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await flushPromises()

    expect(client.getQueryData<{ unreadCustomerMessages: number }>(detailKey)!.unreadCustomerMessages).toBe(3)
    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe('useRequestConversation — T5L.F: an attendee who also reads conversations does not move the marker', () => {
  it('keeps the cached unread count and invalidates nothing when opened as the attendee', async () => {
    auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
    getPage.mockResolvedValue(page([21]))
    const { client } = withQuery(() => useRequestConversation('req-1', { asAttendee: () => true }))
    const detailKey = chatbotRequestKeys.detail('tenant-1', 'req-1')
    client.setQueryData(detailKey, { id: 'req-1', unreadCustomerMessages: 3 })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    await flushPromises()

    expect(client.getQueryData<{ unreadCustomerMessages: number }>(detailKey)!.unreadCustomerMessages).toBe(3)
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('a reader who is not the attendee still marks it opened', async () => {
    auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation'])
    getPage.mockResolvedValue(page([21]))
    const { client } = withQuery(() => useRequestConversation('req-1', { asAttendee: () => false }))
    const detailKey = chatbotRequestKeys.detail('tenant-1', 'req-1')
    client.setQueryData(detailKey, { id: 'req-1', unreadCustomerMessages: 3 })
    await flushPromises()
    expect(client.getQueryData<{ unreadCustomerMessages: number }>(detailKey)!.unreadCustomerMessages).toBe(0)
  })
})

describe('useRequestConversation — live mode polls faster and refreshes delivery states', () => {
  const out = (seq: number, deliveryStatus: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ', extra = {}) =>
    makeMessage({ seq, direction: 'OUT', author: 'STAFF', deliveryStatus, ...extra })

  it('polls every few seconds instead of 15 s', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValue(page([1]))
    withQuery(() => useRequestConversation('req-1', { live: () => true }))
    await flushPromises()
    expect(getPage).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(CONVERSATION_LIVE_POLL_MS)
    expect(getPage).toHaveBeenCalledTimes(2)
    expect(CONVERSATION_LIVE_POLL_MS).toBeLessThan(CONVERSATION_POLL_MS)
  })

  it('keeps the 15 s pace when not live', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValue(page([1]))
    withQuery(() => useRequestConversation('req-1', { live: () => false }))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(CONVERSATION_LIVE_POLL_MS)
    expect(getPage).toHaveBeenCalledTimes(1)
  })

  it('re-reads from the oldest message that can still change state, so QUEUED → SENT → DELIVERED shows up', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValueOnce({ items: [makeMessage({ seq: 4 }), out(5, 'QUEUED'), makeMessage({ seq: 6 })], hasMoreBefore: false })
    const { result } = withQuery(() => useRequestConversation('req-1', { live: () => true }))
    await flushPromises()

    getPage.mockResolvedValueOnce({ items: [out(5, 'DELIVERED'), makeMessage({ seq: 6 })], hasMoreBefore: false })
    await vi.advanceTimersByTimeAsync(CONVERSATION_LIVE_POLL_MS)

    expect(getPage).toHaveBeenLastCalledWith('req-1', { after: 4, limit: CONVERSATION_PAGE_SIZE }, { signal: expect.anything() })
    expect(result.messages.value.find((m) => m.seq === 5)!.deliveryStatus).toBe('DELIVERED')
  })

  it('goes back to «after the highest seq» once everything is READ, FAILED or UNKNOWN', async () => {
    vi.useFakeTimers()
    getPage.mockResolvedValueOnce({ items: [out(5, 'READ'), makeMessage({ seq: 6 })], hasMoreBefore: false })
    withQuery(() => useRequestConversation('req-1', { live: () => true }))
    await flushPromises()

    getPage.mockResolvedValueOnce(page([]))
    await vi.advanceTimersByTimeAsync(CONVERSATION_LIVE_POLL_MS)
    expect(getPage).toHaveBeenLastCalledWith('req-1', { after: 6, limit: CONVERSATION_PAGE_SIZE }, { signal: expect.anything() })
  })

  it('does not re-read an old DELIVERED message forever: only the last page of messages counts', async () => {
    vi.useFakeTimers()
    const filler = Array.from({ length: CONVERSATION_PAGE_SIZE }, (_, i) => makeMessage({ seq: 10 + i }))
    getPage.mockResolvedValueOnce({ items: [out(5, 'DELIVERED'), ...filler], hasMoreBefore: false })
    withQuery(() => useRequestConversation('req-1', { live: () => true }))
    await flushPromises()

    getPage.mockResolvedValueOnce(page([]))
    await vi.advanceTimersByTimeAsync(CONVERSATION_LIVE_POLL_MS)
    expect(getPage).toHaveBeenLastCalledWith('req-1', { after: 59, limit: CONVERSATION_PAGE_SIZE }, { signal: expect.anything() })
  })
})
