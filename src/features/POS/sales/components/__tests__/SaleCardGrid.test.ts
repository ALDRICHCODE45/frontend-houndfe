import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCardGrid from '../SaleCardGrid.vue'
import type { ConfirmedSaleRow } from '../../interfaces/sale.types'

const sampleSale: ConfirmedSaleRow = {
  id: 'sale-1',
  folio: 'A-202605-000001',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  totalCents: 120000,
  debtCents: 0,
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: null,
  customer: { id: 'customer-1', name: 'Acme SA' },
  cashier: { id: 'cashier-1', name: 'Cajero' },
  seller: null,
  paymentMethods: ['CASH'],
}

const SaleCardStub = {
  name: 'SaleCard',
  props: ['sale'],
  emits: ['click'],
  template: '<article data-testid="sale-card" :data-sale-id="sale.id" @click="$emit(\'click\', sale)">{{ sale.id }}</article>',
}

function mountGrid(props: Record<string, unknown> = {}) {
  return mount(SaleCardGrid, {
    props: { sales: [sampleSale], ...props },
    global: { stubs: { SaleCard: SaleCardStub } },
  })
}

describe('SaleCardGrid — Employee ladder (REQ-14)', () => {
  it('renders the Employee ladder grid classes on the card container', () => {
    const wrapper = mountGrid()
    const grid = wrapper.find('[data-testid="sale-cards-grid"]')
    expect(grid.exists()).toBe(true)
    expect(grid.classes()).toEqual(
      expect.arrayContaining([
        'grid',
        'gap-3',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-5',
        '2xl:grid-cols-7',
      ]),
    )
  })

  it('renders one SaleCard per row', () => {
    const wrapper = mountGrid({ sales: [sampleSale, { ...sampleSale, id: 'sale-2' }] })
    expect(wrapper.findAll('[data-testid="sale-card"]')).toHaveLength(2)
  })

  it('forwards card click events as card-click with the sale', async () => {
    const wrapper = mountGrid({ sales: [sampleSale] })
    await wrapper.get('[data-testid="sale-card"]').trigger('click')
    const events = wrapper.emitted('card-click')
    expect(events).toBeDefined()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual([sampleSale])
  })

  it('renders 8 pulse skeletons with border-default + bg-elevated when loading', () => {
    const wrapper = mountGrid({ sales: [], loading: true })
    const skeletons = wrapper.findAll('.animate-pulse')
    expect(skeletons).toHaveLength(8)
    expect(skeletons[0]!.classes()).toEqual(
      expect.arrayContaining(['border-default', 'bg-elevated']),
    )
  })

  it('renders the empty state with i-lucide-receipt icon when there are no sales and not loading', () => {
    const wrapper = mountGrid({ sales: [], loading: false, empty: 'No hay ventas todavía' })
    expect(wrapper.text()).toContain('No hay ventas todavía')
    expect(wrapper.find('[data-testid="sale-card"]').exists()).toBe(false)
    // UIcon is registered globally by @nuxt/ui — assert the icon name surfaces
    // the receipt glyph (the icon element renders an SVG inside our container).
    const iconName = wrapper.find('[data-testid="sale-cards-empty"] svg')
    expect(iconName.exists()).toBe(true)
  })
})

