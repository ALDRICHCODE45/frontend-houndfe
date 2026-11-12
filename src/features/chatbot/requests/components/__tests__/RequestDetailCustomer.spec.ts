import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailCustomerCard from '../RequestDetailCustomerCard.vue'
import RequestDetailNeeds from '../RequestDetailNeeds.vue'
import { DETAIL_STUBS, makeCustomer } from '../../utils/detail-fixture'
import type { ChatbotRequestDetailCustomer } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'

function mountCard(
  customer: Partial<ChatbotRequestDetailCustomer> = {},
  phoneRestricted = false,
) {
  return mount(RequestDetailCustomerCard, {
    props: { customer: makeCustomer(customer), phoneRestricted, timeZone: TZ },
    global: { stubs: DETAIL_STUBS },
  })
}

describe('RequestDetailCustomerCard', () => {
  it('shows a linked customer: name, «De confianza», since, price list and recent orders', () => {
    const wrapper = mountCard()
    const text = wrapper.text()
    expect(text).toContain('Juan Pérez')
    expect(text).toContain('De confianza')
    expect(text).toContain('Cliente desde')
    expect(text).toContain('2 mar 2025')
    expect(text).toContain('Mayoreo')
    const orders = wrapper.get('[data-testid="recent-orders"]')
    expect(orders.text()).toContain('V-1042')
    expect(orders.text()).toContain('$1,840.00')
    expect(orders.text()).toContain('Pago pendiente')
  })

  it('does not say «De confianza» for an untrusted customer and shows a dash without a price list', () => {
    const wrapper = mountCard({ isTrusted: false, priceList: null, recentOrders: [] })
    expect(wrapper.text()).not.toContain('De confianza')
    expect(wrapper.find('[data-testid="recent-orders"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="customer-price-list"]').text()).toBe('—')
  })

  it('prints the phone exactly as the server sent it, masked or full, never rewriting it', () => {
    expect(mountCard({ phone: '+5233 **** 5678' }, true).get('[data-testid="customer-phone"]').text()).toBe(
      '+5233 **** 5678',
    )
    expect(mountCard({ phone: '+523312345678' }, false).get('[data-testid="customer-phone"]').text()).toBe(
      '+523312345678',
    )
    expect(mountCard({ phone: null }).get('[data-testid="customer-phone"]').text()).toBe('Sin teléfono')
  })

  it('explains the missing permission when the phone is masked, and offers no call or copy button', () => {
    const restricted = mountCard({}, true)
    expect(restricted.get('[data-testid="phone-restricted"]').text()).toContain('Ver teléfono completo')
    expect(restricted.find('button').exists()).toBe(false)
    expect(mountCard({}, false).find('[data-testid="phone-restricted"]').exists()).toBe(false)
  })

  it('reads «Cliente sin vincular» and lists the candidates when several customers share the phone', () => {
    const wrapper = mountCard({
      id: null,
      displayName: null,
      customerSince: null,
      priceList: null,
      isTrusted: false,
      ambiguous: true,
      recentOrders: [],
      candidates: [
        {
          id: 'c-a',
          displayName: 'Estética Canina Doña Lupe',
          phone: '+5233 **** 0142',
          isTrusted: true,
          customerSince: '2024-06-18T00:00:00.000Z',
          lastOrderAt: '2026-11-05T17:00:00.000Z',
        },
        {
          id: 'c-b',
          displayName: 'Guadalupe Camarena',
          phone: '+5233 **** 0142',
          isTrusted: false,
          customerSince: null,
          lastOrderAt: null,
        },
      ],
    })
    const text = wrapper.text()
    expect(text).toContain('Cliente sin vincular')
    expect(text).toContain('Hay 2 clientes con este teléfono')
    const candidates = wrapper.get('[data-testid="customer-candidates"]')
    expect(candidates.text()).toContain('Estética Canina Doña Lupe')
    expect(candidates.text()).toContain('De confianza')
    expect(candidates.text()).toContain('Guadalupe Camarena')
    expect(candidates.text()).toContain('Sin pedidos')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('says the phone is the only identity when the customer is unknown and nothing is ambiguous', () => {
    const wrapper = mountCard({ id: null, displayName: null, ambiguous: false, candidates: [], recentOrders: [] })
    expect(wrapper.text()).toContain('Cliente sin vincular')
    expect(wrapper.text()).toContain('La identidad es solo el teléfono')
    expect(wrapper.find('[data-testid="customer-candidates"]').exists()).toBe(false)
  })
})

describe('RequestDetailNeeds', () => {
  const mountNeeds = (props: Record<string, unknown>) =>
    mount(RequestDetailNeeds, { props: props as never, global: { stubs: DETAIL_STUBS } })

  it('renders the needs and the flat context as plain text', () => {
    const wrapper = mountNeeds({
      needs: 'Necesita 6 piezas para el viernes.',
      context: { cartRef: 'cart-9', saleId: 'sale-1', productIds: ['p1', 'p2'], quantity: 6 },
    })
    expect(wrapper.get('[data-testid="request-needs"]').text()).toBe('Necesita 6 piezas para el viernes.')
    const context = wrapper.get('[data-testid="request-context"]').text()
    expect(context).toContain('Carrito')
    expect(context).toContain('cart-9')
    expect(context).toContain('Venta')
    expect(context).toContain('2 productos')
    expect(context).toContain('Cantidad')
    expect(context).toContain('6')
  })

  it('never renders bot or customer text as HTML', () => {
    const wrapper = mountNeeds({
      needs: '<img src=x onerror=alert(1)><b>hola</b>',
      context: { cartRef: '<script>boom()</script>' },
    })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.get('[data-testid="request-needs"]').text()).toBe('<img src=x onerror=alert(1)><b>hola</b>')
    expect(wrapper.get('[data-testid="request-context"]').text()).toContain('<script>boom()</script>')
  })

  it('has a quiet line without needs and hides the context block when there is none', () => {
    const wrapper = mountNeeds({ needs: null, context: null })
    expect(wrapper.get('[data-testid="request-needs"]').text()).toBe('El bot no dejó más detalles.')
    expect(wrapper.find('[data-testid="request-context"]').exists()).toBe(false)
    expect(mountNeeds({ needs: 'x', context: {} }).find('[data-testid="request-context"]').exists()).toBe(false)
  })
})
