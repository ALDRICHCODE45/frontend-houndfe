import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import { chatbotConversationApi } from '../api/chatbot-conversation.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type { ChatbotMessage } from '../interfaces/chatbot-request.types'
import {
  appendNewer,
  emptyThread,
  firstSeq,
  lastSeq,
  prependOlder,
  type ConversationThread,
} from '../utils/conversation-thread'
import { useRequestAccess } from './useRequestAccess'

/** Messages per page (the backend allows 1–100, default 50). */
export const CONVERSATION_PAGE_SIZE = 50
/** Newer messages are polled every 15 s while the tab is visible (SSE of handoff 17 stays off). */
export const CONVERSATION_POLL_MS = 15_000
/** While a live session runs the thread is polled every 4 s (handoff 18 §5: 3 to 5 s until the stream is on). */
export const CONVERSATION_LIVE_POLL_MS = 4_000
/** Delivery states that can still move forward (handoff 20 §3): the poll re-reads from the oldest of them. */
const VOLATILE_STATUSES: ReadonlySet<string> = new Set(['QUEUED', 'SENT', 'DELIVERED', 'DEFERRED'])
/** Upper bound of back-to-back `after` pages in one poll (a full page means there may be more). */
const MAX_CATCH_UP_PAGES = 10

/** Cached list queries whose `unreadCustomerMessages` the server resets when the conversation is opened. */
const UNREAD_BEARING_LISTS = new Set(['groups', 'by-customer'])

export interface UseRequestConversationOptions {
  /**
   * The caller is the attendee of this request: without `read:ChatbotConversation` the server answers
   * them the messages of their own session (handoff 20 §5), so the read is allowed. That read never
   * moves the unread marker, so nothing is zeroed or invalidated for it.
   */
  asAttendee?: MaybeRefOrGetter<boolean>
  /** A live session is running: poll every 4 s and re-read messages whose delivery state can still move. */
  live?: MaybeRefOrGetter<boolean>
}

/**
 * Where the next poll starts. Polling `after` the highest `seq` never sees a status change of a
 * message already held, so a live thread re-reads from the oldest recent staff message that can
 * still move (QUEUED, SENT, DELIVERED, DEFERRED). Only the last page counts: an old DELIVERED that
 * never turns READ must not keep the cursor back forever.
 */
function pollCursor(items: readonly ChatbotMessage[], live: boolean): number | null {
  const last = lastSeq(items)
  if (!live || last === null) return last
  const volatile = items
    .slice(-CONVERSATION_PAGE_SIZE)
    .find((message) => message.author === 'STAFF' && !!message.deliveryStatus && VOLATILE_STATUSES.has(message.deliveryStatus))
  return volatile ? Math.min(last, volatile.seq - 1) : last
}

/**
 * The chat of one request (handoff 18): latest page first, older pages on demand (`before`), newer
 * messages by polling (`after`), all merged by `seq` in one cached thread per tenant and request.
 *
 * Enabled with `read:ChatbotRequest` plus `read:ChatbotConversation`, or as the attendee of the
 * request (`asAttendee`, handoff 20 §5: the server then answers their own session). Anyone else
 * would get an empty page, which must not read as «sin mensajes», so the block is simply not read
 * (the view keeps its limited-view note). `live` polls every 4 s and refreshes delivery states. The first successful read of a
 * request marks it opened on the server (unread count to 0): the lists are invalidated once, and the
 * cached detail (which is on screen and does not show the count) is zeroed in place, not refetched.
 */
export function useRequestConversation(
  id: MaybeRefOrGetter<string | null | undefined>,
  options: UseRequestConversationOptions = {},
) {
  const client = useQueryClient()
  const auth = useAuthStore()
  const { tenantId, enabled: canReadRequest } = useRequestAccess()
  const requestId = computed(() => toValue(id)?.trim() ?? '')
  const isReader = computed(() => auth.userCan('read', 'ChatbotConversation'))
  const attendee = computed(() => (options.asAttendee ? toValue(options.asAttendee) : false))
  const live = computed(() => (options.live ? toValue(options.live) : false))
  const enabled = computed(
    () =>
      canReadRequest.value && (isReader.value || attendee.value) && requestId.value.length > 0,
  )
  const key = computed(() => chatbotRequestKeys.conversation(tenantId.value, requestId.value))

  let openedFor: string | null = null
  function markOpened(tenant: string, request: string) {
    const scope = `${tenant}:${request}`
    if (openedFor === scope) return
    openedFor = scope
    client.setQueryData<{ unreadCustomerMessages?: number }>(
      chatbotRequestKeys.detail(tenant, request),
      (held) => (held && held.unreadCustomerMessages ? { ...held, unreadCustomerMessages: 0 } : held),
    )
    void client.invalidateQueries({
      predicate: ({ queryKey }) =>
        queryKey[0] === 'chatbot-requests' &&
        queryKey[1] === tenant &&
        typeof queryKey[2] === 'string' &&
        UNREAD_BEARING_LISTS.has(queryKey[2]),
    })
  }

  async function readThread(signal?: AbortSignal): Promise<ConversationThread> {
    const tenant = tenantId.value
    const request = requestId.value
    const threadKey = chatbotRequestKeys.conversation(tenant, request)
    const held = client.getQueryData<ConversationThread>(threadKey)
    const after = held ? pollCursor(held.items, live.value) : null

    let thread: ConversationThread
    if (after === null) {
      const latest = await chatbotConversationApi.getPage(request, { limit: CONVERSATION_PAGE_SIZE }, { signal })
      thread = latest
    } else {
      // Fold into the cache as it is *after* the awaits: «Cargar anteriores» may have landed meanwhile.
      let cursor = after
      let fresh = held!
      for (let i = 0; i < MAX_CATCH_UP_PAGES; i += 1) {
        const newer = await chatbotConversationApi.getPage(
          request,
          { after: cursor, limit: CONVERSATION_PAGE_SIZE },
          { signal },
        )
        fresh = appendNewer(client.getQueryData<ConversationThread>(threadKey) ?? fresh, newer)
        const next = lastSeq(newer.items)
        if (newer.items.length < CONVERSATION_PAGE_SIZE || next === null) break
        client.setQueryData(threadKey, fresh)
        cursor = next
      }
      thread = fresh
    }
    if (isReader.value) markOpened(tenant, request)
    return thread
  }

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => readThread(signal),
    enabled,
    retry: false,
    refetchInterval: (q) => {
      if (!q.state.data) return false
      const status = q.state.error ? readApiErrorEnvelope(q.state.error).status : null
      if (status === 403 || status === 404) return false
      return live.value ? CONVERSATION_LIVE_POLL_MS : CONVERSATION_POLL_MS
    },
  })

  const thread = computed<ConversationThread>(() =>
    enabled.value ? (query.data.value ?? emptyThread()) : emptyThread(),
  )

  // ─── «Cargar mensajes anteriores» ───────────────────────────────────────────
  const isLoadingOlder = ref(false)
  const olderError = ref<unknown>(null)

  async function loadOlder(): Promise<void> {
    if (!enabled.value || isLoadingOlder.value) return
    const held = thread.value
    const before = firstSeq(held.items)
    if (!held.hasMoreBefore || before === null) return

    const threadKey = key.value
    const request = requestId.value
    isLoadingOlder.value = true
    olderError.value = null
    try {
      const page = await chatbotConversationApi.getPage(request, {
        before,
        limit: CONVERSATION_PAGE_SIZE,
      })
      const current = client.getQueryData<ConversationThread>(threadKey) ?? held
      client.setQueryData(threadKey, prependOlder(current, page))
    } catch (error) {
      olderError.value = error
    } finally {
      isLoadingOlder.value = false
    }
  }

  return {
    messages: computed(() => thread.value.items),
    hasMoreBefore: computed(() => thread.value.hasMoreBefore),
    isEnabled: enabled,
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: query.isFetching,
    /** Nothing to show and the read failed; a failed poll with messages on screen is not an error. */
    isError: computed(() => enabled.value && query.isError.value && !query.data.value),
    error: query.error,
    isLoadingOlder,
    olderError: computed(() => olderError.value),
    loadOlder,
    refetch: () => query.refetch(),
  }
}
