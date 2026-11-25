import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SaleListSummary } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'

// Sales history backend data T1 (S3, handoff 28 §2.2): «Ticket promedio» from the customer-wide
// `summary.averageTicketCents`; absent on older payloads, then hidden.
const summary = (over: Partial<SaleListSummary> = {}): SaleListSummary => ({
  salesCount: 14,
  totalSoldCents: 1_834_500,
  outstandingDebtCents: 98_000,
  ...over,
})
const mountMetrics = (value: SaleListSummary) =>
  mount(SalesHistoryMetrics, { props: { summary: value }, global: { stubs: { UIcon: true } } })

describe('SalesHistoryMetrics — Ticket promedio', () => {
  it('adds «Ticket promedio» as the fourth cell, a 2×2 grid on phones and four columns from sm', () => {
    const w = mountMetrics(summary({ averageTicketCents: 131_036 }))
    expect(w.findAll('dt').map((d) => d.text())).toEqual([
      'Ventas confirmadas',
      'Total vendido',
      'Saldo pendiente',
      'Ticket promedio',
    ])
    const cell = w.get('[data-testid="metric-average-ticket"]')
    expect(cell.get('dd').text()).toContain('$1,310.36')
    expect(w.text()).not.toContain('requiere backend')
    const dl = w.get('dl')
    expect(dl.classes()).toEqual(expect.arrayContaining(['grid-cols-2', 'sm:grid-cols-4']))
    expect(dl.classes()).not.toContain('sm:grid-cols-3')
    const cells = dl.findAll(':scope > div')
    expect(cells).toHaveLength(4)
    expect(cells[2]!.classes()).not.toContain('col-span-2')
  })

  it('shows $0.00 for a customer without sales (backend sends 0)', () => {
    const w = mountMetrics(
      summary({ salesCount: 0, totalSoldCents: 0, outstandingDebtCents: 0, averageTicketCents: 0 }),
    )
    expect(w.get('[data-testid="metric-average-ticket"]').text()).toContain('$0.00')
  })

  it('is hidden when the summary lacks it, keeping the three-cell strip', () => {
    const w = mountMetrics(summary())
    expect(w.find('[data-testid="metric-average-ticket"]').exists()).toBe(false)
    expect(w.get('dl').classes()).toContain('sm:grid-cols-3')
  })
})
