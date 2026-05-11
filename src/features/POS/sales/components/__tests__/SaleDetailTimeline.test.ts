import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleDetailTimeline from '../SaleDetailTimeline.vue'

describe('SaleDetailTimeline', () => {
  it('renders events in reverse order and payment label', () => {
    const wrapper = mount(SaleDetailTimeline, {
      props: {
        timeline: [
          { type: 'SALE_REGISTERED', at: '2026-05-06T14:41:00.000Z' },
          { type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:00.000Z' },
          { type: 'PRODUCTS_DELIVERED', at: '2026-05-06T14:43:00.000Z' },
        ],
        payments: [{ method: 'CASH', amountCents: 127000, tenderedCents: 127000, changeCents: 0, reference: null, paidAt: '2026-05-06T14:42:00.000Z' }],
      },
    })

    const rows = wrapper.findAll('[data-testid="timeline-event"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Entrega de Productos')
    expect(rows[1]!.text()).toContain('Cobro de $1,270.00 en Efectivo')
    expect(rows[2]!.text()).toContain('Venta Registrada')
  })

  it('renders non-cash payment method label for payment events', () => {
    const wrapper = mount(SaleDetailTimeline, {
      props: {
        timeline: [{ type: 'PAYMENT_RECEIVED', at: '2026-05-06T14:42:00.000Z' }],
        payments: [{ method: 'CARD_CREDIT', amountCents: 50000, tenderedCents: 50000, changeCents: 0, reference: null, paidAt: '2026-05-06T14:42:00.000Z' }],
      },
    })

    const rows = wrapper.findAll('[data-testid="timeline-event"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Cobro de $500.00 en Tarjeta de Crédito')
  })
})
