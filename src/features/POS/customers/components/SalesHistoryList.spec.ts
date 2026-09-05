import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryList from './SalesHistoryList.vue'

const stubs = {
  StatusDotBadge: { props: ['label', 'tone'], template: '<span data-testid="status-badge" :data-label="label" :data-tone="tone" />' },
  UIcon: { template: '<span data-testid="icon" />' },
}
const makeSale = (over: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow => ({
  id: 'sale-1',
  folio: 'A-202608-000042',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  totalCents: 180_000,
  debtCents: 0,
  confirmedAt: '2026-08-30T14:00:00.000Z',
  dueDate: null,
  customer: null,
  cashier: { id: 'u1', name: 'Caja 1' },
  seller: null,
  paymentMethods: [],
  ...over,
})
const mountList = (sales: ConfirmedSaleRow[]) =>
  mount(SalesHistoryList, { props: { sales }, global: { components: stubs } })

describe('SalesHistoryList', () => {
  it('renders one semantic native button per sale inside a <ul>', () => {
    const w = mountList([makeSale({ id: 'a' }), makeSale({ id: 'b' })])
    expect(w.find('ul').exists()).toBe(true)
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.findAll('button[type="button"]')).toHaveLength(2)
  })

  it('displays formatCentsMXN values and explicit null fallbacks', () => {
    const w = mountList([
      makeSale({ id: 'a', folio: null, confirmedAt: null, paymentStatus: null }),
      makeSale({ id: 'b', totalCents: 180_000, debtCents: 45_000 }),
    ])
    expect(w.text()).toContain('Sin folio')
    expect(w.text()).toContain('Fecha no disponible')
    expect(w.find('[data-testid="status-badge"]').attributes('data-label')).toContain('Sin estado')
    expect(w.text()).toContain('$1,800.00')
    expect(w.text()).toContain('$450.00')
  })

  it('emits typed select with the original DTO exactly once per activation', () => {
    const sale = makeSale({ id: 'sale-x' })
    const w = mountList([sale])
    w.find('button').trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
    expect(w.emitted('select')![0]).toEqual([sale])
  })
})
