import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { DETAIL_STUBS } from '../../utils/detail-fixture'
import { makeMedia, makeMessage } from '../../utils/conversation-fixture'
import type { ChatbotMessage } from '../../interfaces/chatbot-request.types'

const convo = vi.hoisted(() => ({ state: null as null | Record<string, unknown>, ids: [] as unknown[] }))
vi.mock('../../composables/useRequestConversation', () => ({
  useRequestConversation: (id: unknown) => {
    convo.ids.push(id)
    return convo.state
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

import RequestDetailConversation from '../RequestDetailConversation.vue'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-12T18:00:00.000Z')
const global = { stubs: { ...DETAIL_STUBS, UModal: { template: '<div />' }, Modal: { template: '<div />' } } }

function state(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    messages: [] as ChatbotMessage[],
    hasMoreBefore: false,
    isEnabled: true,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    isLoadingOlder: false,
    olderError: null,
    loadOlder: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  }
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, typeof v === 'function' ? v : ref(v)]))
}

const mountBlock = () =>
  mount(RequestDetailConversation, { props: { requestId: 'req-1', timeZone: TZ, now: NOW }, global })

beforeEach(() => {
  convo.ids = []
  convo.state = state()
})

describe('RequestDetailConversation — states', () => {
  it('reads the conversation of the given request', () => {
    mountBlock()
    expect((convo.ids[0] as () => string)()).toBe('req-1')
  })

  it('shows a loading state with no empty message', () => {
    convo.state = state({ isLoading: true })
    const wrapper = mountBlock()
    expect(wrapper.find('[data-testid="conversation-loading"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Todavía no hay mensajes')
  })

  it('says «Todavía no hay mensajes» only for a loaded, empty conversation', () => {
    const wrapper = mountBlock()
    expect(wrapper.get('[data-testid="conversation-empty"]').text()).toContain('Todavía no hay mensajes')
  })

  it('shows an error with a retry that refetches, never the empty state', async () => {
    convo.state = state({ isError: true, error: new Error('x') })
    const wrapper = mountBlock()
    expect(wrapper.get('[data-testid="conversation-error"]').text()).toContain('No pudimos cargar la conversación')
    expect(wrapper.find('[data-testid="conversation-empty"]').exists()).toBe(false)
    await wrapper.get('[data-testid="conversation-retry"]').trigger('click')
    expect(convo.state!.refetch as Mock).toHaveBeenCalledTimes(1)
  })

  it('does not show «sin mensajes» when the block cannot read (limited role)', () => {
    convo.state = state({ isEnabled: false })
    const wrapper = mountBlock()
    expect(wrapper.find('[data-testid="conversation-empty"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="conversation-limited"]').text()).toContain('Vista limitada')
  })
})

describe('RequestDetailConversation — messages', () => {
  it('lists the messages in order inside a log, customer left and bot right', () => {
    convo.state = state({
      messages: [
        makeMessage({ seq: 1, text: 'Hola' }),
        makeMessage({ seq: 2, author: 'BOT', direction: 'OUT', text: 'Buen día' }),
      ],
    })
    const wrapper = mountBlock()
    expect(wrapper.get('[role="log"]').attributes('aria-label')).toBe('Mensajes')
    const rows = wrapper.findAll('[data-testid="conversation-message"]')
    expect(rows.map((r) => r.attributes('data-side'))).toEqual(['them', 'bot'])
    expect(rows.map((r) => r.attributes('data-seq'))).toEqual(['1', '2'])
    expect(wrapper.find('[data-testid="conversation-empty"]').exists()).toBe(false)
  })

  it('splits the days with separators (Hoy, Ayer)', () => {
    convo.state = state({
      messages: [
        makeMessage({ seq: 1, providerTimestamp: '2026-11-11T16:00:00.000Z' }),
        makeMessage({ seq: 2, providerTimestamp: '2026-11-12T15:00:00.000Z' }),
        makeMessage({ seq: 3, providerTimestamp: '2026-11-12T15:30:00.000Z' }),
      ],
    })
    const wrapper = mountBlock()
    const days = wrapper.findAll('[data-testid="conversation-day"]')
    expect(days.map((d) => d.text())).toEqual(['Ayer', 'Hoy'])
    expect(days[0]!.attributes('role')).toBe('separator')
  })

  it('shows the time of every bubble in the given zone', () => {
    convo.state = state({ messages: [makeMessage({ seq: 1, providerTimestamp: '2026-11-12T16:05:00.000Z' })] })
    expect(mountBlock().get('[data-testid="message-meta"]').text()).toContain('10:05')
  })

  it('renders every media kind inline', () => {
    convo.state = state({
      messages: [
        makeMessage({ seq: 1, type: 'IMAGE', media: makeMedia() }),
        makeMessage({ seq: 2, type: 'DOCUMENT', media: makeMedia({ id: 'm2', mimeType: 'application/pdf' }) }),
        makeMessage({ seq: 3, type: 'AUDIO', text: null, media: makeMedia({ id: 'm3', mimeType: 'audio/ogg' }) }),
      ],
    })
    const wrapper = mountBlock()
    expect(wrapper.findAll('.rc-media').map((m) => m.attributes('data-kind'))).toEqual(['image', 'pdf', 'audio'])
  })
})

describe('RequestDetailConversation — older messages', () => {
  it('offers «Cargar mensajes anteriores» only while there are older ones', async () => {
    const none = mountBlock()
    expect(none.find('[data-testid="conversation-older"]').exists()).toBe(false)

    convo.state = state({ messages: [makeMessage({ seq: 20 })], hasMoreBefore: true })
    const wrapper = mountBlock()
    const button = wrapper.get('[data-testid="conversation-older"]')
    expect(button.text()).toContain('Cargar mensajes anteriores')
    await button.trigger('click')
    expect(convo.state!.loadOlder as Mock).toHaveBeenCalledTimes(1)
  })

  it('disables the button while loading and shows a retryable error when the page fails', () => {
    convo.state = state({ messages: [makeMessage({ seq: 20 })], hasMoreBefore: true, isLoadingOlder: true })
    const loading = mountBlock()
    expect(loading.get('[data-testid="conversation-older"]').attributes('disabled')).toBeDefined()

    convo.state = state({ messages: [makeMessage({ seq: 20 })], hasMoreBefore: true, olderError: new Error('x') })
    const failed = mountBlock()
    expect(failed.get('[data-testid="conversation-older-error"]').text()).toContain('No se pudieron cargar')
    expect(failed.get('[data-testid="conversation-older"]').attributes('disabled')).toBeUndefined()
  })
})

describe('RequestDetailConversation — scrolling', () => {
  it('opens at the latest message and follows new ones only when the reader is near the bottom', async () => {
    const messages = ref([makeMessage({ seq: 1 })])
    convo.state = { ...state(), messages }
    const wrapper = mountBlock()
    const log = wrapper.get('[role="log"]').element as HTMLElement
    Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 400 })
    log.scrollTop = 600 // at the bottom

    messages.value = [...messages.value, makeMessage({ seq: 2 })]
    await flushPromises()
    expect(log.scrollTop).toBe(1000)

    log.scrollTop = 0 // reading old messages
    messages.value = [...messages.value, makeMessage({ seq: 3 })]
    await flushPromises()
    expect(log.scrollTop).toBe(0)
  })
})
