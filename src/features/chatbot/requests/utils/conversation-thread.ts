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
