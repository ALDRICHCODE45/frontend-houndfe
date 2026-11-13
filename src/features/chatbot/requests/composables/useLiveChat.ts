import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
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

type SendInput =
  | { kind: 'text'; text: string }
  | { kind: 'media'; type: 'IMAGE' | 'DOCUMENT'; mediaId: string; caption: string; name: string; size: number }

/**
 * A message the attendee sent (or is sending) that the polled thread may not hold yet.
 * `sending` / `unsent` have no `seq` (shown last); `stored` has the server's copy.
 */
interface OutboxEntry {
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

interface UnsentHold extends UnsentText {
  input: SendInput
  error: LiveError
  shown: LiveNotice
}

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

  const detail = computed(() => toValue(options.detail))
  const threadMessages = computed(() => toValue(options.messages))
  const now = computed(() => toValue(options.now))
  const requestId = computed(() => detail.value?.id ?? toValue(options.requestId) ?? '')
  const epoch = computed(() => detail.value?.liveSession?.handoffEpoch ?? null)

  const draft = ref('')
  const attachment = ref<LiveAttachment | null>(null)
  const notice = ref<LiveNotice | null>(null)
  const entries = ref<OutboxEntry[]>([])
  const retried = ref<ReadonlySet<string>>(new Set())
  const holds = ref<UnsentHold[]>([])
  const unsent = computed<UnsentText[]>(() =>
    holds.value.map(({ id, text, attachmentName }) => ({ id, text, attachmentName })),
  )

  /** Highest customer `seq` known when the server said `WINDOW_CLOSED`. */
  const forcedClosedAfterSeq = ref<number | null>(null)
  /** Highest customer `seq` known when the server said `WINDOW_OPEN`: beats the local clock until the customer writes. */
  const forcedOpenAfterSeq = ref<number | null>(null)
  const templateAllowed = ref<boolean | null>(null)
  const templateNotConfigured = ref(false)
  const templateSending = ref(false)

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
      if (entries.value.some((e) => serverHas(e.clientMessageId))) {
        entries.value = entries.value.filter((e) => !serverHas(e.clientMessageId))
      }
    },
    { flush: 'sync' },
  )

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
  function refetchDetail(): void {
    void client.invalidateQueries({ queryKey: chatbotRequestKeys.detail(tenantId.value, requestId.value) })
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

  function upsert(entry: OutboxEntry): void {
    const rest = entries.value.filter((e) => e.clientMessageId !== entry.clientMessageId)
    entries.value = [...rest, entry]
  }
  function drop(clientMessageId: string): void {
    entries.value = entries.value.filter((e) => e.clientMessageId !== clientMessageId)
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
    const message = optimisticMessage(clientMessageId, input)
    upsert({ clientMessageId, input, phase: 'sending', message })
    try {
      const response = await chatbotLiveApi.sendMessage(requestId.value, bodyOf(clientMessageId, input, expectedEpoch))
      upsert({ clientMessageId, input, phase: 'stored', message: response.message })
      options.refreshThread?.()
      return { ok: true, error: null, notice: null }
    } catch (caught) {
      const error = readLiveError(caught)
      const shown = liveErrorNotice(error, { fileName: input.kind === 'media' ? input.name : undefined })
      notice.value = shown
      if (error.retryable) {
        // The answer is unknown (it may have arrived): keep the bubble so «Reintentar» resends the same id.
        upsert({
          clientMessageId,
          input,
          phase: 'unsent',
          message: { ...message, deliveryStatus: 'FAILED', unconfirmed: true },
        })
      } else {
        drop(clientMessageId)
        applyRefusal(error)
        if (shown.refetch) refetchDetail()
        // NOT_ASSIGNEE: the person can no longer send, so the text does not come back to the box.
        if (restore && error.code !== 'NOT_ASSIGNEE') restoreInput(input, error, shown)
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
      else holds.value = [...holds.value, holdOf(input, error, shown)]
      return
    }
    if (boxEmpty && !attachment.value) {
      draft.value = input.caption
      attachment.value = attachmentOf(input, error, shown)
      return
    }
    holds.value = [...holds.value, holdOf(input, error, shown)]
  }

  /** «Usar este texto»: puts a held message back; text goes after what is typed, after a blank line. */
  function useUnsent(id: string): void {
    const hold = holds.value.find((h) => h.id === id)
    if (!hold) return
    holds.value = holds.value.filter((h) => h.id !== id)
    if (hold.text.length > 0) {
      draft.value = draft.value.trim().length === 0 ? hold.text : `${draft.value}\n\n${hold.text}`
    }
    if (hold.input.kind === 'media' && !attachment.value) {
      attachment.value = attachmentOf(hold.input, hold.error, hold.shown)
    }
  }

  function discardUnsent(id: string): void {
    holds.value = holds.value.filter((h) => h.id !== id)
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
    retried.value = new Set(retried.value).add(message.id)
    const result = await dispatch(newIdempotencyKey(), input)
    if (!result.ok && !result.error?.retryable) {
      const next = new Set(retried.value)
      next.delete(message.id)
      retried.value = next
    }
  }

  // ─── Attachments ─────────────────────────────────────────────────────────────
  let uploadToken = 0

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
      const uploaded = await chatbotLiveApi.uploadMedia(requestId.value, file, newIdempotencyKey(), {
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
  let templateKey: string | null = null

  async function sendTemplate(): Promise<boolean> {
    const expectedEpoch = epoch.value
    if (!sessionActive.value || expectedEpoch === null || templateSending.value) return false
    templateKey ??= newIdempotencyKey()
    templateSending.value = true
    notice.value = null
    try {
      const response = await chatbotLiveApi.sendTemplate(requestId.value, { expectedEpoch }, templateKey)
      templateKey = null
      upsert({
        clientMessageId: response.message.clientMessageId ?? `template-${response.message.id}`,
        input: { kind: 'text', text: '' },
        phase: 'stored',
        message: response.message,
      })
      options.refreshThread?.()
      refetchDetail()
      return true
    } catch (caught) {
      const error = readLiveError(caught)
      // The same key only travels again while the answer is unknown.
      if (!error.retryable) templateKey = null
      if (error.code === 'TEMPLATE_NOT_CONFIGURED') templateNotConfigured.value = true
      if (error.code === 'TEMPLATE_ALREADY_SENT') templateAllowed.value = false
      applyRefusal(error)
      const shown = liveErrorNotice(error)
      notice.value = shown
      if (shown.refetch) {
        refetchDetail()
        options.refreshThread?.()
      }
      return false
    } finally {
      templateSending.value = false
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
