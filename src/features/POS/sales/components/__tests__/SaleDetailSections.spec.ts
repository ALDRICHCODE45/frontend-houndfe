import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { SaleDetail, SaleDetailRefund } from '../../interfaces/sale.types'

// T6c (S2–S3): every sale detail section is the shared HfSectionCard (one
// bordered surface, 16px/600 heading, 24px padding), never a native UCard with
// a divided header. Presentation only: props, emits and test ids stay.

vi.mock('@/features/POS/products/api/product.api', () => ({
  productApi: { getGlobalPriceLists: vi.fn().mockResolvedValue([]) },
}))

import SaleDetailItemsList from '../SaleDetailItemsList.vue'
import SaleDetailTotalsCard from '../SaleDetailTotalsCard.vue'
import SaleDetailSalesDataCard from '../SaleDetailSalesDataCard.vue'
import SaleDetailHistoryCard from '../SaleDetailHistoryCard.vue'
import SaleDetailCancellationCard from '../SaleDetailCancellationCard.vue'
import SaleDetailRefundsCard from '../SaleDetailRefundsCard.vue'

const sale = {
  id: 'sale-1',
  folio: 'A-1',
  status: 'CANCELED',
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  canceledAt: '2026-05-07T10:00:00.000Z',
  cancelReason: 'CUSTOMER_REQUEST',
  canceledBy: { id: 'u1', name: 'Ana' },
  dueDate: null,
  subtotalCents: 1000,
  discountCents: 0,
  totalCents: 1000,
  paidCents: 1000,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  customer: null,
  cashier: { id: 'u1', name: 'Cajero' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
  globalPriceListId: null,
} as unknown as SaleDetail

const refund = {
  id: 'r-1',
  method: 'cash',
  amountCents: 1000,
  settledCents: 0,
  outstandingCents: 1000,
} as unknown as SaleDetailRefund

const cases = [
  {
    name: 'SaleDetailItemsList',
    file: 'SaleDetailItemsList',
    title: 'Productos',
    mount: () =>
      mountWithUApp(SaleDetailItemsList, {
        props: {
          items: [
            { productName: 'Jean', imageUrl: null, unitPriceCents: 100, quantity: 1, discountCents: 0, subtotalCents: 100 },
          ],
        },
      }),
  },
  {
    name: 'SaleDetailTotalsCard',
    file: 'SaleDetailTotalsCard',
    title: 'Totales',
    mount: () =>
      mountWithUApp(SaleDetailTotalsCard, {
        props: { subtotalCents: 1000, discountCents: 0, totalCents: 1000, paidCents: 1000, debtCents: 0, changeDueCents: 0 },
      }),
  },
  {
    name: 'SaleDetailSalesDataCard',
    file: 'SaleDetailSalesDataCard',
    title: 'Datos de la venta',
    mount: () => mountWithUApp(SaleDetailSalesDataCard, { props: { sale } }),
  },
  {
    name: 'SaleDetailHistoryCard',
    file: 'SaleDetailHistoryCard',
    title: 'Historial',
    mount: () =>
      mountWithUApp(SaleDetailHistoryCard, {
        props: { timeline: [], onSubmitComment: vi.fn().mockResolvedValue(undefined) },
      }),
  },
  {
    name: 'SaleDetailCancellationCard',
    file: 'SaleDetailCancellationCard',
    title: 'Cancelación',
    mount: () => mountWithUApp(SaleDetailCancellationCard, { props: { sale } }),
  },
  {
    name: 'SaleDetailRefundsCard',
    file: 'SaleDetailRefundsCard',
    title: 'Reembolsos',
    mount: () => mountWithUApp(SaleDetailRefundsCard, { props: { refunds: [refund], canSettle: true } }),
  },
]

describe('Sale detail sections use the shared section card', () => {
  it.each(cases)('$name has no native UCard in its source', ({ file }) => {
    const source = readFileSync(`src/features/POS/sales/components/${file}.vue`, 'utf8')
    expect(source).not.toMatch(/<UCard\b/)
    expect(source).toContain('HfSectionCard')
  })

  it.each(cases)('$name renders one labelled section card titled «$title»', ({ mount, title }) => {
    const wrapper = mount()
    const sections = wrapper.findAll('section.hf-section-card')
    expect(sections).toHaveLength(1)
    const heading = sections[0]!.get('.hf-section-card__title')
    expect(heading.text()).toBe(title)
    expect(sections[0]!.attributes('aria-labelledby')).toBe(heading.attributes('id'))
    // No native card chrome (root/header slots) survives inside.
    expect(wrapper.find('[data-slot="header"]').exists()).toBe(false)
    expect(wrapper.find('[data-slot="root"]:has(> [data-slot="body"])').exists()).toBe(false)
  })

  it('keeps the root test ids on the section cards', () => {
    const data = mountWithUApp(SaleDetailSalesDataCard, { props: { sale } })
    expect(data.get('[data-testid="sidebar-data-reflow"]').element.tagName).toBe('SECTION')
    const cancel = mountWithUApp(SaleDetailCancellationCard, { props: { sale } })
    expect(cancel.get('[data-testid="sale-detail-cancellation"]').element.tagName).toBe('SECTION')
    const refunds = mountWithUApp(SaleDetailRefundsCard, { props: { refunds: [refund], canSettle: true } })
    expect(refunds.get('[data-testid="sale-detail-refunds"]').element.tagName).toBe('SECTION')
  })

  it('puts the item count in the section meta, not in a second header', () => {
    const wrapper = cases[0]!.mount()
    expect(wrapper.get('.hf-section-card__meta [data-testid="items-count"]').text()).toBe('1 artículo')
  })

  it('reads totals as a key/value list on --hf-* tokens only', () => {
    const source = readFileSync('src/features/POS/sales/components/SaleDetailTotalsCard.vue', 'utf8')
    expect(source).toContain('<dl')
    expect(source).not.toMatch(/\btext-(?:muted|default|highlighted)\b/)
    const items = readFileSync('src/features/POS/sales/components/SaleDetailItemsList.vue', 'utf8')
    expect(items).not.toMatch(/\btext-(?:muted|default|highlighted)\b/)
  })
})
