/**
 * The loaded thread of one request: latest page, older pages and polled newer messages, merged by
 * `seq` (the backend order; never `providerTimestamp` / `createdAt`). The incoming copy of a `seq`
 * replaces the held one, because a message is the state at delivery time (status moves forward);
 * a staff status never goes backwards on the QUEUED < SENT < DELIVERED < READ ladder.
 */
import type { ChatbotConversationPage, ChatbotMessage } from '../interfaces/chatbot-request.types'

export type ConversationThread = ChatbotConversationPage

export function emptyThread(): ConversationThread {
  return { items: [], hasMoreBefore: false }
}

/**
 * The forward ladder of a staff message (handoff 20 §3). `DEFERRED`, `UNKNOWN` and `FAILED` are not
 * on it: the server reports them as they happen (SENT → DEFERRED, DEFERRED → SENT again on a
 * resend, a late DELIVERED after UNKNOWN), so they are always taken and can be left again.
 */
const STATUS_RANK: Readonly<Record<string, number>> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3 }

/** A page read before a status moved must not undo it (a slow `after` page landing late). */
function settle(held: ChatbotMessage | undefined, next: ChatbotMessage): ChatbotMessage {
  if (!held || held.author !== 'STAFF' || next.author !== 'STAFF') return next
  const from = held.deliveryStatus ? STATUS_RANK[held.deliveryStatus] : undefined
  const to = next.deliveryStatus ? STATUS_RANK[next.deliveryStatus] : undefined
  if (from === undefined || to === undefined || to >= from) return next
  return { ...next, deliveryStatus: held.deliveryStatus }
}

export function mergeMessages(
  existing: readonly ChatbotMessage[],
  incoming: readonly ChatbotMessage[],
): ChatbotMessage[] {
  const bySeq = new Map<number, ChatbotMessage>()
  for (const message of existing) bySeq.set(message.seq, message)
  for (const message of incoming) bySeq.set(message.seq, settle(bySeq.get(message.seq), message))
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

/** An older page: whether more exist before it is the page's answer. */
export function prependOlder(thread: ConversationThread, page: ChatbotConversationPage): ConversationThread {
  return { items: mergeMessages(thread.items, page.items), hasMoreBefore: page.hasMoreBefore }
}

/** A newer page says nothing about what is older than the thread, so that flag stays. */
export function appendNewer(thread: ConversationThread, page: ChatbotConversationPage): ConversationThread {
  return { items: mergeMessages(thread.items, page.items), hasMoreBefore: thread.hasMoreBefore }
}

export function firstSeq(items: readonly ChatbotMessage[]): number | null {
  return items.length > 0 ? items[0]!.seq : null
}

export function lastSeq(items: readonly ChatbotMessage[]): number | null {
  return items.length > 0 ? items[items.length - 1]!.seq : null
}

/** What a realtime event does to the cached thread: a new thread, «re-read it from the server», or nothing. */
export type ThreadPatch = ConversationThread | 'refetch' | null

/** The shape the thread needs of a message that came over the stream (it is not parsed by the API layer). */
export function isThreadMessage(value: unknown): value is ChatbotMessage {
  if (!value || typeof value !== 'object') return false
  const m = value as Record<string, unknown>
  return (
    typeof m.id === 'string' &&
    typeof m.seq === 'number' &&
    Number.isInteger(m.seq) &&
    m.seq > 0 &&
    typeof m.author === 'string' &&
    typeof m.direction === 'string' &&
    typeof m.type === 'string'
  )
}

/**
 * `conversation.message` (handoff 18 §4): a message is the state at delivery time, replaced by `seq`.
 * A seq with a hole before it is NOT inserted (the poll cursor is the highest seq held, so the hole
 * would never be read): the thread is re-read instead. Older than the loaded window is left to
 * «Cargar anteriores» (its cursor is the lowest seq held).
 */
export function applyRealtimeMessage(thread: ConversationThread, message: ChatbotMessage): ThreadPatch {
  const first = firstSeq(thread.items)
  const last = lastSeq(thread.items)
  if (first === null || last === null) return message.seq === 1 ? { ...thread, items: [message] } : 'refetch'
  if (message.seq > last + 1) return 'refetch'
  if (message.seq < first) return null
  return { ...thread, items: mergeMessages(thread.items, [message]) }
}

/**
 * `message.status`: moves the held copy of a staff message along the status ladder (never back; the
 * off-ladder states are taken as they come). A seq the thread has not read yet means a message was
 * missed: re-read. One older than the loaded window is ignored.
 */
export function applyRealtimeStatus(
  thread: ConversationThread,
  status: { seq: number; messageId: string; deliveryStatus: string },
): ThreadPatch {
  const held = thread.items.find((m) => m.seq === status.seq)
  if (!held) {
    const last = lastSeq(thread.items)
    return last === null || status.seq > last ? 'refetch' : null
  }
  if (held.id !== status.messageId) return 'refetch'
  if (held.author !== 'STAFF') return null
  const next = { ...held, deliveryStatus: status.deliveryStatus as ChatbotMessage['deliveryStatus'] }
  return { ...thread, items: mergeMessages(thread.items, [next]) }
}
