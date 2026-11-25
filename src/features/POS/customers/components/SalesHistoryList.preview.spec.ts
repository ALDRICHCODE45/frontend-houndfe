import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ConfirmedSaleRow } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryList from './SalesHistoryList.vue'

// Sales history backend data T1 (S2, handoff 28 §2.1): the products of each sale under the folio
// and date, without opening it, from `itemsPreview` (≤ 3 lines) and `itemsCount` (lines).
const stubs = {
  StatusBadge: { props: ['label', 'tone'], template: '<span>{{ label }}</span>' },
  UIcon: { template: '<span />' },
  SaleHistoryRowDetail: { props: ['saleId', 'allowCharge'], template: '<div />' },
}

const PREVIEW = [
  { productName: 'Croquetas Adulto 15 kg', variantName: null, quantity: 2 },
  { productName: 'Collar ajustable', variantName: 'Chico · Azul', quantity: 1 },
  { productName: 'Desparasitante Canino 10 ml', variantName: null, quantity: 3 },
]
const EXPECTED =
  '2 × Croquetas Adulto 15 kg · Collar ajustable (Chico · Azul) · 3 × Desparasitante Canino 10 ml +2 más'

const makeSale = (over: Partial<ConfirmedSaleRow> = {}): ConfirmedSaleRow => ({
  id: 'sale-1',
  folio: 'V-000123',
  status: 'CONFIRMED',
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  totalCents: 125_000,
  debtCents: 0,
  confirmedAt: '2026-11-10T17:02:11.000Z',
  dueDate: null,
  customer: null,
  cashier: { id: 'u1', name: 'Caja 1' },
  seller: null,
  paymentMethods: [],
  channel: 'POS',
  ...over,
})

const mountList = (sales: ConfirmedSaleRow[], layout: 'table' | 'cards' = 'table') =>
  mount(SalesHistoryList, { props: { sales, layout }, global: { stubs } })

const text = (value: string) => value.replace(/\s+/g, ' ').trim()

describe('SalesHistoryList — items preview', () => {
  it('table: shows the preview under the folio and date, one truncated line, with «+N más»', () => {
    const w = mountList([makeSale({ itemsPreview: PREVIEW, itemsCount: 5 })])
    const preview = w.get('[data-testid="sale-history-items"]')
    expect(text(preview.text())).toBe(EXPECTED)
    expect(preview.classes()).toEqual(expect.arrayContaining(['truncate']))
    expect(preview.attributes('title')).toBe(EXPECTED)
    const venta = w.findAll('tbody tr')[0]!.findAll('td')[1]!
    expect(venta.element.contains(preview.element)).toBe(true)
  })

  it('cards: shows the same preview under the date', () => {
    const w = mountList([makeSale({ itemsPreview: PREVIEW, itemsCount: 5 })], 'cards')
    const card = w.get('[data-testid="sale-history-card"]')
    expect(text(card.get('[data-testid="sale-history-items"]').text())).toBe(EXPECTED)
  })

  it('no «más» when every line is in the preview; quantity 1 has no «1 ×»', () => {
    const w = mountList([makeSale({ itemsPreview: PREVIEW.slice(0, 2), itemsCount: 2 })])
    expect(text(w.get('[data-testid="sale-history-items"]').text())).toBe(
      '2 × Croquetas Adulto 15 kg · Collar ajustable (Chico · Azul)',
    )
  })

  it('«+1 más» for one hidden line', () => {
    const w = mountList([makeSale({ itemsPreview: PREVIEW, itemsCount: 4 })])
    expect(w.get('[data-testid="sale-history-items"]').text()).toContain('+1 más')
  })

  it('no preview when the row lacks the fields (older payloads) or the sale has no lines', () => {
    const w = mountList([
      makeSale({ id: 'a' }),
      makeSale({ id: 'b', itemsPreview: [], itemsCount: 0 }),
    ])
    expect(w.find('[data-testid="sale-history-items"]').exists()).toBe(false)
  })
})
