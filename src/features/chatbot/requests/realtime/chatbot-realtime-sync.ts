/**
 * Realtime → TanStack Query cache for the chatbot inbox (spec S5, task T4b; handoff 17 §3, §7 and
 * 18 §4). Installed once, app-wide, only when `VITE_REALTIME_SSE` is on: the cache stays right
 * whichever screen is open, and polling (slowed while the stream is open) remains the fallback.
 *
 * - `request.*`: patch the held row in groups, by-customer lists and the detail when its `version`
 *   is greater than or equal to the held one; refetch a list when patching is not safe (a new row,
 *   a move between customers, changed group aggregates). Counts are refetched, debounced.
 * - `conversation.message` / `message.status`: patch the cached thread by `seq` (status ladder in
 *   `conversation-thread`); the live chat's outbox reconciles by `clientMessageId` from that cache.
 * - `session.*`: refetch the detail.
 * - `ready` / `resync`: refetch every chatbot query (the stream cursor lives in memory only).
 */
import type { QueryClient, QueryKey } from '@tanstack/vue-query'
import type { RealtimeEnvelope, RealtimeHandler, RequestEventPayload } from '@/core/realtime/types'
import type { RealtimeService } from '@/core/realtime/realtime-service'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotRequestDetail, ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import {
  applyRealtimeMessage,
  applyRealtimeStatus,
  isThreadMessage,
  type ConversationThread,
  type ThreadPatch,
} from '../utils/conversation-thread'
import {
  isRequestRow,
  mergeRowIntoDetail,
  patchCustomerRows,
  patchGroups,
  patchOtherOpen,
  type GroupsCache,
  type ListFilters,
  type RowsCache,
} from './request-cache-patch'

export interface ChatbotRealtimeSyncOptions {
  client: QueryClient
  service: Pick<RealtimeService, 'on' | 'onAny'>
  getTenantId(): string
  /** For `assignee=me` lists; `null` when unknown (those lists are then refetched, not guessed). */
  getUserId(): string | null
  /** Counts refetch, this long after the last `request.*` event (handoff 17 §7). Default 1 s. */
  countsDebounceMs?: number
  /** Coalescing window of list refetches. Default 0.5 s. */
  listsDebounceMs?: number
}

const REQUEST_TYPES = [
  'request.created',
  'request.claimed',
  'request.released',
  'request.reassigned',
  'request.resolved',
  'request.cancelled',
  'request.overdue',
  'request.updated',
] as const
type RequestType = (typeof REQUEST_TYPES)[number]

/** After these the detail's audit, decision and deliveries changed beyond the row (handoff 17 §3.1). */
const DETAIL_REFETCH_TYPES: ReadonlySet<RequestType> = new Set([
  'request.resolved',
  'request.cancelled',
  'request.reassigned',
])
const CLOSING_TYPES: ReadonlySet<RequestType> = new Set(['request.resolved', 'request.cancelled'])
/** A burst that never pauses still refetches this often. */
const MAX_WAIT_MS = 5_000

export function startChatbotRealtimeSync(options: ChatbotRealtimeSyncOptions): () => void {
  const { client, service } = options
  const countsMs = options.countsDebounceMs ?? 1_000
  const listsMs = options.listsDebounceMs ?? 500

  // ─── Debounced refetches ─────────────────────────────────────────────────────
  interface Timer {
    handle: ReturnType<typeof setTimeout>
    startedAt: number
  }
  const timers = new Map<string, Timer>()
  function debounce(name: string, ms: number, run: () => void) {
    const held = timers.get(name)
    const startedAt = held?.startedAt ?? Date.now()
    if (held) clearTimeout(held.handle)
    const wait = Math.max(0, Math.min(ms, startedAt + MAX_WAIT_MS - Date.now()))
    timers.set(name, {
      startedAt,
      handle: setTimeout(() => {
        timers.delete(name)
        run()
      }, wait),
    })
  }

  const pendingLists = new Map<string, QueryKey>()
  function queueListRefetch(key: QueryKey) {
    pendingLists.set(JSON.stringify(key), key)
    debounce('lists', listsMs, () => {
      const keys = [...pendingLists.values()]
      pendingLists.clear()
      for (const queryKey of keys) void client.invalidateQueries({ queryKey, exact: true })
    })
  }
  function queueCountsRefetch(tenant: string) {
    debounce('counts', countsMs, () => {
      void client.invalidateQueries({ queryKey: chatbotRequestKeys.counts(tenant), exact: true })
    })
  }
  function queueKindRefetch(tenant: string, kind: string) {
    for (const [key] of client.getQueriesData({ queryKey: [...chatbotRequestKeys.all(tenant), kind] })) {
      queueListRefetch(key)
    }
  }

  const refetchNow = (key: QueryKey) => void client.invalidateQueries({ queryKey: key, exact: true })

  // ─── request.* ───────────────────────────────────────────────────────────────
  function onRequest(type: RequestType, payload: unknown) {
    const tenant = options.getTenantId()
    if (!tenant) return
    const event = payload as Partial<RequestEventPayload> | null
    const request = event?.request
    if (!isRequestRow(request)) {
      // Not a row we can place: read the lists again instead of guessing.
      queueKindRefetch(tenant, 'groups')
      queueKindRefetch(tenant, 'by-customer')
      queueCountsRefetch(tenant)
      return
    }
    const row = request
    const previousCustomerKey = typeof event?.previousCustomerKey === 'string' ? event.previousCustomerKey : null
    const userId = options.getUserId()

    for (const [key, data] of client.getQueriesData<GroupsCache>({
      queryKey: [...chatbotRequestKeys.all(tenant), 'groups'],
    })) {
      if (!data) continue
      const filters = (key[3] ?? {}) as ListFilters
      const patched = patchGroups(data, row, previousCustomerKey, filters, userId)
      if (patched.data !== data) client.setQueryData(key, patched.data)
      if (patched.refetch) queueListRefetch(key)
    }

    for (const [key, data] of client.getQueriesData<RowsCache>({
      queryKey: [...chatbotRequestKeys.all(tenant), 'by-customer'],
    })) {
      if (!data) continue
      const customerKey = String(key[3] ?? '')
      const params = (key[4] ?? {}) as ListFilters
      const patched = patchCustomerRows(data, row, customerKey, params, userId)
      if (patched.data !== data) client.setQueryData(key, patched.data)
      if (patched.refetch) queueListRefetch(key)
    }

    if (CLOSING_TYPES.has(type)) queueKindRefetch(tenant, 'history')
    queueCountsRefetch(tenant)
    patchDetails(tenant, type, row, previousCustomerKey)
  }

  function patchDetails(tenant: string, type: RequestType, row: ChatbotRequestRow, previousCustomerKey: string | null) {
    const ownKey = chatbotRequestKeys.detail(tenant, row.id)
    const own = client.getQueryData<ChatbotRequestDetail>(ownKey)
    if (own && row.version >= own.version) {
      client.setQueryData(ownKey, mergeRowIntoDetail(own, row))
      if (row.version > own.version) {
        void client.invalidateQueries({ queryKey: chatbotRequestKeys.audit(tenant, row.id) })
      }
      // Refetch what the row does not carry when the event says it changed (handoff 17 §3.1).
      if (DETAIL_REFETCH_TYPES.has(type) || row.version > own.version + 1) refetchNow(ownKey)
    }

    for (const [key, detail] of client.getQueriesData<ChatbotRequestDetail>({
      queryKey: [...chatbotRequestKeys.all(tenant), 'detail'],
    })) {
      if (!detail || detail.id === row.id) continue
      const patched = patchOtherOpen(detail, row)
      if (patched) {
        client.setQueryData(key, patched)
      } else if (
        detail.customerKey === row.customerKey &&
        (type === 'request.created' || previousCustomerKey !== null) &&
        !detail.otherOpenRequests.some((r) => r.id === row.id)
      ) {
        refetchNow(key)
      }
    }
  }

  // ─── conversation ────────────────────────────────────────────────────────────
  function patchThread(requestId: string, edit: (thread: ConversationThread) => ThreadPatch) {
    const tenant = options.getTenantId()
    if (!tenant || !requestId) return
    const key = chatbotRequestKeys.conversation(tenant, requestId)
    const held = client.getQueryData<ConversationThread>(key)
    if (!held) return
    const result = edit(held)
    if (result === 'refetch') refetchNow(key)
    else if (result) client.setQueryData(key, result)
  }

  const onMessage: RealtimeHandler<unknown> = (payload) => {
    const event = payload as { requestId?: unknown; message?: unknown } | null
    if (typeof event?.requestId !== 'string') return
    const message = event.message
    patchThread(event.requestId, (thread) => (isThreadMessage(message) ? applyRealtimeMessage(thread, message) : 'refetch'))
  }

  const onStatus: RealtimeHandler<unknown> = (payload) => {
    const event = payload as { requestId?: unknown; messageId?: unknown; seq?: unknown; deliveryStatus?: unknown } | null
    if (typeof event?.requestId !== 'string') return
    const { messageId, seq, deliveryStatus } = event
    patchThread(event.requestId, (thread) =>
      typeof messageId === 'string' && typeof seq === 'number' && typeof deliveryStatus === 'string'
        ? applyRealtimeStatus(thread, { messageId, seq, deliveryStatus })
        : 'refetch',
    )
  }

  // ─── session.* ───────────────────────────────────────────────────────────────
  function onSession(envelope: RealtimeEnvelope) {
    if (!envelope.type.startsWith('session.')) return
    const tenant = options.getTenantId()
    if (!tenant) return
    const data = envelope.data as { requestId?: unknown; request?: { id?: unknown } } | null
    const id =
      typeof data?.requestId === 'string' ? data.requestId : typeof data?.request?.id === 'string' ? data.request.id : null
    if (id) refetchNow(chatbotRequestKeys.detail(tenant, id))
    else void client.invalidateQueries({ queryKey: [...chatbotRequestKeys.all(tenant), 'detail'] })
    // The live session state also rides on the inbox rows.
    queueKindRefetch(tenant, 'groups')
    queueKindRefetch(tenant, 'by-customer')
  }

  // ─── ready / resync ──────────────────────────────────────────────────────────
  const refetchAll: RealtimeHandler<unknown> = () => {
    const tenant = options.getTenantId()
    if (!tenant) return
    void client.invalidateQueries({ queryKey: chatbotRequestKeys.all(tenant) })
  }

  const offs: Array<() => void> = []
  for (const type of REQUEST_TYPES) {
    offs.push(service.on(type, (payload) => onRequest(type, payload)))
  }
  offs.push(service.on('conversation.message', onMessage))
  offs.push(service.on('message.status', onStatus))
  offs.push(service.on('ready', refetchAll))
  offs.push(service.on('resync', refetchAll))
  offs.push(service.onAny(onSession))

  return () => {
    for (const off of offs) off()
    for (const { handle } of timers.values()) clearTimeout(handle)
    timers.clear()
    pendingLists.clear()
  }
}
