/**
 * The 24 h WhatsApp window of a live chat (handoff 20 §3, §5b, §6).
 *
 * The `whatsappWindowClosesAt` of the row is the value the bot sent when it created the request: it
 * does not move with the conversation (known limit), so the best local knowledge is the newest
 * customer message (thread or `liveSession.lastCustomerMessageAt`) plus 24 h. The server is still
 * the truth: a `409 WINDOW_CLOSED` closes the composer (`forcedClosedAfterSeq`) until the customer
 * writes again, and a staff message that ended `DEFERRED` means the same.
 */
import type { ChatbotMessage } from '../interfaces/chatbot-request.types'

export const WINDOW_MS = 24 * 60 * 60_000

export interface WindowInput {
  messages: readonly ChatbotMessage[]
  lastCustomerMessageAt: string | null
  /** The row's `whatsappWindowClosesAt` (possibly stale). */
  rowClosesAt: string | null
  /** Highest customer `seq` known when the server said `WINDOW_CLOSED`; `null` when it never did. */
  forcedClosedAfterSeq: number | null
}

function instant(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function customerMessages(messages: readonly ChatbotMessage[]): ChatbotMessage[] {
  return messages.filter((message) => message.direction === 'IN')
}

/** Highest `seq` of a customer message in the list, or `null`. */
export function lastCustomerSeq(messages: readonly ChatbotMessage[]): number | null {
  const seqs = customerMessages(messages).map((message) => message.seq)
  return seqs.length > 0 ? Math.max(...seqs) : null
}

function lastCustomerInstant(input: WindowInput): number | null {
  const times = customerMessages(input.messages)
    .map((message) => instant(message.providerTimestamp ?? message.createdAt))
    .filter((ms): ms is number => ms !== null)
  const fromSession = instant(input.lastCustomerMessageAt)
  if (fromSession !== null) times.push(fromSession)
  return times.length > 0 ? Math.max(...times) : null
}

/** Epoch ms when the window closes, or `null` when nothing says. */
export function windowClosesAt(input: WindowInput): number | null {
  const last = lastCustomerInstant(input)
  return last !== null ? last + WINDOW_MS : instant(input.rowClosesAt)
}

export function isWindowClosed(input: WindowInput, now: Date): boolean {
  const customerSeq = lastCustomerSeq(input.messages) ?? 0
  if (input.forcedClosedAfterSeq !== null && customerSeq <= input.forcedClosedAfterSeq) return true
  const deferred = input.messages.some(
    (message) => message.author === 'STAFF' && message.deliveryStatus === 'DEFERRED' && message.seq > customerSeq,
  )
  if (deferred) return true
  const closes = windowClosesAt(input)
  return closes !== null && now.getTime() >= closes
}

/** «45 min», «3 h», «3 h 40 min». */
export function formatRemaining(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}
