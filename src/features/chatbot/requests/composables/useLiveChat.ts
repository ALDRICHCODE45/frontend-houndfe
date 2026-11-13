import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { newIdempotencyKey } from '@/features/POS/sales/utils/idempotency.utils'
import { chatbotLiveApi } from '../api/chatbot-live.api'
import { chatbotRequestKeys } from '../constants/queryKeys'
import type {
  ChatbotMessage,
  ChatbotRequestDetail,
  SendMessageBody,
} from '../interfaces/chatbot-request.types'
import {
  CAPTION_MAX,
  TEXT_MAX,
  attachmentErrorFor,
  validateAttachment,
  type AttachmentKind,
} from '../utils/live-attachments'
import { liveErrorNotice, readLiveError, type LiveError, type LiveNotice } from '../utils/live-errors'
import { outboxFor, type LiveOutbox, type OutboxEntry, type SendInput, type UnsentHold, type UnsentText } from './liveOutbox'
import { retriedStoreFor } from './liveRetried'
import { pruneLiveStores, signedInUserId } from './liveStoreScope'
import { isWindowClosed, lastCustomerSeq, windowClosesAt as closesAtOf, type WindowInput } from '../utils/live-window'

/** The attendee's attachment while it is picked, uploaded and waiting for «Enviar». */
export interface LiveAttachment {
  name: string
  /** Bytes. */
  size: number
  kind: AttachmentKind | null
  status: 'uploading' | 'ready' | 'error'
  /** 0–100 while uploading. */
  progress: number
  mediaId: string | null
  error: string | null
}

export type TemplateState = 'ready' | 'pending' | 'failed' | 'unknown' | 'none'

export type { UnsentText }

export interface UseLiveChatOptions {
  /** `null` while there is no live session to talk about (the chat then sends nothing). */
  detail: MaybeRefOrGetter<ChatbotRequestDetail | null>
  /** Used when `detail` is `null`. */
  requestId?: MaybeRefOrGetter<string>
  /** The thread as read from the server (already in `seq` order). */
  messages: MaybeRefOrGetter<readonly ChatbotMessage[]>
  /** A ticking clock (shared with the delivery labels). */
  now: MaybeRefOrGetter<Date>
  /** Asks the thread to poll now, so a stored message is replaced by the server's copy soon. */
  refreshThread?: () => void
}

/**
 * The attendee's side of a live chat (handoff 20 §3): text and attachments, optimistic bubbles
 * reconciled by `clientMessageId` / `seq`, the 24 h window and the paid template.
 *
 * Idempotency: a message's `Idempotency-Key` is its `clientMessageId`. A network error or `5xx`
 * leaves the answer unknown, so «Reintentar» resends the SAME id (the server answers the stored
 * message). A `FAILED` / `UNKNOWN` delivery that the server reported is a different case: sending
 * it again is a NEW message (new id) and the old one is marked as resent. Every refusal (`4xx`)
 * keeps the draft and the attachment in the composer.
 */
export function useLiveChat(options: UseLiveChatOptions) {
  const client = useQueryClient()
  const tenantId = useSafeTenantId()
  // Everything the chat keeps is the signed-in user's: another user never reads it (liveStoreScope).
  const userId = computed(() => signedInUserId())

  const detail = computed(() => toValue(options.detail))
  const threadMessages = computed(() => toValue(options.messages))
  const now = computed(() => toValue(options.now))
  const requestId = computed(() => detail.value?.id ?? toValue(options.requestId) ?? '')
  const epoch = computed(() => detail.value?.liveSession?.handoffEpoch ?? null)

  let uploadToken = 0
  /** Who, where and about which request the block is talking right now. */
  const scopeKey = computed(() => `${userId.value}\u0000${tenantId.value}\u0000${requestId.value}`)

  const draft = ref('')
  const attachment = ref<LiveAttachment | null>(null)
  const notice = ref<LiveNotice | null>(null)
  // What waits on the server belongs to the request, not to the block (see liveOutbox).
  const outbox = computed(() => outboxFor(client, userId.value, tenantId.value, requestId.value))
  const entries = computed(() => outbox.value.entries.value)
  // Per tenant + request and outside the block: a remount for the same request keeps it (see liveRetried).
  const retriedStore = computed(() => retriedStoreFor(client, userId.value, tenantId.value, requestId.value))
  const retried = computed(() => retriedStore.value.value)
  const holds = computed(() => outbox.value.holds.value)
  const unsent = computed<UnsentText[]>(() =>
    holds.value.map(({ id, text, attachmentName }) => ({ id, text, attachmentName })),
  )

  /** Highest customer `seq` known when the server said `WINDOW_CLOSED`. */
  const forcedClosedAfterSeq = ref<number | null>(null)
  /** Highest customer `seq` known when the server said `WINDOW_OPEN`: beats the local clock until the customer writes. */
  const forcedOpenAfterSeq = ref<number | null>(null)
  const templateAllowed = ref<boolean | null>(null)
  const templateNotConfigured = ref(false)
  const templateSending = computed(() => outbox.value.templateSending.value)

  // ─── Display: thread + outbox ────────────────────────────────────────────────
  const displayMessages = computed<ChatbotMessage[]>(() => {
    const thread = threadMessages.value
    const clientIds = new Set(thread.map((m) => m.clientMessageId).filter((id): id is string => !!id))
    const seqs = new Set(thread.map((m) => m.seq))
    const pending = entries.value.filter((e) => !clientIds.has(e.clientMessageId))
    const stored = pending.filter((e) => e.phase === 'stored' && !seqs.has(e.message.seq)).map((e) => e.message)
    const local = pending.filter((e) => e.phase !== 'stored').map((e) => e.message)
    const merged = [...thread, ...stored].sort((a, b) => a.seq - b.seq)
    return [...merged, ...local]
  })

  const isSending = computed(() => entries.value.some((e) => e.phase === 'sending'))

  function serverHas(clientMessageId: string | null | undefined): boolean {
    return !!clientMessageId && threadMessages.value.some((m) => m.clientMessageId === clientMessageId)
  }

  // The server's copy of a clientMessageId is the truth: the local entry (unsent, stored, sending)
  // has nothing left to say, and must not make «Reintentar» resend the old id.
  watch(
    threadMessages,
    () => {
      const store = outbox.value
      if (store.entries.value.some((e) => serverHas(e.clientMessageId))) {
        store.entries.value = store.entries.value.filter((e) => !serverHas(e.clientMessageId))
      }
    },
    { flush: 'sync' },
  )

  // The detail view reuses this block across /chatbot/solicitudes/:id: what belongs to one request (its
  // typing, attachment, notice, window and template answers) must not reach the next. Its outbox and held
  // texts are keyed by user and request (liveOutbox), so they simply are not the ones on screen any more; an
  // answer that is still in flight finds another scope on screen and writes nothing here. If the attendee
  // comes back to the same request, that same answer is current again and applies normally.
  watch(
    scopeKey,
    (next, previous) => {
      if (next === previous) return
      uploadToken += 1
      draft.value = ''
      attachment.value = null
      notice.value = null
      forcedClosedAfterSeq.value = null
      forcedOpenAfterSeq.value = null
      templateAllowed.value = null
      templateNotConfigured.value = false
      // The request left behind may hold nothing any more: do not keep an empty entry around.
      pruneLiveStores(client, userId.value)
    },
    { flush: 'sync' },
  )
  onScopeDispose(() => pruneLiveStores(client, userId.value))

  interface Scope {
    key: string
    tenantId: string
    requestId: string
    outbox: LiveOutbox
  }
  /** What an operation started in: its user + tenant + request and the outbox of that request. */
  function captureScope(): Scope {
    return { key: scopeKey.value, tenantId: tenantId.value, requestId: requestId.value, outbox: outbox.value }
  }
  /**
   * The operation's scope is no longer the one on screen. Comparing the scope (not a counter) means
   * A → B → A leaves A's late answer current; a different user or a dropped store is always stale.
   */
  function isStale(scope: Scope): boolean {
    return scope.key !== scopeKey.value || scope.outbox !== outbox.value
  }

  // ─── Window and template ─────────────────────────────────────────────────────
  const windowInput = computed<WindowInput>(() => ({
    messages: displayMessages.value,
    lastCustomerMessageAt: detail.value?.liveSession?.lastCustomerMessageAt ?? null,
    rowClosesAt: detail.value?.whatsappWindowClosesAt ?? null,
    forcedClosedAfterSeq: forcedClosedAfterSeq.value,
    forcedOpenAfterSeq: forcedOpenAfterSeq.value,
  }))
  const windowClosed = computed(() => isWindowClosed(windowInput.value, now.value))
  /** Epoch ms when the window closes, from the newest customer message; `null` when nothing says. */
  const windowClosesAt = computed(() => closesAtOf(windowInput.value))
  /** A staff message ended `DEFERRED` and the customer has not written since (handoff 20 §5b). */
  const deferred = computed(() => {
    const customerSeq = lastCustomerSeq(displayMessages.value) ?? 0
    return displayMessages.value.some(
      (m) => m.author === 'STAFF' && m.deliveryStatus === 'DEFERRED' && m.seq > customerSeq,
    )
  })

  // A newer customer message reopens the window: forget what the last refusal said.
  watch(windowClosed, (closed) => {
    if (closed) return
    forcedClosedAfterSeq.value = null
    templateAllowed.value = null
  })

  const templateState = computed<TemplateState>(() => {
    const customerSeq = lastCustomerSeq(displayMessages.value) ?? 0
    const live = displayMessages.value.filter((m) => m.type === 'TEMPLATE' && m.author === 'STAFF' && m.seq > customerSeq)
    const last = live[live.length - 1]
    if (last) {
      if (last.deliveryStatus === 'FAILED') return 'failed'
      if (last.deliveryStatus === 'UNKNOWN') return 'unknown'
      return 'pending'
    }
    return templateNotConfigured.value ? 'none' : 'ready'
  })

  /** «Enviar plantilla» can be pressed: the server said so (`templateAllowed`) or `allowedActions` lists it. */
  const templateAvailable = computed(() => {
    if (!windowClosed.value) return false
    const permitted = templateAllowed.value ?? (detail.value?.allowedActions.includes('SEND_TEMPLATE') ?? false)
    return permitted && (templateState.value === 'ready' || templateState.value === 'failed')
  })

  // ─── Limits ──────────────────────────────────────────────────────────────────
  const textLimit = computed(() => (attachment.value ? CAPTION_MAX : TEXT_MAX))
  const overLimit = computed(() => draft.value.length > textLimit.value)
  /** Only an `ACTIVE` session takes messages (`SESSION_NOT_ACTIVE` otherwise, handoff 20 §3). */
  const sessionActive = computed(() => epoch.value !== null && detail.value?.liveSession?.state === 'ACTIVE')
  const canSend = computed(() => {
    if (!sessionActive.value || overLimit.value) return false
    if (attachment.value) return attachment.value.status === 'ready'
    return draft.value.trim().length > 0
  })

  // ─── Plumbing ────────────────────────────────────────────────────────────────
  function refetchDetail(scope: Scope = captureScope()): void {
    void client.invalidateQueries({ queryKey: chatbotRequestKeys.detail(scope.tenantId, scope.requestId) })
  }

  function optimisticMessage(clientMessageId: string, input: SendInput): ChatbotMessage {
    const base: ChatbotMessage = {
      id: `local-${clientMessageId}`,
      seq: 0,
      direction: 'OUT',
      author: 'STAFF',
      staff: detail.value?.assignee ?? null,
      type: 'TEXT',
      text: '',
      media: null,
      deliveryStatus: 'QUEUED',
      clientMessageId,
      providerTimestamp: null,
      createdAt: now.value.toISOString(),
    }
    if (input.kind === 'text') return { ...base, text: input.text }
    return {
      ...base,
      type: input.type,
      text: input.caption,
      media: {
        id: input.mediaId,
        mimeType: null,
        sizeBytes: null,
        durationSec: null,
        hasThumb: false,
        purged: false,
        filename: input.name,
      },
    }
  }

  function upsert(store: LiveOutbox, entry: OutboxEntry): void {
    const rest = store.entries.value.filter((e) => e.clientMessageId !== entry.clientMessageId)
    store.entries.value = [...rest, entry]
  }
  function drop(store: LiveOutbox, clientMessageId: string): void {
    store.entries.value = store.entries.value.filter((e) => e.clientMessageId !== clientMessageId)
  }

  function bodyOf(clientMessageId: string, input: SendInput, expectedEpoch: number): SendMessageBody {
    if (input.kind === 'text') return { clientMessageId, expectedEpoch, text: input.text }
    return {
      clientMessageId,
      expectedEpoch,
      type: input.type,
      mediaId: input.mediaId,
      ...(input.caption ? { caption: input.caption } : {}),
    }
  }

  /** Reaction to a refusal that does not depend on what was being sent. */
  function applyRefusal(error: LiveError): void {
    if (error.code === 'WINDOW_CLOSED') {
      forcedClosedAfterSeq.value = lastCustomerSeq(displayMessages.value) ?? 0
      forcedOpenAfterSeq.value = null
      templateAllowed.value = error.templateAllowed
    }
    if (error.code === 'WINDOW_OPEN') {
      forcedClosedAfterSeq.value = null
      forcedOpenAfterSeq.value = lastCustomerSeq(displayMessages.value) ?? 0
      templateAllowed.value = null
    }
  }

  interface DispatchResult {
    ok: boolean
    error: LiveError | null
    /** What the composer shows for a refusal. */
    notice: LiveNotice | null
  }

  /**
   * `restore`: the attendee's own composer content (not a resend of a message the server already
   * holds). A refusal then puts the text, and the attachment if any, back in the composer.
   */
  async function dispatch(
    clientMessageId: string,
    input: SendInput,
    { restore }: { restore: boolean } = { restore: false },
  ): Promise<DispatchResult> {
    const expectedEpoch = epoch.value
    if (!sessionActive.value || expectedEpoch === null) return { ok: false, error: null, notice: null }
    const scope = captureScope()
    const store = scope.outbox
    const message = optimisticMessage(clientMessageId, input)
    upsert(store, { clientMessageId, input, phase: 'sending', message })
    try {
      const response = await chatbotLiveApi.sendMessage(scope.requestId, bodyOf(clientMessageId, input, expectedEpoch))
      upsert(store, { clientMessageId, input, phase: 'stored', message: response.message })
      if (!isStale(scope)) options.refreshThread?.()
      return { ok: true, error: null, notice: null }
    } catch (caught) {
      const error = readLiveError(caught)
      const shown = liveErrorNotice(error, { fileName: input.kind === 'media' ? input.name : undefined })
      // The view moved to another request while this was in flight: what it answered belongs to the
      // request that sent it. Nothing below writes into the state on screen; only that request's own
      // outbox (and its query cache) hears about it.
      const stale = isStale(scope)
      if (!stale) notice.value = shown
      if (error.retryable) {
        // The answer is unknown (it may have arrived): keep the bubble so «Reintentar» resends the same id.
        upsert(store, {
          clientMessageId,
          input,
          phase: 'unsent',
          message: { ...message, deliveryStatus: 'FAILED', unconfirmed: true },
        })
      } else {
        drop(store, clientMessageId)
        if (!stale) applyRefusal(error)
        if (shown.refetch) refetchDetail(scope)
        // NOT_ASSIGNEE: the person can no longer send, so the text does not come back to the box.
        if (restore && error.code !== 'NOT_ASSIGNEE') {
          if (stale) store.holds.value = [...store.holds.value, holdOf(input, error, shown)]
          else restoreInput(input, error, shown)
        }
      }
      return { ok: false, error, notice: shown }
    }
  }

  function holdOf(input: SendInput, error: LiveError, shown: LiveNotice): UnsentHold {
    return {
      id: `unsent-${newIdempotencyKey()}`,
      text: input.kind === 'text' ? input.text : input.caption,
      attachmentName: input.kind === 'media' ? input.name : null,
      input,
      error,
      shown,
    }
  }

  function attachmentOf(input: Extract<SendInput, { kind: 'media' }>, error: LiveError, shown: LiveNotice): LiveAttachment {
    const mediaGone = ['MEDIA_NOT_FOUND', 'MEDIA_PURGED', 'MEDIA_TYPE_MISMATCH'].includes(error.code ?? '')
    return {
      name: input.name,
      size: input.size,
      kind: input.type,
      status: mediaGone ? 'error' : 'ready',
      progress: 100,
      mediaId: input.mediaId,
      error: mediaGone ? (shown.detail ?? 'Súbelo de nuevo.') : null,
    }
  }

  /**
   * Puts a refused message back in the composer. It goes straight back only when that overwrites
   * nothing and hands nothing to new text: an empty box (and, for a photo, no attachment held). Any
   * other case waits as an «unsent» note, never merged silently.
   */
  function restoreInput(input: SendInput, error: LiveError, shown: LiveNotice): void {
    const boxEmpty = draft.value.trim().length === 0
    if (input.kind === 'text') {
      if (boxEmpty) draft.value = input.text
      else addHold(holdOf(input, error, shown))
      return
    }
    if (boxEmpty && !attachment.value) {
      draft.value = input.caption
      attachment.value = attachmentOf(input, error, shown)
      return
    }
    addHold(holdOf(input, error, shown))
  }

  function addHold(hold: UnsentHold): void {
    outbox.value.holds.value = [...outbox.value.holds.value, hold]
  }

  /**
   * «Usar este texto»: puts a held message back; text goes after what is typed, after a blank line. A held
   * photo needs the attachment slot: while another attachment is held the whole hold stays (nothing is
   * dropped, nothing is merged) and a notice says to remove the current one first.
   */
  function useUnsent(id: string): void {
    const hold = holds.value.find((h) => h.id === id)
    if (!hold) return
    if (hold.input.kind === 'media' && attachment.value) {
      notice.value = {
        tone: 'info',
        title: 'Ya tienes un archivo adjunto',
        detail: `Quita «${attachment.value.name}» para recuperar «${hold.input.name}»: el mensaje no se pierde mientras tanto.`,
        refetch: false,
      }
      return
    }
    outbox.value.holds.value = holds.value.filter((h) => h.id !== id)
    if (hold.text.length > 0) {
      draft.value = draft.value.trim().length === 0 ? hold.text : `${draft.value}\n\n${hold.text}`
    }
    if (hold.input.kind === 'media') {
      attachment.value = attachmentOf(hold.input, hold.error, hold.shown)
    }
  }

  function discardUnsent(id: string): void {
    outbox.value.holds.value = holds.value.filter((h) => h.id !== id)
  }

  // ─── Sending the composer ────────────────────────────────────────────────────
  async function send(): Promise<void> {
    if (!canSend.value) return
    const held = attachment.value
    const text = draft.value
    const clientMessageId = newIdempotencyKey()
    const input: SendInput =
      held && held.mediaId && held.kind
        ? {
            kind: 'media',
            type: held.kind,
            mediaId: held.mediaId,
            caption: text.trim(),
            name: held.name,
            size: held.size,
          }
        : { kind: 'text', text: text.trim() }

    notice.value = null
    draft.value = ''
    attachment.value = null
    await dispatch(clientMessageId, input, { restore: true })
  }

  /** «Reintentar» / «Enviar como mensaje nuevo» on a delivery that did not work out. */
  async function retry(message: ChatbotMessage): Promise<void> {
    if (!sessionActive.value) return
    // The server's copy supersedes a local entry of the same id: a resend is then a NEW message.
    const held = serverHas(message.clientMessageId)
      ? undefined
      : entries.value.find((e) => e.clientMessageId === message.clientMessageId)
    // A second click / Enter while the first resend is in flight must not send anything else; a
    // stored bubble is the server's already (no new-id send from a stale bubble).
    if (held?.phase === 'sending' || held?.phase === 'stored' || retried.value.has(message.id)) return
    notice.value = null
    if (held?.phase === 'unsent') {
      await dispatch(held.clientMessageId, held.input, { restore: true })
      return
    }
    const input: SendInput | null =
      message.type === 'TEXT'
        ? { kind: 'text', text: (message.text ?? '').trim() }
        : (message.type === 'IMAGE' || message.type === 'DOCUMENT') && message.media
          ? {
              kind: 'media',
              type: message.type,
              mediaId: message.media.id,
              caption: (message.text ?? '').trim(),
              name: message.media.filename ?? '',
              size: message.media.sizeBytes ?? 0,
            }
          : null
    if (!input || (input.kind === 'text' && input.text.length === 0)) return
    const store = retriedStore.value
    store.value = new Set(store.value).add(message.id)
    const result = await dispatch(newIdempotencyKey(), input)
    if (!result.ok && !result.error?.retryable) {
      const next = new Set(store.value)
      next.delete(message.id)
      store.value = next
    }
  }

  // ─── Attachments ─────────────────────────────────────────────────────────────
  async function pickFile(file: File): Promise<void> {
    const token = ++uploadToken
    const check = validateAttachment(file)
    if (!check.ok) {
      attachment.value = {
        name: file.name,
        size: file.size,
        kind: null,
        status: 'error',
        progress: 0,
        mediaId: null,
        error: check.message,
      }
      return
    }
    const uploadRequestId = requestId.value
    attachment.value = {
      name: file.name,
      size: file.size,
      kind: check.kind,
      status: 'uploading',
      progress: 0,
      mediaId: null,
      error: null,
    }
    try {
      const uploaded = await chatbotLiveApi.uploadMedia(uploadRequestId, file, newIdempotencyKey(), {
        onProgress: (percent) => {
          if (token === uploadToken && attachment.value) attachment.value = { ...attachment.value, progress: percent }
        },
      })
      if (token !== uploadToken || !attachment.value) return
      attachment.value = {
        ...attachment.value,
        name: uploaded.filename || attachment.value.name,
        size: uploaded.sizeBytes,
        status: 'ready',
        progress: 100,
        mediaId: uploaded.mediaId,
      }
    } catch (caught) {
      if (token !== uploadToken || !attachment.value) return
      const error = readLiveError(caught)
      attachment.value = {
        ...attachment.value,
        status: 'error',
        error:
          attachmentErrorFor(error.status, file.name) ??
          liveErrorNotice(error, { fileName: file.name }).detail,
      }
    }
  }

  function clearAttachment(): void {
    uploadToken += 1
    attachment.value = null
  }

  // ─── Template ────────────────────────────────────────────────────────────────
  async function sendTemplate(): Promise<boolean> {
    const expectedEpoch = epoch.value
    if (!sessionActive.value || expectedEpoch === null || templateSending.value) return false
    // The sending flag and the key belong to the request (its outbox): an answer for another request
    // never ends this one's «sending» nor reuses its key.
    const scope = captureScope()
    const store = scope.outbox
    store.templateKey ??= newIdempotencyKey()
    const key = store.templateKey
    store.templateSending.value = true
    notice.value = null
    try {
      const response = await chatbotLiveApi.sendTemplate(scope.requestId, { expectedEpoch }, key)
      store.templateKey = null
      upsert(store, {
        clientMessageId: response.message.clientMessageId ?? `template-${response.message.id}`,
        input: { kind: 'text', text: '' },
        phase: 'stored',
        message: response.message,
      })
      if (!isStale(scope)) options.refreshThread?.()
      refetchDetail(scope)
      return true
    } catch (caught) {
      const error = readLiveError(caught)
      // The same key only travels again while the answer is unknown.
      if (!error.retryable) store.templateKey = null
      const shown = liveErrorNotice(error)
      if (shown.refetch) refetchDetail(scope)
      // Everything below is the screen's state (window, template answers, notice): only for the
      // request that is still on screen.
      if (!isStale(scope)) {
        if (error.code === 'TEMPLATE_NOT_CONFIGURED') templateNotConfigured.value = true
        if (error.code === 'TEMPLATE_ALREADY_SENT') templateAllowed.value = false
        applyRefusal(error)
        notice.value = shown
        if (shown.refetch) options.refreshThread?.()
      }
      return false
    } finally {
      store.templateSending.value = false
    }
  }

  return {
    draft,
    attachment,
    notice,
    displayMessages,
    retried,
    unsent,
    useUnsent,
    discardUnsent,
    isSending,
    textLimit,
    overLimit,
    canSend,
    windowClosed,
    windowClosesAt,
    deferred,
    templateAllowed,
    templateState,
    templateAvailable,
    templateSending,
    send,
    retry,
    pickFile,
    clearAttachment,
    sendTemplate,
    dismissNotice: () => {
      notice.value = null
    },
  }
}
