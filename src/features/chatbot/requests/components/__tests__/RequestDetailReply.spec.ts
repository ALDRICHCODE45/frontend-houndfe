import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailReply from '../RequestDetailReply.vue'
import { DETAIL_STUBS } from '../../utils/detail-fixture'
import type {
  ChatbotRequestDelivery,
  ChatbotRequestReply,
} from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-12T17:00:00.000Z')

const reply = (overrides: Partial<ChatbotRequestReply> = {}): ChatbotRequestReply => ({
  id: 'r-1',
  text: 'Sí, es apto desde las 8 semanas.',
  repliedBy: { id: 'u-2', displayName: 'Ana López' },
  repliedAt: '2026-11-12T16:00:00.000Z',
  ...overrides,
})

const delivery = (overrides: Partial<ChatbotRequestDelivery> = {}): ChatbotRequestDelivery => ({
  deliveryId: 'd-1',
  type: 'request.answered',
  createdAt: '2026-11-12T16:00:00.000Z',
  outcome: 'PROVIDER_ACCEPTED',
  attemptedAt: null,
  providerStatus: null,
  needsReconciliation: false,
  ...overrides,
})

const mountReply = (props: Record<string, unknown>) =>
  mount(RequestDetailReply, {
    props: { reply: reply(), deliveries: [], timeZone: TZ, now: NOW, ...props },
    global: { stubs: DETAIL_STUBS },
  })

describe('RequestDetailReply — «Respuesta enviada»', () => {
  it('shows the text, who wrote it and when', () => {
    const wrapper = mountReply({})
    expect(wrapper.get('h2').text()).toBe('Respuesta enviada')
    expect(wrapper.get('[data-testid="reply-text"]').text()).toBe('Sí, es apto desde las 8 semanas.')
    const by = wrapper.get('[data-testid="reply-byline"]').text()
    expect(by).toContain('Ana López')
    expect(by).toContain('hoy 10:00')
  })

  it('says «ti» when the signed-in user wrote it', () => {
    const wrapper = mountReply({ currentUserId: 'u-2' })
    expect(wrapper.get('[data-testid="reply-byline"]').text()).toContain('ti')
    expect(wrapper.get('[data-testid="reply-byline"]').text()).not.toContain('Ana López')
  })

  it('renders the text as text, never as markup', () => {
    const wrapper = mountReply({ reply: reply({ text: '<b>Hola</b> <img src=x onerror=alert(1)>' }) })
    expect(wrapper.get('[data-testid="reply-text"]').text()).toBe('<b>Hola</b> <img src=x onerror=alert(1)>')
    expect(wrapper.find('[data-testid="reply-text"] b').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('shows the delivery of the answer (request.answered)', () => {
    const wrapper = mountReply({ deliveries: [delivery()] })
    expect(wrapper.get('[data-testid="reply-delivery"]').text()).toBe('Entregada a WhatsApp')
  })

  it('DEFERRED_WINDOW_CLOSED reads «Pendiente: se enviará cuando el cliente escriba»', () => {
    const wrapper = mountReply({ deliveries: [delivery({ outcome: 'DEFERRED_WINDOW_CLOSED' })] })
    expect(wrapper.get('[data-testid="reply-delivery"]').text()).toBe(
      'Pendiente: se enviará cuando el cliente escriba',
    )
  })

  it('flags a doubtful delivery', () => {
    const wrapper = mountReply({ deliveries: [delivery({ outcome: 'DELIVERY_UNKNOWN', needsReconciliation: true })] })
    expect(wrapper.get('[data-testid="reply-delivery"]').text()).toContain('Entrega dudosa')
    expect(wrapper.get('[data-testid="reply-delivery"]').attributes('data-doubtful')).toBe('true')
  })

  it('uses the newest request.answered delivery and ignores other delivery types', () => {
    const wrapper = mountReply({
      deliveries: [
        delivery({ deliveryId: 'd-3', type: 'request.resolved', outcome: 'STALE' }),
        delivery({ deliveryId: 'd-2', outcome: 'PROVIDER_ACCEPTED' }),
        delivery({ deliveryId: 'd-1', outcome: 'DEFERRED_WINDOW_CLOSED' }),
      ],
    })
    expect(wrapper.get('[data-testid="reply-delivery"]').text()).toBe('Entregada a WhatsApp')
  })

  it('shows no delivery line when the bot has not reported one', () => {
    expect(mountReply({ deliveries: [] }).find('[data-testid="reply-delivery"]').exists()).toBe(false)
  })

  it('an unknown outcome never prints a raw code', () => {
    const wrapper = mountReply({ deliveries: [delivery({ outcome: 'SOMETHING_NEW' as never })] })
    expect(wrapper.get('[data-testid="reply-delivery"]').text()).toBe('Estado de entrega desconocido')
  })
})
