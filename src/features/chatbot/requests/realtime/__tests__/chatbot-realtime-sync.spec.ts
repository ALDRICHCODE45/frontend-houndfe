import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, type InfiniteData } from '@tanstack/vue-query'
import { createFakeRealtime } from '@/core/realtime/__tests__/fake-realtime'
import { chatbotMediaKeys, chatbotRequestKeys } from '../../constants/queryKeys'
import { makeGroup, makeRow } from '../../interfaces/__tests__/chatbot-request.fixture'
import type {
  ChatbotMessage,
  ChatbotRequestDetail,
  ChatbotRequestGroupsFilters,
  ChatbotRequestGroupsPage,
  ChatbotRequestRow,
  ChatbotRequestRowsPage,
} from '../../interfaces/chatbot-request.types'
import { makeMessage } from '../../utils/conversation-fixture'
import type { ConversationThread } from '../../utils/conversation-thread'
import { makeDetail } from '../../utils/detail-fixture'
import { startChatbotRealtimeSync } from '../chatbot-realtime-sync'

const TENANT = 'tenant-1'
const ME = 'u-me'

type GroupsData = InfiniteData<ChatbotRequestGroupsPage, string | undefined>
type RowsData = InfiniteData<ChatbotRequestRowsPage, string | undefined>

const groupsData = (...groups: ReturnType<typeof makeGroup>[]): GroupsData => ({
  pages: [{ items: groups, nextCursor: null }],
  pageParams: [undefined],
})
const rowsData = (...items: ChatbotRequestRow[]): RowsData => ({
  pages: [{ items, nextCursor: null }],
  pageParams: [undefined],
})

const OPEN_FILTERS: ChatbotRequestGroupsFilters = { status: 'open', limit: 25 }
const groupsKey = (filters: ChatbotRequestGroupsFilters = OPEN_FILTERS) => chatbotRequestKeys.groups(TENANT, filters)

function payload(request: ChatbotRequestRow, previousCustomerKey: string | null = null) {
  return {
    request,
    customer: { id: null, displayName: null, phone: '55 **** 5678', isTrusted: false },
    previousCustomerKey,
  }
}

const invalidated = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated === true
const rowsOf = (client: QueryClient, key = groupsKey()) =>
  (client.getQueryData<GroupsData>(key)?.pages ?? []).flatMap((p) => p.items.flatMap((g) => g.requests))

let client: QueryClient
let fake: ReturnType<typeof createFakeRealtime>
let stop: () => void
let userId: string | null

function start() {
  stop = startChatbotRealtimeSync({
    client,
    service: fake.service,
    getTenantId: () => TENANT,
    getUserId: () => userId,
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  fake = createFakeRealtime({ state: 'open', role: 'leader' })
  userId = ME
  start()
})
afterEach(() => {
  stop()
  vi.useRealTimers()
})

describe('subscription', () => {
  it('listens to every request.*, conversation, message.status, ready and resync event, and unsubscribes on stop', () => {
    for (const type of [
      'request.created',
      'request.claimed',
      'request.released',
      'request.reassigned',
      'request.resolved',
      'request.cancelled',
      'request.overdue',
      'request.updated',
      'conversation.message',
      'message.status',
      'ready',
      'resync',
    ]) {
      expect(fake.handlerCount(type), type).toBe(1)
    }
    stop()
    expect(fake.handlerCount('request.updated')).toBe(0)
    expect(fake.handlerCount('ready')).toBe(0)
    start()
  })

  it('does nothing without a tenant', () => {
    stop()
    stop = startChatbotRealtimeSync({ client, service: fake.service, getTenantId: () => '', getUserId: () => ME })
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a')))
    fake.emit('request.updated', payload(makeRow({ customerKey: 'k1.a', version: 2, summary: 'nuevo' })))
    vi.advanceTimersByTime(5_000)
    expect(rowsOf(client)[0]!.summary).toBe('Croquetas 15 kg')
  })
})

describe('request.* → groups cache', () => {
  const held = () => makeRow({ id: 'req-1', customerKey: 'k1.a', version: 3 })

  it('replaces the held row when the version is equal (SLA / unread changes keep the version) without refetching', () => {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a', [held()])))
    fake.emit('request.updated', payload(makeRow({ ...held(), unreadCustomerMessages: 4, slaLevel: 'HALF' })))
    expect(rowsOf(client)[0]).toMatchObject({ unreadCustomerMessages: 4, slaLevel: 'HALF' })
    vi.advanceTimersByTime(5_000)
    expect(invalidated(client, groupsKey())).toBe(false)
  })

  it('ignores a row whose version is lower than the held one', () => {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a', [held()])))
    fake.emit('request.updated', payload(makeRow({ ...held(), version: 2, summary: 'viejo' })))
    expect(rowsOf(client)[0]!.summary).toBe('Croquetas 15 kg')
    vi.advanceTimersByTime(5_000)
    expect(invalidated(client, groupsKey())).toBe(false)
  })

  it('a claim patches the row at once and refetches the list (group aggregates are the server\'s)', () => {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a', [held()])))
    fake.emit(
      'request.claimed',
      payload(
        makeRow({
          ...held(),
          version: 4,
          status: 'IN_PROGRESS',
          displayStatus: 'IN_PROGRESS',
          assignee: { id: 'u-2', displayName: 'Luis' },
          claimDeadlineAt: null,
          resolveDeadlineAt: '2026-11-11T20:00:00.000Z',
        }),
      ),
    )
    expect(rowsOf(client)[0]).toMatchObject({ status: 'IN_PROGRESS', version: 4 })
    vi.advanceTimersByTime(600)
    expect(invalidated(client, groupsKey())).toBe(true)
  })

  it('a resolved row leaves the open tab; an emptied group goes with it; the list is refetched', () => {
    client.setQueryData(
      groupsKey(),
      groupsData(makeGroup('k1.a', [held()]), makeGroup('k1.b', [makeRow({ id: 'req-9', customerKey: 'k1.b' })])),
    )
    fake.emit(
      'request.resolved',
      payload(makeRow({ ...held(), version: 4, status: 'RESOLVED', displayStatus: 'RESOLVED', closedAt: '2026-11-11T19:00:00.000Z' })),
    )
    const groups = client.getQueryData<GroupsData>(groupsKey())!.pages[0]!.items
    expect(groups.map((g) => g.customerKey)).toEqual(['k1.b'])
    vi.advanceTimersByTime(600)
    expect(invalidated(client, groupsKey())).toBe(true)
  })

  it('a resolved row is not put in the open tab but a refetch picks up the resolved tab', () => {
    const resolvedKey = groupsKey({ status: 'resolved', limit: 25 })
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a', [held()])))
    client.setQueryData(resolvedKey, groupsData())
    fake.emit(
      'request.resolved',
      payload(makeRow({ ...held(), version: 4, status: 'RESOLVED', displayStatus: 'RESOLVED' })),
    )
    vi.advanceTimersByTime(600)
    expect(invalidated(client, resolvedKey)).toBe(true)
  })

  it('a new row not held anywhere refetches the lists it belongs to, and leaves the ones it cannot match', () => {
    const resolvedKey = groupsKey({ status: 'resolved', limit: 25 })
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a', [held()])))
    client.setQueryData(resolvedKey, groupsData())
    fake.emit('request.created', payload(makeRow({ id: 'req-2', customerKey: 'k1.c', version: 1 })))
    vi.advanceTimersByTime(600)
    expect(invalidated(client, groupsKey())).toBe(true)
    expect(invalidated(client, resolvedKey)).toBe(false)
  })

  it('coalesces a burst of events into one list refetch', () => {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a', [held()])))
    const spy = vi.spyOn(client, 'invalidateQueries')
    for (let i = 0; i < 5; i += 1) {
      fake.emit('request.created', payload(makeRow({ id: `n-${i}`, customerKey: 'k1.z', version: 1 })))
    }
    vi.advanceTimersByTime(600)
    const listCalls = spy.mock.calls.filter(([f]) => JSON.stringify(f?.queryKey ?? '').includes('groups'))
    expect(listCalls.length).toBeLessThanOrEqual(1)
  })

  it('the «mine» filter drops a row somebody else just took', () => {
    const mineKey = groupsKey({ status: 'open', assignee: 'me', limit: 25 })
    client.setQueryData(
      mineKey,
      groupsData(makeGroup('k1.a', [makeRow({ ...held(), assignee: { id: ME, displayName: 'Yo' }, status: 'IN_PROGRESS' })])),
    )
    fake.emit(
      'request.reassigned',
      payload(makeRow({ ...held(), version: 4, status: 'IN_PROGRESS', assignee: { id: 'u-2', displayName: 'Luis' } })),
    )
    expect(rowsOf(client, mineKey)).toEqual([])
  })

  it('the «mine» filter without a known user cannot decide: it refetches instead of guessing', () => {
    userId = null
    const mineKey = groupsKey({ status: 'open', assignee: 'me', limit: 25 })
    client.setQueryData(mineKey, groupsData())
    fake.emit('request.claimed', payload(makeRow({ id: 'req-5', customerKey: 'k1.q', version: 2, status: 'IN_PROGRESS' })))
    vi.advanceTimersByTime(600)
    expect(invalidated(client, mineKey)).toBe(true)
  })

  it('an overdue filter drops a row that is no longer overdue and keeps one that still is', () => {
    const overdueKey = groupsKey({ status: 'open', overdue: true, limit: 25 })
    const overdue = makeRow({ ...held(), overdueAt: '2026-11-11T18:30:00.000Z', displayStatus: 'EXPIRED' })
    client.setQueryData(overdueKey, groupsData(makeGroup('k1.a', [overdue])))
    fake.emit('request.updated', payload({ ...overdue, summary: 'otro' }))
    expect(rowsOf(client, overdueKey)[0]!.summary).toBe('otro')
    fake.emit('request.updated', payload({ ...overdue, version: 4, overdueAt: null, displayStatus: 'NEW' }))
    expect(rowsOf(client, overdueKey)).toEqual([])
  })

  it('previousCustomerKey: the row leaves its old group and the lists are refetched to place it in the new one', () => {
    client.setQueryData(
      groupsKey(),
      groupsData(makeGroup('k1.old', [makeRow({ ...held(), customerKey: 'k1.old' }), makeRow({ id: 'req-2', customerKey: 'k1.old' })])),
    )
    fake.emit('request.updated', payload(makeRow({ ...held(), customerKey: 'k1.new', version: 4 }), 'k1.old'))
    expect(rowsOf(client).map((r) => r.id)).toEqual(['req-2'])
    vi.advanceTimersByTime(600)
    expect(invalidated(client, groupsKey())).toBe(true)
  })
})

describe('request.* → by-customer cache', () => {
  const params = { status: 'open' as const, limit: 25 }
  const keyOf = (customerKey: string) => chatbotRequestKeys.byCustomer(TENANT, customerKey, params)

  it('patches a held row in place', () => {
    client.setQueryData(keyOf('k1.a'), rowsData(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 2 })))
    fake.emit('request.updated', payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 2, unreadCustomerMessages: 3 })))
    expect(client.getQueryData<RowsData>(keyOf('k1.a'))!.pages[0]!.items[0]!.unreadCustomerMessages).toBe(3)
  })

  it('removes a row that left the tab (resolved)', () => {
    client.setQueryData(keyOf('k1.a'), rowsData(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 2 })))
    fake.emit(
      'request.resolved',
      payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 3, status: 'RESOLVED', displayStatus: 'RESOLVED' })),
    )
    expect(client.getQueryData<RowsData>(keyOf('k1.a'))!.pages[0]!.items).toEqual([])
  })

  it('a new row of that customer refetches its list; another customer\'s list is left alone', () => {
    client.setQueryData(keyOf('k1.a'), rowsData())
    client.setQueryData(keyOf('k1.b'), rowsData())
    fake.emit('request.created', payload(makeRow({ id: 'req-7', customerKey: 'k1.a', version: 1 })))
    vi.advanceTimersByTime(600)
    expect(invalidated(client, keyOf('k1.a'))).toBe(true)
    expect(invalidated(client, keyOf('k1.b'))).toBe(false)
  })

  it('previousCustomerKey moves it: gone from the old customer, refetch of the new customer\'s list', () => {
    client.setQueryData(keyOf('k1.old'), rowsData(makeRow({ id: 'req-1', customerKey: 'k1.old', version: 2 })))
    client.setQueryData(keyOf('k1.new'), rowsData())
    fake.emit('request.updated', payload(makeRow({ id: 'req-1', customerKey: 'k1.new', version: 3 }), 'k1.old'))
    expect(client.getQueryData<RowsData>(keyOf('k1.old'))!.pages[0]!.items).toEqual([])
    vi.advanceTimersByTime(600)
    expect(invalidated(client, keyOf('k1.new'))).toBe(true)
  })
})

describe('request.* → counts and history', () => {
  it('refetches the counts once, a second after the last event', () => {
    client.setQueryData(chatbotRequestKeys.counts(TENANT), { new: 1 })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const countsCalls = () =>
      spy.mock.calls.filter(([f]) => JSON.stringify(f?.queryKey) === JSON.stringify(chatbotRequestKeys.counts(TENANT))).length
    fake.emit('request.created', payload(makeRow({ id: 'a', version: 1 })))
    vi.advanceTimersByTime(600)
    fake.emit('request.claimed', payload(makeRow({ id: 'b', version: 2 })))
    vi.advanceTimersByTime(999)
    expect(countsCalls()).toBe(0)
    vi.advanceTimersByTime(1)
    expect(countsCalls()).toBe(1)
    expect(invalidated(client, chatbotRequestKeys.counts(TENANT))).toBe(true)
  })

  it('refetches the history when a request closes, not for other events', () => {
    const key = chatbotRequestKeys.history(TENANT, {})
    client.setQueryData(key, { pages: [], pageParams: [] })
    fake.emit('request.claimed', payload(makeRow({ id: 'a', version: 2 })))
    vi.advanceTimersByTime(2_000)
    expect(invalidated(client, key)).toBe(false)
    fake.emit('request.cancelled', payload(makeRow({ id: 'a', version: 3, status: 'CANCELLED', displayStatus: 'CANCELLED' })))
    vi.advanceTimersByTime(2_000)
    expect(invalidated(client, key)).toBe(true)
  })
})

describe('request.* → detail cache', () => {
  const key = chatbotRequestKeys.detail(TENANT, 'req-1')
  const base = () => makeDetail({ id: 'req-1', customerKey: 'k1.a', version: 3 })

  it('patches the row fields into the held detail and keeps what the row does not carry', () => {
    const detail = base()
    client.setQueryData(key, detail)
    fake.emit('request.updated', payload(makeRow({ ...detail, version: 3, unreadCustomerMessages: 5 })))
    const next = client.getQueryData<ChatbotRequestDetail>(key)!
    expect(next.unreadCustomerMessages).toBe(5)
    expect(next.audit).toEqual(detail.audit)
    expect(next.customer).toEqual(detail.customer)
    expect(invalidated(client, key)).toBe(false)
  })

  it('a claim that explains its +1 version is patched without refetching the detail', () => {
    client.setQueryData(key, base())
    fake.emit('request.claimed', payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 4, status: 'IN_PROGRESS' })))
    expect(client.getQueryData<ChatbotRequestDetail>(key)!.version).toBe(4)
    vi.advanceTimersByTime(2_000)
    expect(invalidated(client, key)).toBe(false)
  })

  it.each(['request.resolved', 'request.cancelled', 'request.reassigned'] as const)(
    '%s refetches the detail (audit, decision, deliveries)',
    (type) => {
      client.setQueryData(key, base())
      fake.emit(type, payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 4, status: 'RESOLVED' })))
      expect(invalidated(client, key)).toBe(true)
    },
  )

  it('a version jump larger than the event explains refetches the detail', () => {
    client.setQueryData(key, base())
    fake.emit('request.updated', payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 6 })))
    expect(invalidated(client, key)).toBe(true)
  })

  it('ignores a lower version and never creates a detail that was not cached', () => {
    client.setQueryData(key, base())
    fake.emit('request.updated', payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 1, summary: 'viejo' })))
    expect(client.getQueryData<ChatbotRequestDetail>(key)!.summary).not.toBe('viejo')
    fake.emit('request.updated', payload(makeRow({ id: 'req-404', version: 2 })))
    expect(client.getQueryData(chatbotRequestKeys.detail(TENANT, 'req-404'))).toBeUndefined()
  })

  it('refetches the audit list of the request when its version moved', () => {
    const auditKey = chatbotRequestKeys.audit(TENANT, 'req-1', { limit: 50 })
    client.setQueryData(key, base())
    client.setQueryData(auditKey, { pages: [], pageParams: [] })
    fake.emit('request.updated', payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 3 })))
    expect(invalidated(client, auditKey)).toBe(false)
    fake.emit('request.claimed', payload(makeRow({ id: 'req-1', customerKey: 'k1.a', version: 4 })))
    expect(invalidated(client, auditKey)).toBe(true)
  })

  it('patches the same request in «otras solicitudes abiertas» of another detail, and removes it once closed', () => {
    const otherKey = chatbotRequestKeys.detail(TENANT, 'req-2')
    const sibling = makeRow({ id: 'req-1', customerKey: 'k1.a', version: 3 })
    client.setQueryData(otherKey, makeDetail({ id: 'req-2', customerKey: 'k1.a', otherOpenRequests: [sibling] }))
    fake.emit('request.claimed', payload(makeRow({ ...sibling, version: 4, status: 'IN_PROGRESS' })))
    expect(client.getQueryData<ChatbotRequestDetail>(otherKey)!.otherOpenRequests[0]).toMatchObject({
      version: 4,
      status: 'IN_PROGRESS',
    })
    fake.emit('request.resolved', payload(makeRow({ ...sibling, version: 5, status: 'RESOLVED', displayStatus: 'RESOLVED' })))
    expect(client.getQueryData<ChatbotRequestDetail>(otherKey)!.otherOpenRequests).toEqual([])
  })

  it('a new request of the same customer refetches the details of its siblings', () => {
    const otherKey = chatbotRequestKeys.detail(TENANT, 'req-2')
    const elsewhere = chatbotRequestKeys.detail(TENANT, 'req-3')
    client.setQueryData(otherKey, makeDetail({ id: 'req-2', customerKey: 'k1.a' }))
    client.setQueryData(elsewhere, makeDetail({ id: 'req-3', customerKey: 'k1.zzz' }))
    fake.emit('request.created', payload(makeRow({ id: 'req-9', customerKey: 'k1.a', version: 1 })))
    expect(invalidated(client, otherKey)).toBe(true)
    expect(invalidated(client, elsewhere)).toBe(false)
  })
})

describe('malformed request payloads', () => {
  it('refetches the lists instead of throwing', () => {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a')))
    expect(() => fake.emit('request.updated', { nope: true })).not.toThrow()
    expect(() => fake.emit('request.updated', null)).not.toThrow()
    vi.advanceTimersByTime(600)
    expect(invalidated(client, groupsKey())).toBe(true)
  })
})

describe('conversation.message', () => {
  const key = chatbotRequestKeys.conversation(TENANT, 'req-1')
  const thread = (...items: ChatbotMessage[]): ConversationThread => ({ items, hasMoreBefore: true })
  const staff = (seq: number, deliveryStatus: ChatbotMessage['deliveryStatus'], extra: Partial<ChatbotMessage> = {}) =>
    makeMessage({ seq, direction: 'OUT', author: 'STAFF', deliveryStatus, ...extra })
  const itemsOf = () => client.getQueryData<ConversationThread>(key)!.items

  it('appends the next seq to the cached thread and keeps hasMoreBefore', () => {
    client.setQueryData(key, thread(makeMessage({ seq: 4 }), makeMessage({ seq: 5 })))
    fake.emit('conversation.message', { requestId: 'req-1', message: makeMessage({ seq: 6, text: 'nuevo' }) })
    expect(itemsOf().map((m) => m.seq)).toEqual([4, 5, 6])
    expect(client.getQueryData<ConversationThread>(key)!.hasMoreBefore).toBe(true)
    expect(invalidated(client, key)).toBe(false)
  })

  it('replaces a held seq by the delivered state, without moving a status backwards', () => {
    client.setQueryData(key, thread(staff(5, 'DELIVERED')))
    fake.emit('conversation.message', { requestId: 'req-1', message: staff(5, 'QUEUED') })
    expect(itemsOf()).toHaveLength(1)
    expect(itemsOf()[0]!.deliveryStatus).toBe('DELIVERED')
    fake.emit('conversation.message', { requestId: 'req-1', message: staff(5, 'READ', { text: 'editado' }) })
    expect(itemsOf()[0]).toMatchObject({ deliveryStatus: 'READ', text: 'editado' })
  })

  it('carries the clientMessageId so the live chat reconciles its local bubble', () => {
    client.setQueryData(key, thread(makeMessage({ seq: 1 })))
    fake.emit('conversation.message', { requestId: 'req-1', message: staff(2, 'QUEUED', { clientMessageId: 'cm-1' }) })
    expect(itemsOf().find((m) => m.clientMessageId === 'cm-1')?.seq).toBe(2)
  })

  it('a gap (holding 5, receiving 7) refetches the thread instead of skipping 6', () => {
    client.setQueryData(key, thread(makeMessage({ seq: 5 })))
    fake.emit('conversation.message', { requestId: 'req-1', message: makeMessage({ seq: 7 }) })
    expect(itemsOf().map((m) => m.seq)).toEqual([5])
    expect(invalidated(client, key)).toBe(true)
  })

  it('a message older than the loaded window is left to «Cargar anteriores»', () => {
    client.setQueryData(key, thread(makeMessage({ seq: 10 })))
    fake.emit('conversation.message', { requestId: 'req-1', message: makeMessage({ seq: 3 }) })
    expect(itemsOf().map((m) => m.seq)).toEqual([10])
    expect(invalidated(client, key)).toBe(false)
  })

  it('does nothing for a thread that is not cached, and survives a malformed message', () => {
    fake.emit('conversation.message', { requestId: 'req-1', message: makeMessage({ seq: 1 }) })
    expect(client.getQueryData(key)).toBeUndefined()
    client.setQueryData(key, thread(makeMessage({ seq: 1 })))
    expect(() => fake.emit('conversation.message', { requestId: 'req-1', message: { nope: 1 } })).not.toThrow()
    expect(invalidated(client, key)).toBe(true)
  })

  it('an empty cached thread takes seq 1 and refetches for anything later', () => {
    client.setQueryData(key, { items: [], hasMoreBefore: false })
    fake.emit('conversation.message', { requestId: 'req-1', message: makeMessage({ seq: 1 }) })
    expect(itemsOf().map((m) => m.seq)).toEqual([1])
    client.setQueryData(key, { items: [], hasMoreBefore: false })
    fake.emit('conversation.message', { requestId: 'req-1', message: makeMessage({ seq: 4 }) })
    expect(invalidated(client, key)).toBe(true)
  })
})

describe('message.status', () => {
  const key = chatbotRequestKeys.conversation(TENANT, 'req-1')
  const staff = (seq: number, deliveryStatus: ChatbotMessage['deliveryStatus']) =>
    makeMessage({ id: `msg-${seq}`, seq, direction: 'OUT', author: 'STAFF', deliveryStatus })
  const statusOf = (seq: number) =>
    client.getQueryData<ConversationThread>(key)!.items.find((m) => m.seq === seq)!.deliveryStatus
  const event = (seq: number, deliveryStatus: string) => ({
    requestId: 'req-1',
    messageId: `msg-${seq}`,
    seq,
    deliveryStatus,
  })

  it('moves a staff message forward on the ladder', () => {
    client.setQueryData(key, { items: [staff(5, 'QUEUED')], hasMoreBefore: false })
    fake.emit('message.status', event(5, 'SENT'))
    expect(statusOf(5)).toBe('SENT')
    fake.emit('message.status', event(5, 'READ'))
    expect(statusOf(5)).toBe('READ')
  })

  it('never moves it backwards (a late SENT after DELIVERED)', () => {
    client.setQueryData(key, { items: [staff(5, 'DELIVERED')], hasMoreBefore: false })
    fake.emit('message.status', event(5, 'SENT'))
    expect(statusOf(5)).toBe('DELIVERED')
  })

  it('takes DEFERRED, UNKNOWN and FAILED as they come (they are off the ladder)', () => {
    client.setQueryData(key, { items: [staff(5, 'SENT')], hasMoreBefore: false })
    fake.emit('message.status', event(5, 'DEFERRED'))
    expect(statusOf(5)).toBe('DEFERRED')
    fake.emit('message.status', event(5, 'SENT'))
    expect(statusOf(5)).toBe('SENT')
    fake.emit('message.status', event(5, 'FAILED'))
    expect(statusOf(5)).toBe('FAILED')
  })

  it('a seq newer than the thread refetches it; one older than the window is ignored', () => {
    client.setQueryData(key, { items: [staff(10, 'SENT')], hasMoreBefore: true })
    fake.emit('message.status', event(3, 'READ'))
    expect(invalidated(client, key)).toBe(false)
    fake.emit('message.status', event(12, 'SENT'))
    expect(invalidated(client, key)).toBe(true)
  })

  it('does nothing without a cached thread', () => {
    fake.emit('message.status', event(5, 'SENT'))
    expect(client.getQueryData(key)).toBeUndefined()
  })
})

describe('session.*', () => {
  const key = (id: string) => chatbotRequestKeys.detail(TENANT, id)

  it('refetches the detail of the request named by the event', () => {
    client.setQueryData(key('req-1'), makeDetail({ id: 'req-1' }))
    client.setQueryData(key('req-2'), makeDetail({ id: 'req-2' }))
    fake.emit('session.active', { requestId: 'req-1' })
    expect(invalidated(client, key('req-1'))).toBe(true)
    expect(invalidated(client, key('req-2'))).toBe(false)
  })

  it('reads the request id from a request row too, and refetches every detail when the payload names none', () => {
    client.setQueryData(key('req-1'), makeDetail({ id: 'req-1' }))
    client.setQueryData(key('req-2'), makeDetail({ id: 'req-2' }))
    fake.emit('session.ending', { request: { id: 'req-2' } })
    expect(invalidated(client, key('req-2'))).toBe(true)
    expect(invalidated(client, key('req-1'))).toBe(false)
    fake.emit('session.ended', {})
    expect(invalidated(client, key('req-1'))).toBe(true)
  })

  it('also refetches the inbox rows (the live session state is on them)', () => {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a')))
    fake.emit('session.starting', { requestId: 'req-1' })
    vi.advanceTimersByTime(600)
    expect(invalidated(client, groupsKey())).toBe(true)
  })
})

describe('ready and resync', () => {
  function seed() {
    client.setQueryData(groupsKey(), groupsData(makeGroup('k1.a')))
    client.setQueryData(chatbotRequestKeys.counts(TENANT), { new: 1 })
    client.setQueryData(chatbotRequestKeys.detail(TENANT, 'req-1'), makeDetail())
    client.setQueryData(chatbotRequestKeys.conversation(TENANT, 'req-1'), { items: [], hasMoreBefore: false })
    client.setQueryData(chatbotRequestKeys.groups('tenant-2', OPEN_FILTERS), groupsData())
    client.setQueryData(chatbotMediaKeys.file(TENANT, 'm-1'), 'blob')
  }

  it.each(['ready', 'resync'] as const)('%s refetches every chatbot query of the tenant and nothing else', (type) => {
    seed()
    fake.emit(type, type === 'ready' ? { serverTime: 'x', heartbeatSeconds: 15 } : { reason: 'CURSOR_EXPIRED' })
    expect(invalidated(client, groupsKey())).toBe(true)
    expect(invalidated(client, chatbotRequestKeys.counts(TENANT))).toBe(true)
    expect(invalidated(client, chatbotRequestKeys.detail(TENANT, 'req-1'))).toBe(true)
    expect(invalidated(client, chatbotRequestKeys.conversation(TENANT, 'req-1'))).toBe(true)
    expect(invalidated(client, chatbotRequestKeys.groups('tenant-2', OPEN_FILTERS))).toBe(false)
    expect(invalidated(client, chatbotMediaKeys.file(TENANT, 'm-1'))).toBe(false)
  })
})

describe('stop', () => {
  it('cancels pending debounced refetches', () => {
    client.setQueryData(chatbotRequestKeys.counts(TENANT), { new: 1 })
    fake.emit('request.created', payload(makeRow({ id: 'a', version: 1 })))
    stop()
    vi.advanceTimersByTime(5_000)
    expect(invalidated(client, chatbotRequestKeys.counts(TENANT))).toBe(false)
    start()
  })
})
