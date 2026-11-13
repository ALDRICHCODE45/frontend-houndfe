import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { QueryClient } from '@tanstack/vue-query'
import { axiosError, withQuery } from './withQuery'
import { makeDetail } from '../../utils/detail-fixture'
import { makeMessage } from '../../utils/conversation-fixture'
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
    id: 'req-A',
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const OLD = '2026-11-12T10:00:00.000Z'

function setup(
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  { windowClosed = false }: { windowClosed?: boolean } = {},
) {
  const detail = ref(
    windowClosed
      ? liveDetail({
          liveSession: { state: 'ACTIVE', handoffEpoch: 3, lastStaffActivityAt: null, lastCustomerMessageAt: OLD },
        })
      : liveDetail(),
  )
  const messages = ref<ChatbotMessage[]>([windowClosed ? customer(10, OLD) : customer(10)])
  const now = ref(NOW)
  const refreshThread = vi.fn()
  const { result } = withQuery(() => useLiveChat({ detail, messages, now, refreshThread }), client)
  const goTo = (id: string) => {
    detail.value = { ...detail.value, id }
  }
  return { chat: result, goTo, messages, refreshThread, client }
}

const seqs = (list: readonly ChatbotMessage[]) => list.map((m) => m.seq)

beforeEach(() => {
  ids.n = 0
  api.sendMessage.mockReset()
  api.uploadMedia.mockReset()
  api.sendTemplate.mockReset()
})

describe('useLiveChat — T15: a send of request A that answers after the view moved to request B', () => {
  it('a refusal (4xx) never restores A’s text into B’s draft, hold or notice; A keeps it as its own hold', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    pending.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending

    expect(chat.draft.value).toBe('')
    expect(chat.unsent.value).toEqual([])
    expect(chat.notice.value).toBeNull()
    expect(chat.displayMessages.value.some((m) => m.text === 'Texto de A')).toBe(false)

    goTo('req-A')
    expect(chat.unsent.value.map((u) => u.text)).toEqual(['Texto de A'])
    expect(chat.draft.value).toBe('')
  })

  it('a network error / 5xx never adds an unsent bubble to B’s outbox (and «Reintentar» in B has nothing of A)', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    pending.reject(new Error('network'))
    await sending

    expect(chat.displayMessages.value.map((m) => m.text)).not.toContain('Texto de A')
    expect(chat.notice.value).toBeNull()
    expect(chat.isSending.value).toBe(false)

    // A still has its unconfirmed bubble for «Reintentar» (same id) when the attendee comes back.
    goTo('req-A')
    const bubble = chat.displayMessages.value.find((m) => m.text === 'Texto de A')
    expect(bubble).toMatchObject({ clientMessageId: 'key-1', unconfirmed: true })
  })

  it('a success never puts A’s bubble in B’s thread and does not poll B', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo, refreshThread } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    pending.resolve({ message: staffMessage(11, 'key-1', { text: 'Texto de A' }) })
    await sending

    expect(seqs(chat.displayMessages.value)).toEqual([10])
    expect(refreshThread).not.toHaveBeenCalled()
  })

  it.each([
    ['WINDOW_CLOSED', { code: 'WINDOW_CLOSED', templateAllowed: true }],
    ['WINDOW_OPEN', { code: 'WINDOW_OPEN' }],
  ])('%s of A does not set B’s window overrides, template permission or notice', async (_name, body) => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()
    const closedBefore = chat.windowClosed.value

    goTo('req-B')
    pending.reject(axiosError(409, body))
    await sending

    expect(chat.windowClosed.value).toBe(closedBefore)
    expect(chat.templateAllowed.value).toBeNull()
    expect(chat.notice.value).toBeNull()
    expect(chat.draft.value).toBe('')
  })

  it('B can send at once, and A’s late answer does not touch B’s pending bubble or its draft', async () => {
    const a = deferred<{ message: ChatbotMessage }>()
    const b = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sendingA = chat.send()
    await flushPromises()

    goTo('req-B')
    chat.draft.value = 'Texto de B'
    const sendingB = chat.send()
    await flushPromises()
    expect(api.sendMessage.mock.calls[1]![0]).toBe('req-B')

    a.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sendingA
    expect(chat.displayMessages.value.map((m) => m.text)).toEqual(['Hola, ¿tienen croquetas?', 'Texto de B'])
    expect(chat.isSending.value).toBe(true)
    expect(chat.notice.value).toBeNull()
    expect(chat.unsent.value).toEqual([])

    b.resolve({ message: staffMessage(12, 'key-2', { text: 'Texto de B' }) })
    await sendingB
    expect(seqs(chat.displayMessages.value)).toEqual([10, 12])
  })

  it('«Reintentar» of A that is refused after the switch does not restore the text into B', async () => {
    const first = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(first.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    await chat.send()
    const unsent = chat.displayMessages.value.find((m) => m.text === 'Texto de A')!

    const retrying = chat.retry(unsent)
    await flushPromises()
    goTo('req-B')
    first.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await retrying

    expect(chat.draft.value).toBe('')
    expect(chat.unsent.value).toEqual([])
    expect(chat.notice.value).toBeNull()
    expect(chat.displayMessages.value.some((m) => m.text === 'Texto de A')).toBe(false)
  })
})

describe('useLiveChat — T15: a template of request A that answers after the view moved to request B', () => {
  it('B’s template state is its own: A’s late refusal does not mark B as «sin plantilla» nor leave a notice', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendTemplate.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    const sending = chat.sendTemplate()
    await flushPromises()

    goTo('req-B')
    pending.reject(axiosError(409, { code: 'TEMPLATE_NOT_CONFIGURED' }))
    await sending

    expect(chat.templateState.value).toBe('ready')
    expect(chat.notice.value).toBeNull()
  })

  it('A’s late WINDOW_OPEN answer does not open B’s closed window', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendTemplate.mockReturnValue(pending.promise)
    const { chat, goTo } = setup(undefined, { windowClosed: true })
    const sending = chat.sendTemplate()
    await flushPromises()

    goTo('req-B')
    expect(chat.windowClosed.value).toBe(true)
    pending.reject(axiosError(409, { code: 'WINDOW_OPEN' }))
    await sending

    expect(chat.windowClosed.value).toBe(true)
    expect(chat.templateAllowed.value).toBeNull()
  })

  it('A’s late success does not put the template in B’s thread', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendTemplate.mockReturnValue(pending.promise)
    const { chat, goTo, refreshThread } = setup()
    const sending = chat.sendTemplate()
    await flushPromises()

    goTo('req-B')
    pending.resolve({
      message: staffMessage(11, 'tpl-1', { type: 'TEMPLATE', text: 'Plantilla de A', deliveryStatus: 'SENT' }),
    })
    await sending

    expect(seqs(chat.displayMessages.value)).toEqual([10])
    expect(chat.templateState.value).toBe('ready')
    expect(refreshThread).not.toHaveBeenCalled()
  })

  it('B can send its own template at once and A’s answer does not end B’s «sending»', async () => {
    const a = deferred<{ message: ChatbotMessage }>()
    const b = deferred<{ message: ChatbotMessage }>()
    api.sendTemplate.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const { chat, goTo } = setup()
    const sendingA = chat.sendTemplate()
    await flushPromises()
    expect(chat.templateSending.value).toBe(true)

    goTo('req-B')
    expect(chat.templateSending.value).toBe(false)
    const sendingB = chat.sendTemplate()
    await flushPromises()
    expect(api.sendTemplate).toHaveBeenCalledTimes(2)
    expect(api.sendTemplate.mock.calls[1]![0]).toBe('req-B')
    expect(chat.templateSending.value).toBe(true)

    a.reject(axiosError(409, { code: 'TEMPLATE_ALREADY_SENT' }))
    await sendingA
    expect(chat.templateSending.value).toBe(true)
    expect(chat.templateAllowed.value).toBeNull()

    b.resolve({ message: staffMessage(11, 'tpl-b', { type: 'TEMPLATE', deliveryStatus: 'SENT' }) })
    await sendingB
    expect(chat.templateSending.value).toBe(false)
  })

  it('A’s unknown-answer key is not reused for B’s template', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendTemplate.mockReturnValueOnce(pending.promise).mockResolvedValueOnce({
      message: staffMessage(11, 'tpl-b', { type: 'TEMPLATE', deliveryStatus: 'SENT' }),
    })
    const { chat, goTo } = setup()
    const sendingA = chat.sendTemplate()
    await flushPromises()
    goTo('req-B')
    pending.reject(new Error('network'))
    await sendingA

    await chat.sendTemplate()
    const keyA = api.sendTemplate.mock.calls[0]![2]
    const keyB = api.sendTemplate.mock.calls[1]![2]
    expect(keyB).not.toBe(keyA)
  })
})

describe('useLiveChat — T15: an upload of request A that answers after the view moved to request B', () => {
  const file = () => new File(['x'], 'foto.png', { type: 'image/png' })

  it('A’s upload result (or failure) does not land in B’s attachment', async () => {
    const pending = deferred<{ mediaId: string; filename: string; sizeBytes: number }>()
    api.uploadMedia.mockReturnValue(pending.promise as never)
    const { chat, goTo } = setup()
    const picking = chat.pickFile(file())
    await flushPromises()

    goTo('req-B')
    pending.resolve({ mediaId: 'media-A', filename: 'foto.png', sizeBytes: 1 })
    await picking

    expect(chat.attachment.value).toBeNull()
  })

  it('B’s own upload is not overwritten by A’s late answer', async () => {
    const a = deferred<{ mediaId: string; filename: string; sizeBytes: number }>()
    const b = deferred<{ mediaId: string; filename: string; sizeBytes: number }>()
    api.uploadMedia.mockReturnValueOnce(a.promise as never).mockReturnValueOnce(b.promise as never)
    const { chat, goTo } = setup()
    const pickingA = chat.pickFile(file())
    await flushPromises()
    goTo('req-B')
    const pickingB = chat.pickFile(new File(['y'], 'otra.png', { type: 'image/png' }))
    await flushPromises()
    expect(api.uploadMedia.mock.calls[1]![0]).toBe('req-B')

    a.resolve({ mediaId: 'media-A', filename: 'foto.png', sizeBytes: 1 })
    await pickingA
    expect(chat.attachment.value).toMatchObject({ name: 'otra.png', status: 'uploading', mediaId: null })

    b.resolve({ mediaId: 'media-B', filename: 'otra.png', sizeBytes: 1 })
    await pickingB
    expect(chat.attachment.value).toMatchObject({ status: 'ready', mediaId: 'media-B' })
  })
})

describe('useLiveChat — T16 D2: A → B → A, the answer of A applies once A is back on screen', () => {
  it('a refusal restores A’s text into the empty box and shows the notice', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    goTo('req-A')
    pending.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending

    expect(chat.draft.value).toBe('Texto de A')
    expect(chat.unsent.value).toEqual([])
    expect(chat.notice.value).not.toBeNull()
  })

  it('WINDOW_CLOSED of A is learned when A is back (the composer window closes)', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    goTo('req-A')
    pending.reject(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    await sending

    expect(chat.windowClosed.value).toBe(true)
    expect(chat.templateAllowed.value).toBe(true)
    expect(chat.draft.value).toBe('Texto de A')
  })

  it('a success polls the thread again once A is back', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo, refreshThread } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    goTo('req-A')
    pending.resolve({ message: staffMessage(11, 'key-1', { text: 'Texto de A' }) })
    await sending

    expect(refreshThread).toHaveBeenCalledTimes(1)
  })

  it('a template refusal of A applies to A’s screen once A is back', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendTemplate.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    const sending = chat.sendTemplate()
    await flushPromises()

    goTo('req-B')
    goTo('req-A')
    pending.reject(axiosError(409, { code: 'TEMPLATE_NOT_CONFIGURED' }))
    await sending

    expect(chat.templateState.value).toBe('none')
    expect(chat.notice.value).not.toBeNull()
  })

  it('while B is on screen the same answer still goes nowhere (A → B protection stays)', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, goTo } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    goTo('req-B')
    pending.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending
    expect(chat.draft.value).toBe('')
    expect(chat.notice.value).toBeNull()

    goTo('req-A')
    expect(chat.unsent.value.map((u) => u.text)).toEqual(['Texto de A'])
  })
})

describe('useLiveChat — T15 D2: an unconfirmed message survives a remount of the block', () => {
  it('after a network error on «Enviar como mensaje nuevo» and a remount, the text is still recoverable', async () => {
    const failed = staffMessage(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })
    api.sendMessage.mockRejectedValue(new Error('network'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const first = setup(client)
    first.messages.value = [customer(10), failed]
    await first.chat.retry(failed)
    expect(first.chat.displayMessages.value.some((m) => m.text === 'Tu folio es S-000412.' && m.unconfirmed)).toBe(true)

    const second = setup(client)
    second.messages.value = [customer(10), failed]
    const again = second.chat.displayMessages.value.filter((m) => m.unconfirmed)
    expect(again.map((m) => m.text)).toEqual(['Tu folio es S-000412.'])

    // …and «Reintentar» from the remounted block resends the SAME id.
    api.sendMessage.mockResolvedValue({ message: staffMessage(12, 'key-1', { text: 'Tu folio es S-000412.' }) })
    await second.chat.retry(again[0]!)
    expect(api.sendMessage.mock.calls[1]![1]).toMatchObject({ clientMessageId: 'key-1' })
  })
})
