import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
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
// The signed-in user is reactive here, like the Pinia store's `user`.
const auth = await vi.hoisted(async () => {
  const { reactive } = await import('vue')
  return reactive({ user: { id: 'u-1' } as { id: string } | null })
})
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', user: auth.user, userCan: () => true }),
}))

import { chatbotLiveApi } from '../../api/chatbot-live.api'
import { outboxFor } from '../liveOutbox'
import { retriedStoreFor } from '../liveRetried'
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

const customer = (seq: number) =>
  makeMessage({
    seq,
    direction: 'IN',
    author: 'CUSTOMER',
    providerTimestamp: '2026-11-13T16:05:00.000Z',
    createdAt: '2026-11-13T16:05:00.000Z',
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

function setup(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  const detail = ref(liveDetail())
  const messages = ref<ChatbotMessage[]>([customer(10)])
  const now = ref(NOW)
  const { result } = withQuery(() => useLiveChat({ detail, messages, now }), client)
  return { chat: result, messages, client }
}

const texts = (chat: ReturnType<typeof setup>['chat']) => chat.displayMessages.value.map((m) => m.text)

beforeEach(() => {
  ids.n = 0
  auth.user = { id: 'u-1' }
  api.sendMessage.mockReset()
  api.uploadMedia.mockReset()
  api.sendTemplate.mockReset()
})

describe('live chat stores — T16 privacy: nothing of one user is ever shown to another', () => {
  it('an unconfirmed message of user A is not shown to user B (same tenant, same request, same client)', async () => {
    api.sendMessage.mockRejectedValue(new Error('network'))
    const { chat, client } = setup()
    chat.draft.value = 'Texto privado de A'
    await chat.send()
    expect(texts(chat)).toContain('Texto privado de A')

    auth.user = { id: 'u-2' }
    await nextTick()
    expect(texts(chat)).not.toContain('Texto privado de A')

    const remount = setup(client)
    expect(texts(remount.chat)).not.toContain('Texto privado de A')

    // A signing back in does not get it back either: the store was dropped when the user changed.
    auth.user = { id: 'u-1' }
    await nextTick()
    expect(texts(chat)).not.toContain('Texto privado de A')
  })

  it('a «Texto no enviado» hold of user A is not shown to user B', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat, client } = setup()
    chat.draft.value = 'Primero'
    const sending = chat.send()
    await flushPromises()
    chat.draft.value = 'Escribo otra cosa'
    pending.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending
    expect(chat.unsent.value.map((u) => u.text)).toEqual(['Primero'])

    auth.user = { id: 'u-2' }
    await nextTick()
    expect(chat.unsent.value).toEqual([])
    expect(setup(client).chat.unsent.value).toEqual([])
  })

  it('logging out drops them: the same user signing in again starts clean', async () => {
    api.sendMessage.mockRejectedValue(new Error('network'))
    const { chat, client } = setup()
    chat.draft.value = 'Antes de salir'
    await chat.send()
    expect(texts(chat)).toContain('Antes de salir')

    auth.user = null
    await nextTick()
    auth.user = { id: 'u-1' }
    await nextTick()
    expect(texts(chat)).not.toContain('Antes de salir')
    expect(texts(setup(client).chat)).not.toContain('Antes de salir')
  })

  it('the «ya reenviado» marks of user A are not user B’s', async () => {
    api.sendMessage.mockRejectedValue(new Error('network'))
    const { chat, messages } = setup()
    const failed = makeMessage({
      seq: 11,
      direction: 'OUT',
      author: 'STAFF',
      text: 'Tu folio es S-000412.',
      deliveryStatus: 'FAILED',
      clientMessageId: 'old-id',
    })
    messages.value = [customer(10), failed]
    await chat.retry(failed)
    expect(chat.retried.value.has(failed.id)).toBe(true)

    auth.user = { id: 'u-2' }
    await nextTick()
    expect(chat.retried.value.has(failed.id)).toBe(false)
  })

  it('an answer that arrives after the user changed does not restore A’s text into B’s box', async () => {
    const pending = deferred<{ message: ChatbotMessage }>()
    api.sendMessage.mockReturnValue(pending.promise)
    const { chat } = setup()
    chat.draft.value = 'Texto de A'
    const sending = chat.send()
    await flushPromises()

    auth.user = { id: 'u-2' }
    await nextTick()
    pending.reject(axiosError(409, { code: 'STALE_EPOCH' }))
    await sending

    expect(chat.draft.value).toBe('')
    expect(chat.unsent.value).toEqual([])
    expect(chat.notice.value).toBeNull()
  })

  it('the typing and the attachment of user A are cleared when the user changes', async () => {
    const { chat } = setup()
    chat.draft.value = 'Borrador de A'
    auth.user = { id: 'u-2' }
    await nextTick()
    expect(chat.draft.value).toBe('')
  })
})

describe('live chat stores — T16: empty entries are pruned', () => {
  const client = () => new QueryClient()

  it('an empty outbox is gone after a prune; one that still holds something stays', async () => {
    const c = client()
    const empty = outboxFor(c, 'u-1', 'tenant-1', 'req-empty')
    const held = outboxFor(c, 'u-1', 'tenant-1', 'req-held')
    held.holds.value = [
      {
        id: 'h',
        text: 'x',
        attachmentName: null,
        input: { kind: 'text', text: 'x' },
        error: { code: 'STALE_EPOCH' } as never,
        shown: { tone: 'warn', title: 't', detail: 'd', refetch: false },
      },
    ]
    const { pruneLiveStores } = await import('../liveStoreScope')
    pruneLiveStores(c, 'u-1')
    expect(outboxFor(c, 'u-1', 'tenant-1', 'req-held')).toBe(held)
    expect(outboxFor(c, 'u-1', 'tenant-1', 'req-empty')).not.toBe(empty)
  })

  it('an empty «reenviados» set is gone after a prune; a non-empty one stays', async () => {
    const c = client()
    const empty = retriedStoreFor(c, 'u-1', 'tenant-1', 'req-empty')
    const used = retriedStoreFor(c, 'u-1', 'tenant-1', 'req-used')
    used.value = new Set(['m-1'])
    const { pruneLiveStores } = await import('../liveStoreScope')
    pruneLiveStores(c, 'u-1')
    expect(retriedStoreFor(c, 'u-1', 'tenant-1', 'req-used')).toBe(used)
    expect(retriedStoreFor(c, 'u-1', 'tenant-1', 'req-empty')).not.toBe(empty)
  })

  it('stores of another user are never returned for this one', () => {
    const c = client()
    const a = outboxFor(c, 'u-1', 'tenant-1', 'req-A')
    const b = outboxFor(c, 'u-2', 'tenant-1', 'req-A')
    expect(b).not.toBe(a)
    expect(outboxFor(c, 'u-1', 'tenant-1', 'req-A')).not.toBe(a)
  })
})
