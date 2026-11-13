import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { axiosError, withQuery } from './withQuery'
import { makeDetail } from '../../utils/detail-fixture'
import { makeMedia, makeMessage } from '../../utils/conversation-fixture'
import { chatbotRequestKeys } from '../../constants/queryKeys'
import type { ChatbotMessage, ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

vi.mock('../../api/chatbot-live.api', () => ({
  chatbotLiveApi: { sendMessage: vi.fn(), uploadMedia: vi.fn(), sendTemplate: vi.fn() },
}))
const ids = vi.hoisted(() => ({ n: 0 }))
vi.mock('@/features/POS/sales/utils/idempotency.utils', () => ({
  newIdempotencyKey: () => `key-${++ids.n}`,
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))

import { chatbotLiveApi } from '../../api/chatbot-live.api'
import { useLiveChat } from '../useLiveChat'

const api = vi.mocked(chatbotLiveApi)
const NOW = new Date('2026-11-13T16:06:00.000Z')

function liveDetail(overrides: Partial<ChatbotRequestDetail> = {}): ChatbotRequestDetail {
  return makeDetail({
    status: 'IN_PROGRESS',
    assignee: { id: 'u-1', displayName: 'Laura Méndez' },
    allowedActions: ['SEND_MESSAGE', 'FINISH'],
    liveSession: {
      state: 'ACTIVE',
      handoffEpoch: 3,
      lastStaffActivityAt: '2026-11-13T15:58:00.000Z',
      lastCustomerMessageAt: '2026-11-13T16:05:00.000Z',
    },
    ...overrides,
  })
}

const customer = (seq: number, at = '2026-11-13T16:05:00.000Z') =>
  makeMessage({ seq, direction: 'IN', author: 'CUSTOMER', providerTimestamp: at, createdAt: at })
const staffMessage = (seq: number, clientMessageId: string, extra: Partial<ChatbotMessage> = {}): ChatbotMessage =>
  makeMessage({
    seq,
    direction: 'OUT',
    author: 'STAFF',
    staff: { id: 'u-1', displayName: 'Laura Méndez' },
    text: 'Hola',
    deliveryStatus: 'QUEUED',
    clientMessageId,
    providerTimestamp: null,
    createdAt: NOW.toISOString(),
    ...extra,
  })

function setup(
  initial: { detail?: ChatbotRequestDetail; messages?: ChatbotMessage[]; now?: Date; client?: QueryClient } = {},
) {
  const detail = ref(initial.detail ?? liveDetail())
  const messages = ref<ChatbotMessage[]>(initial.messages ?? [customer(10)])
  const now = ref(initial.now ?? NOW)
  const client = initial.client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const { result } = withQuery(() => useLiveChat({ detail, messages, now }), client)
  return { chat: result, detail, messages, now, invalidate }
}

const seqs = (list: readonly ChatbotMessage[]) => list.map((m) => m.seq)

beforeEach(() => {
  ids.n = 0
  api.sendMessage.mockReset()
  api.uploadMedia.mockReset()
  api.sendTemplate.mockReset()
})

describe('useLiveChat — sending text', () => {
  it('POSTs the trimmed text with a uuid clientMessageId and the session epoch', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(11, 'key-1') })
    const { chat } = setup()
    chat.draft.value = '  Hola, soy Ana.  '

    await chat.send()

    expect(api.sendMessage).toHaveBeenCalledWith('req-1', {
      clientMessageId: 'key-1',
      expectedEpoch: 3,
      text: 'Hola, soy Ana.',
    })
  })

  it('shows the message at once (optimistic, En cola), clears the draft, then swaps in the server copy', async () => {
    let resolve!: (value: { message: ChatbotMessage }) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))
    const { chat } = setup()
    chat.draft.value = 'Hola'

    const sending = chat.send()
    await flushPromises()
    expect(chat.draft.value).toBe('')
    expect(chat.displayMessages.value).toHaveLength(2)
    const optimistic = chat.displayMessages.value[1]!
    expect(optimistic).toMatchObject({ text: 'Hola', deliveryStatus: 'QUEUED', clientMessageId: 'key-1', author: 'STAFF' })

    resolve({ message: staffMessage(11, 'key-1', { text: 'Hola' }) })
    await sending
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])
    expect(chat.displayMessages.value[1]!.id).toBe('msg-11')
  })

  it('reconciles with the polled thread by clientMessageId: one bubble, the thread copy wins', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(11, 'key-1') })
    const { chat, messages } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])

    messages.value = [customer(10), staffMessage(11, 'key-1', { deliveryStatus: 'DELIVERED' })]
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])
    expect(chat.displayMessages.value[1]!.deliveryStatus).toBe('DELIVERED')
  })

  it('keeps messages in seq order when a customer message lands before ours is polled', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(12, 'key-1') })
    const { chat, messages } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    messages.value = [customer(10), customer(11), customer(13)]
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11, 12, 13])
  })

  it('sends nothing for blank text, and nothing over 4,096 characters', async () => {
    const { chat } = setup()
    chat.draft.value = '   \n  '
    await chat.send()
    chat.draft.value = 'a'.repeat(4097)
    expect(chat.overLimit.value).toBe(true)
    expect(chat.canSend.value).toBe(false)
    await chat.send()
    expect(api.sendMessage).not.toHaveBeenCalled()
    chat.draft.value = 'a'.repeat(4096)
    expect(chat.canSend.value).toBe(true)
  })

  it('sends nothing without a live session epoch', async () => {
    const { chat } = setup({ detail: liveDetail({ liveSession: null }) })
    chat.draft.value = 'Hola'
    await chat.send()
    expect(api.sendMessage).not.toHaveBeenCalled()
  })
})

describe('useLiveChat — conflicts keep the draft', () => {
  it('409 WINDOW_CLOSED removes the optimistic bubble, restores the draft and blocks the composer', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const { chat } = setup()
    chat.draft.value = 'Te confirmo en unos minutos.'

    await chat.send()

    expect(seqs(chat.displayMessages.value)).toEqual([10])
    expect(chat.draft.value).toBe('Te confirmo en unos minutos.')
    expect(chat.windowClosed.value).toBe(true)
    expect(chat.templateAllowed.value).toBe(true)
    expect(chat.notice.value?.title).toBe('La ventana de 24 h está cerrada')
  })

  it('the window opens again when the customer writes something newer', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const { chat, messages } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    expect(chat.windowClosed.value).toBe(true)

    messages.value = [customer(10), customer(11)]
    expect(chat.windowClosed.value).toBe(false)
  })

  it.each([
    ['STALE_EPOCH', 409, { code: 'STALE_EPOCH', currentEpoch: 4 }],
    ['SESSION_NOT_ACTIVE', 409, { code: 'SESSION_NOT_ACTIVE', sessionState: 'ENDED' }],
  ])('%s refetches the detail and keeps the draft', async (_name, status, body) => {
    api.sendMessage.mockRejectedValue(axiosError(status, body))
    const { chat, invalidate } = setup()
    chat.draft.value = 'Escribía esto'

    await chat.send()

    expect(chat.draft.value).toBe('Escribía esto')
    expect(seqs(chat.displayMessages.value)).toEqual([10])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatbotRequestKeys.detail('tenant-1', 'req-1') })
    expect(chat.notice.value).not.toBeNull()
  })

  it('does not overwrite what the user typed meanwhile', async () => {
    let reject!: (e: unknown) => void
    api.sendMessage.mockReturnValue(new Promise((_, r) => (reject = r)))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    const sending = chat.send()
    await flushPromises()
    chat.draft.value = 'Ya escribí otra cosa'
    reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending
    expect(chat.draft.value).toBe('Ya escribí otra cosa')
  })
})

describe('useLiveChat — unknown outcome (network, 5xx)', () => {
  it('keeps the bubble as «No enviado»; Reintentar resends the SAME clientMessageId (idempotent)', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ message: staffMessage(11, 'key-1') })
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()

    const unsent = chat.displayMessages.value[1]!
    expect(unsent.deliveryStatus).toBe('FAILED')
    expect(chat.notice.value?.title).toBe('No se pudo confirmar el envío')

    await chat.retry(unsent)
    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(api.sendMessage.mock.calls[1]![1]).toMatchObject({ clientMessageId: 'key-1', text: 'Hola' })
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])
  })
})

describe('useLiveChat — retry creates a new message', () => {
  it('a FAILED message is sent again under a new clientMessageId and the old one is marked as resent', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(13, 'key-1') })
    const failed = staffMessage(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })
    const { chat } = setup({ messages: [customer(10), failed] })

    await chat.retry(failed)

    expect(api.sendMessage).toHaveBeenCalledWith('req-1', {
      clientMessageId: 'key-1',
      expectedEpoch: 3,
      text: 'Tu folio es S-000412.',
    })
    expect(chat.retried.value.has('msg-11')).toBe(true)
  })

  it('an UNKNOWN photo is resent as a new message with the same uploaded file', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(13, 'key-1', { type: 'IMAGE' }) })
    const unknown = staffMessage(11, 'old-id', {
      type: 'IMAGE',
      deliveryStatus: 'UNKNOWN',
      text: 'Así quedó',
      media: makeMedia({ id: 'media-7' }),
    })
    const { chat } = setup({ messages: [customer(10), unknown] })

    await chat.retry(unknown)

    expect(api.sendMessage).toHaveBeenCalledWith('req-1', {
      clientMessageId: 'key-1',
      expectedEpoch: 3,
      type: 'IMAGE',
      mediaId: 'media-7',
      caption: 'Así quedó',
    })
  })

  it('un-marks the old message when the resend is refused', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: false }))
    const failed = staffMessage(11, 'old-id', { deliveryStatus: 'FAILED' })
    const { chat } = setup({ messages: [customer(10), failed] })
    await chat.retry(failed)
    expect(chat.retried.value.has('msg-11')).toBe(false)
  })
})

describe('useLiveChat — attachments', () => {
  const file = (name: string, type: string, size = 1000) => {
    const f = new File(['x'], name, { type })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }

  it('refuses a video or a file over 10 MB before any upload', async () => {
    const { chat } = setup()
    await chat.pickFile(file('empaque-bolsa.mp4', 'video/mp4'))
    expect(chat.attachment.value).toMatchObject({
      status: 'error',
      error: 'No se puede enviar empaque-bolsa.mp4. Solo imágenes (JPG, PNG, WebP) y PDF.',
    })
    await chat.pickFile(file('foto-original.jpg', 'image/jpeg', 14.2 * 1024 * 1024))
    expect(chat.attachment.value?.error).toBe('foto-original.jpg pesa 14.2 MB. El máximo es 10 MB.')
    expect(api.uploadMedia).not.toHaveBeenCalled()
  })

  it('uploads with its own key, reports progress and becomes ready with the server filename', async () => {
    let finish!: (v: unknown) => void
    api.uploadMedia.mockImplementation((_id, _file, _key, options) => {
      options?.onProgress?.(60)
      return new Promise((r) => (finish = r)) as never
    })
    const { chat } = setup()
    const picked = chat.pickFile(file('foto.jpg', 'image/jpeg', 183_422))
    await flushPromises()

    expect(api.uploadMedia).toHaveBeenCalledWith('req-1', expect.any(File), 'key-1', expect.any(Object))
    expect(chat.attachment.value).toMatchObject({ status: 'uploading', progress: 60, name: 'foto.jpg', kind: 'IMAGE' })
    expect(chat.canSend.value).toBe(false)

    finish({ mediaId: 'media-1', mimeType: 'image/jpeg', sizeBytes: 183_422, sha256: 'x', filename: 'foto-limpia.jpg' })
    await picked
    expect(chat.attachment.value).toMatchObject({ status: 'ready', mediaId: 'media-1', name: 'foto-limpia.jpg' })
    expect(chat.canSend.value).toBe(true)
  })

  it('sends IMAGE | DOCUMENT with the mediaId and the draft as caption (≤ 1024)', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'media-9', mimeType: 'application/pdf', sizeBytes: 5, sha256: 'x', filename: 'politica.pdf' })
    api.sendMessage.mockResolvedValue({ message: staffMessage(11, 'key-2', { type: 'DOCUMENT' }) })
    const { chat } = setup()
    await chat.pickFile(file('politica.pdf', 'application/pdf'))
    chat.draft.value = 'Aquí está la política'

    await chat.send()

    expect(api.sendMessage).toHaveBeenCalledWith('req-1', {
      clientMessageId: 'key-2',
      expectedEpoch: 3,
      type: 'DOCUMENT',
      mediaId: 'media-9',
      caption: 'Aquí está la política',
    })
    expect(chat.attachment.value).toBeNull()
    expect(chat.draft.value).toBe('')
  })

  it('a caption over 1,024 characters cannot be sent', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'm', mimeType: 'image/png', sizeBytes: 5, sha256: 'x', filename: 'a.png' })
    const { chat } = setup()
    await chat.pickFile(file('a.png', 'image/png'))
    chat.draft.value = 'a'.repeat(1025)
    expect(chat.textLimit.value).toBe(1024)
    expect(chat.overLimit.value).toBe(true)
    expect(chat.canSend.value).toBe(false)
  })

  it('a photo with no caption can be sent (the caption is optional)', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'm', mimeType: 'image/png', sizeBytes: 5, sha256: 'x', filename: 'a.png' })
    api.sendMessage.mockResolvedValue({ message: staffMessage(11, 'key-2', { type: 'IMAGE' }) })
    const { chat } = setup()
    await chat.pickFile(file('a.png', 'image/png'))
    await chat.send()
    expect(api.sendMessage.mock.calls[0]![1]).toEqual({
      clientMessageId: 'key-2',
      expectedEpoch: 3,
      type: 'IMAGE',
      mediaId: 'm',
    })
  })

  it.each([
    [413, { code: 'MEDIA_TOO_LARGE' }, 'foto.jpg pesa más de 10 MB. El máximo es 10 MB.'],
    [415, { code: 'MEDIA_TYPE_NOT_ALLOWED' }, 'No se puede enviar foto.jpg. Solo imágenes (JPG, PNG, WebP) y PDF.'],
  ])('the server answering %s shows the same copy on the attachment', async (status, body, copy) => {
    api.uploadMedia.mockRejectedValue(axiosError(status, body))
    const { chat } = setup()
    await chat.pickFile(file('foto.jpg', 'image/jpeg'))
    expect(chat.attachment.value).toMatchObject({ status: 'error', error: copy })
    expect(chat.canSend.value).toBe(false)
  })

  it('MEDIA_NOT_FOUND on send puts the attachment back in error and keeps the caption', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'm', mimeType: 'image/png', sizeBytes: 5, sha256: 'x', filename: 'a.png' })
    api.sendMessage.mockRejectedValue(axiosError(404, { code: 'MEDIA_NOT_FOUND' }))
    const { chat } = setup()
    await chat.pickFile(file('a.png', 'image/png'))
    chat.draft.value = 'Pie de foto'
    await chat.send()
    expect(chat.draft.value).toBe('Pie de foto')
    expect(chat.attachment.value?.status).toBe('error')
    expect(chat.notice.value?.title).toBe('No encontramos el archivo')
  })

  it('removing the attachment forgets it', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'm', mimeType: 'image/png', sizeBytes: 5, sha256: 'x', filename: 'a.png' })
    const { chat } = setup()
    await chat.pickFile(file('a.png', 'image/png'))
    chat.clearAttachment()
    expect(chat.attachment.value).toBeNull()
  })
})

describe('useLiveChat — window closed and the template', () => {
  const OLD = '2026-11-12T10:00:00.000Z'
  /** A session whose customer last wrote yesterday: the 24 h window is closed. */
  const closedDetail = (allowedActions: ChatbotRequestDetail['allowedActions'] = ['SEND_MESSAGE']) =>
    liveDetail({
      allowedActions,
      liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: OLD },
    })

  it('derives «ventana cerrada» from the last customer message plus 24 h', () => {
    const { chat } = setup({
      messages: [customer(10, OLD)],
      detail: liveDetail({ liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: OLD } }),
    })
    expect(chat.windowClosed.value).toBe(true)
    expect(setup().chat.windowClosed.value).toBe(false)
  })

  it('offers the template only when SEND_TEMPLATE is allowed or the server said templateAllowed', async () => {
    const closed = { messages: [customer(10, OLD)] }
    const noTpl = setup({ ...closed, detail: closedDetail() })
    expect(noTpl.chat.windowClosed.value).toBe(true)
    expect(noTpl.chat.templateAvailable.value).toBe(false)

    const allowed = setup({ ...closed, detail: closedDetail(['SEND_MESSAGE', 'SEND_TEMPLATE']) })
    expect(allowed.chat.templateAvailable.value).toBe(true)

    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const viaServer = setup()
    viaServer.chat.draft.value = 'Hola'
    await viaServer.chat.send()
    expect(viaServer.chat.templateAvailable.value).toBe(true)

    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: false }))
    const denied = setup({ detail: liveDetail({ allowedActions: ['SEND_MESSAGE', 'SEND_TEMPLATE'] }) })
    denied.chat.draft.value = 'Hola'
    await denied.chat.send()
    expect(denied.chat.templateAvailable.value).toBe(false)
  })

  it('POSTs the template with exactly the epoch and shows it in the thread', async () => {
    api.sendTemplate.mockResolvedValue({
      message: staffMessage(11, 'key-1', { type: 'TEMPLATE', text: '', templateName: 'seguimiento_pedido' }),
    })
    const { chat, invalidate } = setup({ messages: [customer(10, OLD)], detail: closedDetail(['SEND_MESSAGE', 'SEND_TEMPLATE']) })

    const ok = await chat.sendTemplate()

    expect(ok).toBe(true)
    expect(api.sendTemplate).toHaveBeenCalledWith('req-1', { expectedEpoch: 3 }, 'key-1')
    expect(chat.displayMessages.value[chat.displayMessages.value.length - 1]).toMatchObject({ type: 'TEMPLATE', seq: 11 })
    expect(chat.templateState.value).toBe('pending')
    expect(chat.templateAvailable.value).toBe(false)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatbotRequestKeys.detail('tenant-1', 'req-1') })
  })

  it('a failed template can be retried under a new key; an unknown one cannot', () => {
    const tpl = (status: 'FAILED' | 'UNKNOWN') =>
      staffMessage(11, 'k', { type: 'TEMPLATE', text: '', deliveryStatus: status, templateName: 'x' })
    const failed = setup({ messages: [customer(10, OLD), tpl('FAILED')], detail: closedDetail(['SEND_MESSAGE', 'SEND_TEMPLATE']) })
    expect(failed.chat.templateState.value).toBe('failed')
    expect(failed.chat.templateAvailable.value).toBe(true)
    const unknown = setup({ messages: [customer(10, OLD), tpl('UNKNOWN')], detail: closedDetail(['SEND_MESSAGE', 'SEND_TEMPLATE']) })
    expect(unknown.chat.templateState.value).toBe('unknown')
    expect(unknown.chat.templateAvailable.value).toBe(false)
  })

  it('a template older than the customer’s newest message belongs to a previous window', () => {
    const tpl = staffMessage(9, 'k', { type: 'TEMPLATE', text: '', deliveryStatus: 'READ', templateName: 'x' })
    const { chat } = setup({ messages: [tpl, customer(10)] })
    expect(chat.templateState.value).toBe('ready')
  })

  it('reuses the key after a network error and takes a new one after an answer', async () => {
    api.sendTemplate.mockRejectedValueOnce(new Error('network')).mockRejectedValueOnce(axiosError(409, { code: 'TEMPLATE_ALREADY_SENT' }))
    const { chat } = setup({ messages: [customer(10, OLD)] })
    await chat.sendTemplate()
    await chat.sendTemplate()
    await chat.sendTemplate()
    expect(api.sendTemplate.mock.calls.map((c) => c[2])).toEqual(['key-1', 'key-1', 'key-2'])
  })

  it.each([
    ['WINDOW_OPEN', 409, 'La ventana sigue abierta'],
    ['TEMPLATE_NOT_CONFIGURED', 422, 'No hay plantilla configurada'],
    ['TEMPLATE_ALREADY_SENT', 409, 'La plantilla ya se envió'],
    ['STALE_EPOCH', 409, 'La conversación cambió'],
  ])('%s is explained and sends nothing else', async (code, status, title) => {
    api.sendTemplate.mockRejectedValue(axiosError(status, { code }))
    const { chat } = setup({ messages: [customer(10, OLD)] })
    const ok = await chat.sendTemplate()
    expect(ok).toBe(false)
    expect(chat.notice.value?.title).toBe(title)
  })

  it('TEMPLATE_NOT_CONFIGURED turns the state into «none»; WINDOW_OPEN reopens the composer', async () => {
    api.sendTemplate.mockRejectedValueOnce(axiosError(422, { code: 'TEMPLATE_NOT_CONFIGURED' }))
    const a = setup({ messages: [customer(10, OLD)] })
    await a.chat.sendTemplate()
    expect(a.chat.templateState.value).toBe('none')

    api.sendTemplate.mockRejectedValueOnce(axiosError(409, { code: 'WINDOW_OPEN' }))
    api.sendMessage.mockRejectedValueOnce(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const b = setup()
    b.chat.draft.value = 'Hola'
    await b.chat.send()
    expect(b.chat.windowClosed.value).toBe(true)
    await b.chat.sendTemplate()
    expect(b.chat.windowClosed.value).toBe(false)
  })
})

describe('useLiveChat — what the block shows about the window', () => {
  it('exposes when the window closes (24 h after the customer’s newest message)', () => {
    const { chat } = setup()
    expect(chat.windowClosesAt.value).toBe(Date.parse('2026-11-13T16:05:00.000Z') + 24 * 3_600_000)
  })

  it('says a message was deferred only while no newer customer message arrived', () => {
    const deferred = staffMessage(11, 'k', { deliveryStatus: 'DEFERRED' })
    const { chat, messages } = setup({ messages: [customer(10), deferred] })
    expect(chat.deferred.value).toBe(true)
    messages.value = [customer(10), deferred, customer(12)]
    expect(chat.deferred.value).toBe(false)
  })
})

describe('useLiveChat — T5L.F M1: «Reintentar» then a refusal restores the text', () => {
  it('network error, Reintentar, then STALE_EPOCH: the bubble goes, the text returns to the draft and the detail is refetched', async () => {
    api.sendMessage
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH', currentEpoch: 4 }))
    const { chat, invalidate } = setup()
    chat.draft.value = 'Te confirmo en unos minutos.'
    await chat.send()
    expect(chat.draft.value).toBe('')
    const unsent = chat.displayMessages.value[1]!

    await chat.retry(unsent)

    expect(seqs(chat.displayMessages.value)).toEqual([10])
    expect(chat.draft.value).toBe('Te confirmo en unos minutos.')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatbotRequestKeys.detail('tenant-1', 'req-1') })
    expect(chat.notice.value?.title).toBe('La conversación cambió')
  })

  it('does not overwrite what was typed since the first attempt', async () => {
    api.sendMessage
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(axiosError(403, { code: 'NOT_ASSIGNEE' }))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    await chat.send()
    chat.draft.value = 'Ya escribí otra cosa'

    await chat.retry(chat.displayMessages.value[1]!)

    expect(chat.draft.value).toBe('Ya escribí otra cosa')
    expect(seqs(chat.displayMessages.value)).toEqual([10])
  })

  it('restores the caption and the attachment of a photo, and marks it for upload again when the file is gone', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'media-9', mimeType: 'image/png', sizeBytes: 2048, sha256: 'x', filename: 'foto.png' })
    api.sendMessage
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    await chat.pickFile(new File(['x'], 'foto.png', { type: 'image/png' }))
    chat.draft.value = 'Así quedó'
    await chat.send()
    expect(chat.attachment.value).toBeNull()

    await chat.retry(chat.displayMessages.value[1]!)

    expect(chat.draft.value).toBe('Así quedó')
    expect(chat.attachment.value).toMatchObject({ name: 'foto.png', mediaId: 'media-9', kind: 'IMAGE', status: 'ready', size: 2048 })
  })

  it('does not replace an attachment picked since', async () => {
    api.uploadMedia
      .mockResolvedValueOnce({ mediaId: 'media-1', mimeType: 'image/png', sizeBytes: 5, sha256: 'x', filename: 'a.png' })
      .mockResolvedValueOnce({ mediaId: 'media-2', mimeType: 'image/png', sizeBytes: 5, sha256: 'x', filename: 'b.png' })
    api.sendMessage
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    await chat.pickFile(new File(['x'], 'a.png', { type: 'image/png' }))
    await chat.send()
    await chat.pickFile(new File(['x'], 'b.png', { type: 'image/png' }))

    await chat.retry(chat.displayMessages.value[1]!)

    expect(chat.attachment.value).toMatchObject({ mediaId: 'media-2' })
  })

  it('a refusal of the «Enviar como mensaje nuevo» resend does not touch the draft (the old message stays in the thread)', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'STALE_EPOCH' }))
    const failed = staffMessage(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })
    const { chat } = setup({ messages: [customer(10), failed] })
    await chat.retry(failed)
    expect(chat.draft.value).toBe('')
  })
})

describe('useLiveChat — T5L.F M2: an unknown answer is not «El cliente no lo recibió»', () => {
  it('marks the local bubble as unconfirmed (it keeps a FAILED status but says so)', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('network'))
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    expect(chat.displayMessages.value[1]).toMatchObject({ clientMessageId: 'key-1', unconfirmed: true })
  })

  it('a 5xx is unconfirmed too, and the server copy afterwards is not', async () => {
    api.sendMessage.mockRejectedValueOnce(axiosError(503)).mockResolvedValueOnce({ message: staffMessage(11, 'key-1') })
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    expect(chat.displayMessages.value[1]!.unconfirmed).toBe(true)
    await chat.retry(chat.displayMessages.value[1]!)
    expect(chat.displayMessages.value[1]!.unconfirmed).toBeFalsy()
  })
})

describe('useLiveChat — T5L.F: double Enter / double click send once', () => {
  it('two send() calls in the same tick POST once', async () => {
    let resolve!: (value: { message: ChatbotMessage }) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))
    const { chat } = setup()
    chat.draft.value = 'Hola'

    const first = chat.send()
    const second = chat.send()
    resolve({ message: staffMessage(11, 'key-1') })
    await Promise.all([first, second])

    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])
  })

  it('two «Reintentar» in a row after a network error POST once more, not twice', async () => {
    let resolve!: (value: { message: ChatbotMessage }) => void
    api.sendMessage.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    const unsent = chat.displayMessages.value[1]!

    const first = chat.retry(unsent)
    const second = chat.retry(unsent)
    resolve({ message: staffMessage(11, 'key-1') })
    await Promise.all([first, second])

    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    expect(api.sendMessage.mock.calls.map((c) => (c[1] as { clientMessageId: string }).clientMessageId)).toEqual(['key-1', 'key-1'])
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])
  })

  it('two «Enviar como mensaje nuevo» on a FAILED message POST once', async () => {
    let resolve!: (value: { message: ChatbotMessage }) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))
    const failed = staffMessage(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Hola' })
    const { chat } = setup({ messages: [customer(10), failed] })

    const first = chat.retry(failed)
    const second = chat.retry(failed)
    resolve({ message: staffMessage(13, 'key-1') })
    await Promise.all([first, second])

    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('a poll that lands before the POST answer leaves exactly one bubble', async () => {
    let resolve!: (value: { message: ChatbotMessage }) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))
    const { chat, messages } = setup()
    chat.draft.value = 'Hola'
    const sending = chat.send()
    await flushPromises()
    expect(seqs(chat.displayMessages.value)).toEqual([10, 0])

    messages.value = [customer(10), staffMessage(11, 'key-1', { deliveryStatus: 'SENT' })]
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])

    resolve({ message: staffMessage(11, 'key-1') })
    await sending
    expect(seqs(chat.displayMessages.value)).toEqual([10, 11])
    expect(chat.displayMessages.value[1]!.deliveryStatus).toBe('SENT')
  })
})

describe('useLiveChat — T5L.F: only an ACTIVE session sends', () => {
  it.each(['STARTING', 'ENDING', 'ENDED', 'WAITING'] as const)('%s: send() and sendTemplate() post nothing', async (state) => {
    const detail = liveDetail({
      liveSession: { state, handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: '2026-11-13T16:05:00.000Z' },
    })
    const { chat } = setup({ detail })
    chat.draft.value = 'Hola'
    expect(chat.canSend.value).toBe(false)
    await chat.send()
    expect(await chat.sendTemplate()).toBe(false)
    expect(api.sendMessage).not.toHaveBeenCalled()
    expect(api.sendTemplate).not.toHaveBeenCalled()
  })
})

describe('useLiveChat — T5L.F: a server WINDOW_OPEN beats the local clock', () => {
  const OLD = '2026-11-12T10:00:00.000Z'
  const skewed = () =>
    setup({
      messages: [customer(10, OLD)],
      detail: liveDetail({ liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: OLD } }),
    })

  const rowOnly = () =>
    setup({
      messages: [],
      detail: liveDetail({
        whatsappWindowClosesAt: '2026-11-13T10:00:00.000Z',
        liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: null },
      }),
    })

  it('after WINDOW_OPEN the composer opens even though the stale row value says closed', async () => {
    api.sendTemplate.mockRejectedValue(axiosError(409, { code: 'WINDOW_OPEN' }))
    const { chat } = rowOnly()
    expect(chat.windowClosed.value).toBe(true)

    await chat.sendTemplate()

    expect(chat.windowClosed.value).toBe(false)
    expect(chat.templateAvailable.value).toBe(false)
  })

  it('T13 D5: skewed clock — «Enviar plantilla» answered WINDOW_OPEN opens the composer even past 24 h from the newest customer message', async () => {
    api.sendTemplate.mockRejectedValue(axiosError(409, { code: 'WINDOW_OPEN' }))
    const { chat } = skewed()
    expect(chat.windowClosed.value).toBe(true)

    await chat.sendTemplate()

    expect(chat.windowClosed.value).toBe(false)
  })

  it('until the next customer message, which hands the decision back to the clock', async () => {
    api.sendTemplate.mockRejectedValue(axiosError(409, { code: 'WINDOW_OPEN' }))
    const { chat, messages } = rowOnly()
    await chat.sendTemplate()
    expect(chat.windowClosed.value).toBe(false)

    messages.value = [customer(11, OLD)]
    expect(chat.windowClosed.value).toBe(true)
  })

  it('a later WINDOW_CLOSED answer closes it again', async () => {
    api.sendTemplate.mockRejectedValue(axiosError(409, { code: 'WINDOW_OPEN' }))
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const { chat } = skewed()
    await chat.sendTemplate()
    chat.draft.value = 'Hola'
    // The composer is open by the server's word: sending is allowed and answered WINDOW_CLOSED.
    await chat.send()
    expect(chat.windowClosed.value).toBe(true)
  })
})

describe('useLiveChat — T13 D1: a refused text stays recoverable', () => {
  it('keeps the refused text when the attendee already typed something else (no silent merge)', async () => {
    let reject!: (e: unknown) => void
    api.sendMessage.mockReturnValue(new Promise((_, r) => (reject = r)))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    const sending = chat.send()
    await flushPromises()
    chat.draft.value = 'Ya escribí otra cosa'
    reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending

    expect(chat.draft.value).toBe('Ya escribí otra cosa')
    expect(chat.unsent.value).toHaveLength(1)
    expect(chat.unsent.value[0]).toMatchObject({ text: 'Primero', attachmentName: null })
  })

  it('«Usar este texto» appends it after a blank line and clears the note', async () => {
    api.sendMessage.mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    // The attendee types again before the refusal arrives: simulate by typing right after send().
    const sending = chat.send()
    chat.draft.value = 'Segundo'
    await sending

    chat.useUnsent(chat.unsent.value[0]!.id)

    expect(chat.draft.value).toBe('Segundo\n\nPrimero')
    expect(chat.unsent.value).toEqual([])
  })

  it('«Usar este texto» fills an empty box as it is, and the note can be discarded', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    chat.draft.value = 'Uno'
    const first = chat.send()
    chat.draft.value = 'Otro'
    await first
    chat.draft.value = ''
    chat.useUnsent(chat.unsent.value[0]!.id)
    expect(chat.draft.value).toBe('Uno')

    chat.draft.value = 'Dos'
    const second = chat.send()
    chat.draft.value = 'Tres'
    await second
    chat.discardUnsent(chat.unsent.value[0]!.id)
    expect(chat.unsent.value).toEqual([])
  })

  it('a refused retry of an unsent bubble with newer typing keeps the old text recoverable', async () => {
    api.sendMessage
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    await chat.send()
    chat.draft.value = 'Ya escribí otra cosa'

    await chat.retry(chat.displayMessages.value[1]!)

    expect(chat.draft.value).toBe('Ya escribí otra cosa')
    expect(chat.unsent.value[0]).toMatchObject({ text: 'Primero' })
  })

  it('a refused photo does not come back as the attachment of the newly typed text', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'media-9', mimeType: 'image/png', sizeBytes: 2048, sha256: 'x', filename: 'foto.png' })
    api.sendMessage.mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    await chat.pickFile(new File(['x'], 'foto.png', { type: 'image/png' }))
    chat.draft.value = 'Así quedó'
    const sending = chat.send()
    chat.draft.value = 'Texto nuevo'
    await sending

    expect(chat.attachment.value).toBeNull()
    expect(chat.draft.value).toBe('Texto nuevo')
    expect(chat.unsent.value[0]).toMatchObject({ text: 'Así quedó', attachmentName: 'foto.png' })

    // Recovering it is an explicit act: the photo and its caption come back together.
    chat.draft.value = ''
    chat.useUnsent(chat.unsent.value[0]!.id)
    expect(chat.attachment.value).toMatchObject({ mediaId: 'media-9', status: 'ready' })
    expect(chat.draft.value).toBe('Así quedó')
  })

  it('an empty box still restores the refused text directly (no note)', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    expect(chat.draft.value).toBe('Hola')
    expect(chat.unsent.value).toEqual([])
  })
})

describe('useLiveChat — T13: NOT_ASSIGNEE does not restore the text', () => {
  it('leaves the box empty, keeps no unsent note and refetches the detail', async () => {
    api.sendMessage.mockRejectedValue(axiosError(403, { code: 'NOT_ASSIGNEE' }))
    const { chat, invalidate } = setup()
    chat.draft.value = 'Escribía esto'

    await chat.send()

    expect(chat.draft.value).toBe('')
    expect(chat.unsent.value).toEqual([])
    expect(seqs(chat.displayMessages.value)).toEqual([10])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: chatbotRequestKeys.detail('tenant-1', 'req-1') })
    expect(chat.notice.value?.title).toBe('Ya no la atiendes tú')
  })

  it('a refused retry (unsent bubble) with newer typing leaves that typing alone and keeps no note', async () => {
    api.sendMessage
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(axiosError(403, { code: 'NOT_ASSIGNEE' }))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    await chat.send()
    chat.draft.value = 'Otra cosa'

    await chat.retry(chat.displayMessages.value[1]!)

    expect(chat.draft.value).toBe('Otra cosa')
    expect(chat.unsent.value).toEqual([])
  })
})

describe('useLiveChat — T13 D2: the server copy replaces the local unsent entry', () => {
  it.each(['FAILED', 'UNKNOWN'] as const)(
    'Reintentar on a server %s sends a NEW id at the first click',
    async (status) => {
      api.sendMessage
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ message: staffMessage(12, 'key-2') })
      const { chat, messages } = setup()
      chat.draft.value = 'Hola'
      await chat.send()
      expect(chat.displayMessages.value[1]).toMatchObject({ clientMessageId: 'key-1', unconfirmed: true })

      const server = staffMessage(11, 'key-1', { deliveryStatus: status })
      messages.value = [customer(10), server]
      await flushPromises()
      await chat.retry(chat.displayMessages.value[1]!)

      expect(api.sendMessage).toHaveBeenCalledTimes(2)
      expect(api.sendMessage.mock.calls[1]![1]).toMatchObject({ clientMessageId: 'key-2', text: 'Hola' })
    },
  )

  it('still resends the SAME id while the server copy has not arrived', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ message: staffMessage(11, 'key-1') })
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    await chat.retry(chat.displayMessages.value[1]!)
    expect(api.sendMessage.mock.calls[1]![1]).toMatchObject({ clientMessageId: 'key-1' })
  })
})

describe('useLiveChat — T13 D3: a stored bubble is not retried', () => {
  it('retry() on an entry in phase «stored» sends nothing', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(11, 'key-1', { deliveryStatus: 'FAILED' }) })
    const { chat } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    const stored = chat.displayMessages.value[1]!
    expect(stored.seq).toBe(11)

    await chat.retry(stored)

    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('useLiveChat — T13 D4: retry and dispatch need an ACTIVE session', () => {
  const ended = () =>
    liveDetail({ liveSession: { state: 'ENDED', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: null } })

  it('retry() of a server FAILED message sends nothing when the session is not ACTIVE', async () => {
    const failed = staffMessage(11, 'old-id', { deliveryStatus: 'FAILED' })
    const { chat } = setup({ detail: ended(), messages: [customer(10), failed] })
    await chat.retry(failed)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('retry() of an unsent bubble sends nothing once the session stopped being ACTIVE', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('network'))
    const { chat, detail } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    detail.value = ended()

    await chat.retry(chat.displayMessages.value[1]!)

    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('useLiveChat — T14: «Usar este texto» never drops a photo silently', () => {
  async function photoHold() {
    api.uploadMedia.mockResolvedValue({ mediaId: 'media-9', mimeType: 'image/png', sizeBytes: 2048, sha256: 'x', filename: 'foto.png' })
    api.sendMessage.mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const ctx = setup()
    await ctx.chat.pickFile(new File(['x'], 'foto.png', { type: 'image/png' }))
    ctx.chat.draft.value = 'Así quedó'
    const sending = ctx.chat.send()
    ctx.chat.draft.value = 'Texto nuevo'
    await sending
    return ctx
  }

  it('keeps the hold, the typing and the held attachment untouched, and says why', async () => {
    const { chat } = await photoHold()
    api.uploadMedia.mockResolvedValueOnce({ mediaId: 'media-2', mimeType: 'application/pdf', sizeBytes: 100, sha256: 'y', filename: 'lista.pdf' })
    await chat.pickFile(new File(['y'], 'lista.pdf', { type: 'application/pdf' }))
    const hold = chat.unsent.value[0]!

    chat.useUnsent(hold.id)

    expect(chat.unsent.value).toHaveLength(1)
    expect(chat.attachment.value).toMatchObject({ mediaId: 'media-2' })
    expect(chat.draft.value).toBe('Texto nuevo')
    expect(chat.notice.value?.title).toBe('Ya tienes un archivo adjunto')
    expect(chat.notice.value?.detail).toContain('foto.png')
  })

  it('once the attachment is removed the same hold comes back whole, photo and caption', async () => {
    const { chat } = await photoHold()
    api.uploadMedia.mockResolvedValueOnce({ mediaId: 'media-2', mimeType: 'application/pdf', sizeBytes: 100, sha256: 'y', filename: 'lista.pdf' })
    await chat.pickFile(new File(['y'], 'lista.pdf', { type: 'application/pdf' }))
    const hold = chat.unsent.value[0]!
    chat.useUnsent(hold.id)
    chat.clearAttachment()
    chat.dismissNotice()

    chat.useUnsent(hold.id)

    expect(chat.unsent.value).toHaveLength(0)
    expect(chat.attachment.value).toMatchObject({ mediaId: 'media-9', status: 'ready' })
    expect(chat.draft.value).toBe('Texto nuevo\n\nAsí quedó')
    expect(chat.notice.value).toBeNull()
  })

  it('a text hold is still usable while an attachment is held', async () => {
    api.uploadMedia.mockResolvedValue({ mediaId: 'media-2', mimeType: 'image/png', sizeBytes: 100, sha256: 'y', filename: 'otra.png' })
    api.sendMessage.mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat } = setup()
    chat.draft.value = 'Primero'
    const sending = chat.send()
    chat.draft.value = 'Segundo'
    await sending
    await chat.pickFile(new File(['y'], 'otra.png', { type: 'image/png' }))

    chat.useUnsent(chat.unsent.value[0]!.id)

    expect(chat.unsent.value).toHaveLength(0)
    expect(chat.draft.value).toBe('Segundo\n\nPrimero')
    expect(chat.attachment.value).toMatchObject({ mediaId: 'media-2' })
  })
})

describe('useLiveChat — T14: «resent» survives a remount of the block for the same request', () => {
  const failed = () => staffMessage(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })

  it('a second instance on the same client and request still has the message marked as resent', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(13, 'key-1') })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = setup({ messages: [customer(10), failed()], client })
    await first.chat.retry(failed())
    expect(first.chat.retried.value.has('msg-11')).toBe(true)

    const second = setup({ messages: [customer(10), failed()], client })
    expect(second.chat.retried.value.has('msg-11')).toBe(true)

    api.sendMessage.mockClear()
    await second.chat.retry(failed())
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('is not shared with another request nor another tenant', async () => {
    api.sendMessage.mockResolvedValue({ message: staffMessage(13, 'key-1') })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = setup({ messages: [customer(10), failed()], client })
    await first.chat.retry(failed())

    const other = setup({ messages: [customer(10), failed()], detail: liveDetail({ id: 'req-2' }), client })
    expect(other.chat.retried.value.has('msg-11')).toBe(false)
  })

  it('a refused resend un-marks it for every instance', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'STALE_EPOCH' }))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = setup({ messages: [customer(10), failed()], client })
    await first.chat.retry(failed())
    const second = setup({ messages: [customer(10), failed()], client })
    expect(second.chat.retried.value.has('msg-11')).toBe(false)
  })
})

describe('useLiveChat — T14: the block is reused when the detail view switches request', () => {
  const OLD = '2026-11-12T10:00:00.000Z'

  it('a WINDOW_OPEN override of the previous request does not carry over', async () => {
    api.sendTemplate.mockRejectedValue(axiosError(409, { code: 'WINDOW_OPEN' }))
    const detail = liveDetail({
      liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: OLD },
    })
    const { chat, detail: current, messages } = setup({ detail, messages: [customer(10, OLD)] })
    await chat.sendTemplate()
    expect(chat.windowClosed.value).toBe(false)

    messages.value = [customer(10, OLD)]
    current.value = { ...detail, id: 'req-2' }

    expect(chat.windowClosed.value).toBe(true)
  })

  it('a WINDOW_CLOSED override of the previous request does not carry over', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const { chat, detail: current } = setup()
    chat.draft.value = 'Hola'
    await chat.send()
    expect(chat.windowClosed.value).toBe(true)

    current.value = { ...current.value, id: 'req-2' }

    expect(chat.windowClosed.value).toBe(false)
    expect(chat.templateAllowed.value).toBeNull()
  })

  it('the draft, the attachment, the notice, the outbox and the held texts do not move to the other request', async () => {
    api.sendMessage.mockRejectedValueOnce(axiosError(409, { code: 'STALE_EPOCH' }))
    const { chat, detail: current } = setup()
    chat.draft.value = 'Primero'
    const sending = chat.send()
    chat.draft.value = 'Segundo'
    await sending
    expect(chat.unsent.value).toHaveLength(1)
    expect(chat.notice.value).not.toBeNull()

    current.value = { ...current.value, id: 'req-2' }

    expect(chat.draft.value).toBe('')
    expect(chat.unsent.value).toHaveLength(0)
    expect(chat.notice.value).toBeNull()
    expect(chat.attachment.value).toBeNull()
  })
})
