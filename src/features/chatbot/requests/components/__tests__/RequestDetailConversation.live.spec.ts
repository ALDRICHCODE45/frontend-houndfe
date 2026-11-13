import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { axiosError } from '../../composables/__tests__/withQuery'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import { makeMessage } from '../../utils/conversation-fixture'
import type { ChatbotLiveSessionState, ChatbotMessage, ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

const convo = vi.hoisted(() => ({ calls: [] as Array<{ id: unknown; options: Record<string, unknown> | undefined }>, messages: null as unknown }))
vi.mock('../../composables/useRequestConversation', () => ({
  useRequestConversation: (id: unknown, options?: Record<string, unknown>) => {
    convo.calls.push({ id, options })
    return {
      messages: convo.messages,
      hasMoreBefore: ref(false),
      isEnabled: ref(true),
      isLoading: ref(false),
      isFetching: ref(false),
      isError: ref(false),
      error: ref(null),
      isLoadingOlder: ref(false),
      olderError: ref(null),
      loadOlder: vi.fn(),
      refetch: vi.fn(),
    }
  },
}))
vi.mock('../../composables/useChatbotMedia', () => ({
  useChatbotMedia: () => ({
    url: ref(null),
    blob: ref(null),
    isLoading: ref(false),
    isError: ref(false),
    isPurged: ref(false),
    errorMessage: ref(null),
    refetch: vi.fn(),
  }),
}))
vi.mock('../../api/chatbot-live.api', () => ({
  chatbotLiveApi: { sendMessage: vi.fn(), uploadMedia: vi.fn(), sendTemplate: vi.fn() },
}))
const COST = 'Cada plantilla se cobra a la tarifa de WhatsApp Business (aprox. $0.62 MXN).'
vi.mock('../../composables/useTemplateCost', async () => {
  const { computed, toValue } = await import('vue')
  return {
    // Mirrors the real order: the detail text first, then the settings text (COST here).
    useTemplateCost: (fromDetail?: unknown) => ({
      costText: computed(() => (toValue(fromDetail as never) as string | null | undefined)?.trim() || COST),
      isFromSettings: ref(true),
    }),
  }
})
const auth = vi.hoisted(() => ({ perms: new Set<string>() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    user: { id: 'u-1' },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))

import { chatbotLiveApi } from '../../api/chatbot-live.api'
import RequestDetailConversation from '../RequestDetailConversation.vue'

const api = vi.mocked(chatbotLiveApi)

/** The block passes refs or getters (MaybeRefOrGetter): read either. */
function optionValue(call: number, name: 'asAttendee' | 'live'): unknown {
  const raw = (convo.calls[call]!.options ?? {})[name] as unknown
  if (typeof raw === 'function') return (raw as () => unknown)()
  return (raw as { value: unknown } | undefined)?.value
}
const lastOf = <T,>(list: T[]) => list[list.length - 1]!
const NOW = new Date('2026-11-13T16:06:00.000Z')
const TZ = 'America/Mexico_City'

const stubs = {
  ...DETAIL_STUBS,
  UModal: { template: '<div />' },
  Modal: { template: '<div />' },
  AppResponsiveDrawer: {
    props: ['open', 'title'],
    emits: ['update:open'],
    template: '<section v-if="open" data-testid="drawer"><h2 data-testid="drawer-title">{{ title }}</h2><slot name="body" /></section>',
  },
}

function live(
  state: ChatbotLiveSessionState,
  overrides: Partial<ChatbotRequestDetail> = {},
  session: Partial<NonNullable<ChatbotRequestDetail['liveSession']>> = {},
): ChatbotRequestDetail {
  return makeDetail({
    subtype: 'COMPLAINT',
    status: state === 'WAITING' ? 'NEW' : state === 'ENDING' || state === 'ENDED' ? 'RESOLVED' : 'IN_PROGRESS',
    assignee: state === 'WAITING' ? null : { id: 'u-1', displayName: 'Laura Méndez' },
    allowedActions: state === 'ACTIVE' ? ['SEND_MESSAGE', 'FINISH'] : state === 'WAITING' ? ['CLAIM'] : [],
    liveSession: {
      state,
      handoffEpoch: 3,
      lastStaffActivityAt: '2026-11-13T16:00:00.000Z',
      lastCustomerMessageAt: '2026-11-13T16:05:00.000Z',
      ...session,
    },
    ...overrides,
  })
}

const customer = (seq: number, text = 'Hola') =>
  makeMessage({ seq, direction: 'IN', author: 'CUSTOMER', text, providerTimestamp: '2026-11-13T16:05:00.000Z', createdAt: '2026-11-13T16:05:00.000Z' })
const sent = (seq: number, clientMessageId: string, extra: Partial<ChatbotMessage> = {}): ChatbotMessage =>
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

function mountBlock(detail: ChatbotRequestDetail | undefined, messages: ChatbotMessage[] = [customer(10)], props: Record<string, unknown> = {}, attachTo?: HTMLElement) {
  convo.messages = ref(messages)
  return mount(RequestDetailConversation, {
    attachTo,
    props: { requestId: 'req-1', timeZone: TZ, now: NOW, detail, currentUserId: 'u-1', ...props },
    global: { plugins: [[VueQueryPlugin, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }]], stubs },
  })
}

beforeEach(() => {
  convo.calls = []
  api.sendMessage.mockReset()
  api.uploadMedia.mockReset()
  api.sendTemplate.mockReset()
  auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation', 'update:ChatbotRequest'])
})

describe('RequestDetailConversation — reading the thread as the attendee', () => {
  it('asks for the thread as the attendee, and live while the session runs', () => {
    mountBlock(live('ACTIVE'))
    expect(optionValue(0, 'asAttendee')).toBe(true)
    expect(optionValue(0, 'live')).toBe(true)
  })

  it('is not live nor attendee for another person’s conversation or an ended one', () => {
    mountBlock(live('ACTIVE', { assignee: { id: 'u-9', displayName: 'Diego' } }))
    expect(optionValue(0, 'asAttendee')).toBe(false)
    mountBlock(live('ENDED'))
    expect(optionValue(1, 'live')).toBe(false)
  })

  it('the attendee without read:ChatbotConversation is told they only see their session', () => {
    auth.perms = new Set(['read:ChatbotRequest', 'update:ChatbotRequest'])
    expect(mountBlock(live('ACTIVE')).find('[data-testid="banner-scoped"]').exists()).toBe(true)
    auth.perms = new Set(['read:ChatbotRequest', 'read:ChatbotConversation', 'update:ChatbotRequest'])
    expect(mountBlock(live('ACTIVE')).find('[data-testid="banner-scoped"]').exists()).toBe(false)
  })
})

describe('RequestDetailConversation — composer', () => {
  it('shows the composer (no «Solo lectura») for the attendee of an ACTIVE session', () => {
    const wrapper = mountBlock(live('ACTIVE'))
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Solo lectura')
    expect(wrapper.get('[data-testid="session-badge"]').text()).toContain('En vivo')
  })

  it('sends on submit with the epoch, shows the bubble at once and clears the box', async () => {
    let resolve!: (v: { message: ChatbotMessage }) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('Hola, soy Ana.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(api.sendMessage).toHaveBeenCalledWith('req-1', {
      clientMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      expectedEpoch: 3,
      text: 'Hola, soy Ana.',
    })
    expect((wrapper.get('[data-testid="composer-text"]').element as HTMLTextAreaElement).value).toBe('')
    const texts = wrapper.findAll('[data-testid="message-text"]').map((t) => t.text())
    expect(texts).toContain('Hola, soy Ana.')
    expect(lastOf(wrapper.findAll('[data-testid="message-delivery"]')).text()).toBe('En cola')

    resolve({ message: sent(11, 'x', { text: 'Hola, soy Ana.' }) })
    await flushPromises()
    expect(wrapper.findAll('[data-testid="conversation-message"]')).toHaveLength(2)
  })

  it('a 409 WINDOW_CLOSED keeps the text, swaps the composer for the blocked box and says why', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('Te confirmo en unos minutos.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="live-blocked"]').text()).toContain('La ventana de 24 h está cerrada')
    expect(wrapper.get('[data-testid="blocked-draft"]').text()).toContain('Te confirmo en unos minutos.')
    expect(wrapper.get('[data-testid="live-notice"]').text()).toContain('no se envió')
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeUndefined()
  })

  it('T13: a refused text with newer typing waits in «Texto no enviado»; «Usar este texto» appends it', async () => {
    let reject!: (e: unknown) => void
    api.sendMessage.mockReturnValue(new Promise((_, r) => (reject = r)))
    const wrapper = mountBlock(live('ACTIVE'))
    const box = wrapper.get('[data-testid="composer-text"]')
    await box.setValue('Primero')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await box.setValue('Segundo')
    reject(axiosError(409, { code: 'STALE_EPOCH', currentEpoch: 4 }))
    await flushPromises()

    expect((box.element as HTMLTextAreaElement).value).toBe('Segundo')
    expect(wrapper.get('[data-testid="live-unsent"]').text()).toContain('Texto no enviado')
    expect(wrapper.get('[data-testid="live-unsent-text"]').text()).toBe('Primero')

    await wrapper.get('[data-testid="live-unsent-use"]').trigger('click')
    expect((box.element as HTMLTextAreaElement).value).toBe('Segundo\n\nPrimero')
    expect(wrapper.find('[data-testid="live-unsent"]').exists()).toBe(false)
  })

  it('T13 D5: tells its parent the window the composer uses (for the rail)', async () => {
    const wrapper = mountBlock(live('ACTIVE'))
    await flushPromises()
    const emitted = wrapper.emitted('window-state')
    expect(emitted).toBeTruthy()
    expect(emitted![emitted!.length - 1]![0]).toMatchObject({ closed: false })
  })

  it('a STALE_EPOCH keeps the draft in the box and says the conversation changed', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'STALE_EPOCH', currentEpoch: 4 }))
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('Escribía esto')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect((wrapper.get('[data-testid="composer-text"]').element as HTMLTextAreaElement).value).toBe('Escribía esto')
    expect(wrapper.get('[data-testid="live-notice"]').text()).toContain('La conversación cambió')
  })

  it('the notice can be dismissed', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'STALE_EPOCH' }))
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('x')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="live-notice-close"]').trigger('click')
    expect(wrapper.find('[data-testid="live-notice"]').exists()).toBe(false)
  })

  it('«Reintentar» on a FAILED message sends a new message under a new id', async () => {
    api.sendMessage.mockResolvedValue({ message: sent(13, 'new') })
    const failed = sent(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })
    const wrapper = mountBlock(live('ACTIVE'), [customer(10), failed])
    await wrapper.get('[data-testid="message-retry"]').trigger('click')
    await flushPromises()
    const body = api.sendMessage.mock.calls[0]![1]
    expect(body).toMatchObject({ expectedEpoch: 3, text: 'Tu folio es S-000412.' })
    expect(body.clientMessageId).not.toBe('old-id')
  })

  it('«Pendiente de envío» appears on a message still queued after 30 s', () => {
    const queued = sent(11, 'k', { createdAt: '2026-11-13T16:05:00.000Z' })
    const wrapper = mountBlock(live('ACTIVE'), [customer(10), queued])
    expect(lastOf(wrapper.findAll('[data-testid="message-delivery"]')).text()).toBe('Pendiente de envío')
  })
})

describe('RequestDetailConversation — T5L.F: double Enter and double click send once', () => {
  const pending = () => {
    let resolve!: (v: { message: ChatbotMessage }) => void
    api.sendMessage.mockReturnValue(new Promise((r) => (resolve = r)))
    return (message: ChatbotMessage) => resolve({ message })
  }

  it('Enter twice in a row POSTs once', async () => {
    const answer = pending()
    const wrapper = mountBlock(live('ACTIVE'))
    const box = wrapper.get('[data-testid="composer-text"]')
    await box.setValue('Hola, soy Ana.')
    await box.trigger('keydown', { key: 'Enter' })
    await box.trigger('keydown', { key: 'Enter' })
    answer(sent(11, 'x', { text: 'Hola, soy Ana.' }))
    await flushPromises()

    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-testid="conversation-message"]')).toHaveLength(2)
  })

  it('a double click on «Enviar» POSTs once and leaves one bubble', async () => {
    const answer = pending()
    const wrapper = mountBlock(live('ACTIVE'), [customer(10)], {}, document.body)
    await wrapper.get('[data-testid="composer-text"]').setValue('Hola, soy Ana.')
    const button = wrapper.get('[data-testid="composer-send"]')
    await button.trigger('click')
    await button.trigger('click')
    answer(sent(11, 'x', { text: 'Hola, soy Ana.' }))
    await flushPromises()

    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-testid="conversation-message"]')).toHaveLength(2)
    wrapper.unmount()
  })

  it('a double click on «Reintentar» of an unconfirmed message POSTs the same id once more, not twice', async () => {
    api.sendMessage.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('Hola, soy Ana.')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(lastOf(wrapper.findAll('[data-testid="message-delivery"]')).text()).toContain('No sabemos si se envió')

    const answer = pending()
    const retry = wrapper.get('[data-testid="message-retry"]')
    await retry.trigger('click')
    await retry.trigger('click')
    answer(sent(11, 'x', { text: 'Hola, soy Ana.' }))
    await flushPromises()

    expect(api.sendMessage).toHaveBeenCalledTimes(2)
    const ids = api.sendMessage.mock.calls.map((c) => (c[1] as { clientMessageId: string }).clientMessageId)
    expect(ids[1]).toBe(ids[0])
  })

  it('a double click on «Reintentar» of a server FAILED message POSTs one new message', async () => {
    const answer = pending()
    const failed = sent(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })
    const wrapper = mountBlock(live('ACTIVE'), [customer(10), failed])
    const retry = wrapper.get('[data-testid="message-retry"]')
    await retry.trigger('click')
    await retry.trigger('click')
    answer(sent(13, 'new'))
    await flushPromises()
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('RequestDetailConversation — window closed and the template', () => {
  const closed = () =>
    live('ACTIVE', { allowedActions: ['SEND_MESSAGE', 'SEND_TEMPLATE', 'FINISH'] }, { lastCustomerMessageAt: '2026-11-12T10:00:00.000Z' })
  const oldMessages = () => [makeMessage({ seq: 10, direction: 'IN', author: 'CUSTOMER', providerTimestamp: '2026-11-12T10:00:00.000Z' })]

  it('starts blocked when the window is already closed, with the cost and the button', () => {
    const wrapper = mountBlock(closed(), oldMessages())
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="template-cost"]').text()).toContain(COST)
    expect(wrapper.find('[data-testid="session-badge"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="window-chip"]').text()).toBe('Ventana de 24 h cerrada')
    expect(wrapper.classes()).toContain('rc--blocked')
  })

  it('T15: switching to another request closes the template confirmation (never offer A\'s paid template on B)', async () => {
    const wrapper = mountBlock(closed(), oldMessages())
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    expect(wrapper.find('[data-testid="template-confirm-cost"]').exists()).toBe(true)
    await wrapper.setProps({ requestId: 'req-2', detail: { ...closed(), id: 'req-2' } })
    expect(wrapper.find('[data-testid="template-confirm-cost"]').exists()).toBe(false)
  })

  it('T15: a late template answer of A does not close a confirmation B opened', async () => {
    let resolveA!: (value: unknown) => void
    api.sendTemplate.mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve }))
    const wrapper = mountBlock(closed(), oldMessages())
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    await wrapper.get('[data-testid="template-confirm"]').trigger('click')
    await wrapper.setProps({ requestId: 'req-2', detail: { ...closed(), id: 'req-2' } })
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    resolveA({ message: null })
    await flushPromises()
    expect(wrapper.find('[data-testid="template-confirm-cost"]').exists()).toBe(true)
  })

  it('the button does not send: it opens the confirmation with the settings cost', async () => {
    const wrapper = mountBlock(closed(), oldMessages())
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    expect(api.sendTemplate).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="template-confirm-cost"]').text()).toBe(COST)
  })

  it('T12: the confirmation shows the cost the detail carries, ahead of the settings', async () => {
    const detail = { ...closed(), templateCostText: 'Costo del detalle: $0.62 MXN.' }
    const wrapper = mountBlock(detail, oldMessages())
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    expect(wrapper.get('[data-testid="template-confirm-cost"]').text()).toBe('Costo del detalle: $0.62 MXN.')
  })

  it('confirming POSTs the template with the epoch and closes the sheet', async () => {
    api.sendTemplate.mockResolvedValue({
      message: sent(11, 'tpl', { type: 'TEMPLATE', text: '', templateName: 'seguimiento_pedido' }),
    })
    const wrapper = mountBlock(closed(), oldMessages())
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    await wrapper.get('[data-testid="template-confirm"]').trigger('click')
    await flushPromises()
    expect(api.sendTemplate).toHaveBeenCalledWith('req-1', { expectedEpoch: 3 }, expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(wrapper.find('[data-testid="template-sheet"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="message-template"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="template-state"]').text()).toContain('Plantilla enviada')
  })

  it('without SEND_TEMPLATE the button is disabled', () => {
    const detail = live('ACTIVE', { allowedActions: ['SEND_MESSAGE', 'FINISH'] }, { lastCustomerMessageAt: '2026-11-12T10:00:00.000Z' })
    const wrapper = mountBlock(detail, oldMessages())
    expect(wrapper.get('[data-testid="template-open"]').attributes('disabled')).toBeDefined()
  })

  it('TEMPLATE_ALREADY_SENT is explained and nothing is sent twice', async () => {
    api.sendTemplate.mockRejectedValue(axiosError(409, { code: 'TEMPLATE_ALREADY_SENT' }))
    const wrapper = mountBlock(closed(), oldMessages())
    await wrapper.get('[data-testid="template-open"]').trigger('click')
    await wrapper.get('[data-testid="template-confirm"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="live-notice"]').text()).toContain('La plantilla ya se envió')
    expect(api.sendTemplate).toHaveBeenCalledTimes(1)
  })
})

describe('RequestDetailConversation — session states and roles', () => {
  it('STARTING: «Conectando…» with a disabled composer', () => {
    const wrapper = mountBlock(live('STARTING'))
    expect(wrapper.get('[data-testid="banner-starting"]').text()).toContain('Conectando…')
    expect(wrapper.get('[data-testid="composer-text"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="composer-text"]').attributes('placeholder')).toBe('Conectando…')
  })

  it('WAITING: no composer, says to claim it, and «Atender de nuevo» emits CLAIM', async () => {
    const wrapper = mountBlock(live('WAITING'))
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="live-note"]').text()).toContain('Atiende la solicitud para escribir')
    await wrapper.get('[data-testid="banner-claim"]').trigger('click')
    expect(wrapper.emitted('action')![0]).toEqual(['CLAIM'])
  })

  it('ENDING and ENDED: no composer, «La conversación terminó»', () => {
    for (const state of ['ENDING', 'ENDED'] as const) {
      const wrapper = mountBlock(live(state))
      expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="live-note"]').text()).toContain('La conversación terminó')
    }
  })

  it('someone else’s conversation is read-only: «Atiende Diego», reassigners get the two buttons', async () => {
    const other = live('ACTIVE', {
      assignee: { id: 'u-9', displayName: 'Diego Ramírez' },
      allowedActions: ['REASSIGN', 'FINISH'],
    })
    const wrapper = mountBlock(other)
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="live-note"]').text()).toContain('Atiende Diego Ramírez')
    await wrapper.get('[data-testid="note-reassign"]').trigger('click')
    await wrapper.get('[data-testid="note-finish"]').trigger('click')
    expect(wrapper.emitted('action')).toEqual([['REASSIGN'], ['FINISH']])
  })

  it('a viewer with no reassign or finish gets just the explanation', () => {
    const other = live('ACTIVE', { assignee: { id: 'u-9', displayName: 'Diego Ramírez' }, allowedActions: [] })
    const wrapper = mountBlock(other)
    expect(wrapper.find('[data-testid="note-reassign"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="note-finish"]').exists()).toBe(false)
  })
})

describe('RequestDetailConversation — mobile full screen (design 04)', () => {
  it('collapsed it shows the «Conversación en vivo» card with the last customer message', async () => {
    const wrapper = mountBlock(live('ACTIVE'), [customer(10, 'Sí, por favor. La necesito para el fin de semana.')], { mobileOpen: false })
    expect(wrapper.classes()).not.toContain('rc--open')
    const card = wrapper.get('[data-testid="live-card"]')
    expect(card.text()).toContain('Sí, por favor. La necesito para el fin de semana.')
    await wrapper.get('[data-testid="live-card-open"]').trigger('click')
    expect(wrapper.emitted('update:mobileOpen')![0]).toEqual([true])
  })

  it('open it is full screen with a back button to the detail', async () => {
    const wrapper = mountBlock(live('ACTIVE'), [customer(10)], { mobileOpen: true })
    expect(wrapper.classes()).toContain('rc--open')
    expect(wrapper.get('[data-testid="live-mobile-title"]').text()).toContain('Juan Pérez')
    await wrapper.get('[data-testid="live-back"]').trigger('click')
    expect(wrapper.emitted('update:mobileOpen')![0]).toEqual([false])
  })
})

describe('RequestDetailConversation — without a live session nothing changes', () => {
  it('keeps the read-only help and renders no live parts', () => {
    const wrapper = mountBlock(makeDetail())
    expect(wrapper.text()).toContain('Solo lectura')
    expect(wrapper.find('[data-testid="live-status"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="live-card"]').exists()).toBe(false)
  })
})

describe('RequestDetailConversation — T14: remount and reuse for the same or another request', () => {
  const failed = () => sent(11, 'old-id', { deliveryStatus: 'FAILED', text: 'Tu folio es S-000412.' })
  const sharedClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const mountWith = (client: QueryClient, detail: ChatbotRequestDetail = live('ACTIVE')) => {
    convo.messages = ref([customer(10), failed()])
    return mount(RequestDetailConversation, {
      props: { requestId: detail.id, timeZone: TZ, now: NOW, detail, currentUserId: 'u-1' },
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]], stubs },
    })
  }

  it('«Enviar como mensaje nuevo» does not come back on an already resent FAILED message after a remount', async () => {
    api.sendMessage.mockResolvedValue({ message: sent(13, 'new') })
    const client = sharedClient()
    const first = mountWith(client)
    await first.get('[data-testid="message-retry"]').trigger('click')
    await flushPromises()
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    first.unmount()

    const second = mountWith(client)
    await flushPromises()
    expect(second.find('[data-testid="message-retry"]').exists()).toBe(false)
  })

  it('another request mounted on the same client still offers it', async () => {
    api.sendMessage.mockResolvedValue({ message: sent(13, 'new') })
    const client = sharedClient()
    const first = mountWith(client)
    await first.get('[data-testid="message-retry"]').trigger('click')
    await flushPromises()
    first.unmount()

    const other = mountWith(client, live('ACTIVE', { id: 'req-2' }))
    expect(other.find('[data-testid="message-retry"]').exists()).toBe(true)
  })

  it('the view reuses the block across /chatbot/solicitudes/:id: the typed text stays with its own request', async () => {
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('Para la solicitud uno')
    await wrapper.setProps({ requestId: 'req-2', detail: live('ACTIVE', { id: 'req-2' }) })
    await flushPromises()
    expect((wrapper.get('[data-testid="composer-text"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('the WINDOW_CLOSED override of a request does not close the composer of the next one', async () => {
    api.sendMessage.mockRejectedValue(axiosError(409, { code: 'WINDOW_CLOSED', templateAllowed: true }))
    const wrapper = mountBlock(live('ACTIVE'))
    await wrapper.get('[data-testid="composer-text"]').setValue('Hola')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(false)

    await wrapper.setProps({ requestId: 'req-2', detail: live('ACTIVE', { id: 'req-2' }) })
    await flushPromises()
    expect(wrapper.find('[data-testid="live-composer"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="live-blocked"]').exists()).toBe(false)
  })
})
