import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import SaleCard from '../SaleCard.vue'
import type { ConfirmedSaleRow } from '../../interfaces/sale.types'

const sale: ConfirmedSaleRow = {
  id: 'sale-1',
  folio: 'A-202605-000015',
  status: 'CONFIRMED',
  paymentStatus: 'PARTIAL',
  deliveryStatus: 'PENDING',
  totalCents: 120000,
  debtCents: 5000,
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: '2026-06-01T10:00:00.000Z',
  customer: { id: 'customer-1', name: 'Acme SA' },
  cashier: { id: 'cashier-1', name: 'Cajero' },
  seller: null,
  paymentMethods: ['CASH'],
}

function mountCard(overrides: Partial<ConfirmedSaleRow> = {}) {
  return mount(SaleCard, {
    props: { sale: { ...sale, ...overrides } },
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
        StatusDotBadge: {
          props: ['label', 'tone'],
          template: '<span :data-tone="tone">{{ label }}</span>',
        },
      },
    },
  })
}

describe('SaleCard', () => {
  it('renders main fields', () => {
    const wrapper = mountCard()
    expect(wrapper.text()).toContain('#15')
    expect(wrapper.text()).toContain('Acme SA')
    expect(wrapper.text()).toContain('$1,200.00')
    expect(wrapper.text()).toContain('$50.00')
  })

  it('shows Público en General when customer is null', () => {
    const wrapper = mountCard({ customer: null })
    expect(wrapper.text()).toContain('Público en General')
  })

  it('hides debt row when debtCents is 0', () => {
    const wrapper = mountCard({ debtCents: 0 })
    expect(wrapper.find('[data-testid="sale-card-debt"]').exists()).toBe(false)
  })

  it('hides due date when dueDate is null', () => {
    const wrapper = mountCard({ dueDate: null })
    expect(wrapper.find('[data-testid="sale-card-due-date"]').exists()).toBe(false)
  })

  it('links to detail route', () => {
    const wrapper = mountCard()
    const link = wrapper.getComponent(RouterLinkStub)
    expect(link.props('to')).toBe('/pos/ventas/sale-1')
  })

  // status-badge-unification: sale.status + deliveryStatus migrate to StatusDotBadge.
  // The StatusDotBadge stub exposes :data-tone; raw UBadge does not, so the
  // data-tone assertion is the RED→GREEN gate.

  it('renders sale status via StatusDotBadge (CONFIRMED, success)', () => {
    const wrapper = mountCard({ status: 'CONFIRMED' })
    expect(wrapper.text()).toContain('CONFIRMED')
    expect(wrapper.find('[data-tone="success"]').exists()).toBe(true)
  })

  it('renders delivery status via StatusDotBadge (No Entregados, error for PENDING)', () => {
    const wrapper = mountCard({ deliveryStatus: 'PENDING' })
    expect(wrapper.text()).toContain('No Entregados')
    expect(wrapper.find('[data-tone="error"]').exists()).toBe(true)
  })
})
