import { ref, type Ref } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import type { ChatbotMessage } from '../interfaces/chatbot-request.types'
import type { LiveError, LiveNotice } from '../utils/live-errors'

export type SendInput =
  | { kind: 'text'; text: string }
  | { kind: 'media'; type: 'IMAGE' | 'DOCUMENT'; mediaId: string; caption: string; name: string; size: number }

/**
 * A message the attendee sent (or is sending) that the polled thread may not hold yet.
 * `sending` / `unsent` have no `seq` (shown last); `stored` has the server's copy.
 */
export interface OutboxEntry {
  clientMessageId: string
  input: SendInput
  phase: 'sending' | 'stored' | 'unsent'
  message: ChatbotMessage
}

/**
 * A refused message the composer could not take back without overwriting what the attendee typed
 * meanwhile (or without handing a photo to new text as its caption): it waits as a note until the
 * attendee decides («Usar este texto»).
 */
export interface UnsentText {
  id: string
  text: string
  /** Name of the attachment that went with it, or `null` for a plain text. */
  attachmentName: string | null
}

export interface UnsentHold extends UnsentText {
  input: SendInput
  error: LiveError
  shown: LiveNotice
}

/** Everything the attendee's side of ONE request keeps while it is waiting on the server. */
export interface LiveOutbox {
  entries: Ref<OutboxEntry[]>
  holds: Ref<UnsentHold[]>
  templateSending: Ref<boolean>
  /** Idempotency key of a template whose answer is unknown; it only travels again for the same request. */
  templateKey: string | null
}

/**
 * The outbox per tenant + request. It lives next to the QueryClient (like liveRetried), not in the
 * conversation block, for two reasons: (1) the detail view reuses the block across
 * /chatbot/solicitudes/:id, and an answer that arrives after the view moved to another request must
 * land in ITS request's outbox and never in the one on screen; (2) a remount of the block for the
 * same request keeps the unconfirmed messages and the held texts, so nothing the attendee wrote
 * drops out of the UI.
 */
const outboxes = new WeakMap<QueryClient, Map<string, LiveOutbox>>()

export function outboxFor(client: QueryClient, tenantId: string, requestId: string): LiveOutbox {
  let byKey = outboxes.get(client)
  if (!byKey) {
    byKey = new Map()
    outboxes.set(client, byKey)
  }
  const key = `${tenantId}\u0000${requestId}`
  let outbox = byKey.get(key)
  if (!outbox) {
    outbox = { entries: ref([]), holds: ref([]), templateSending: ref(false), templateKey: null }
    byKey.set(key, outbox)
  }
  return outbox
}
