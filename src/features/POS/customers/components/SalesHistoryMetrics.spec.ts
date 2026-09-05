import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SaleListSummary } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'

const stubs = {
  AppBadge: { props: ['label', 'tone'], template: '<span data-testid="badge" :data-label="label" :data-tone="tone" />' },
  UIcon: { template: '<span data-testid="icon" />' },
}
const makeSummary = (over: Partial<SaleListSummary> = {}): SaleListSummary => ({
  salesCount: 0,
  totalSoldCents: 0,
  outstandingDebtCents: 0,
  ...over,
})
const mountMetrics = (summary: SaleListSummary) =>
  mount(SalesHistoryMetrics, { props: { summary }, global: { components: stubs } })

describe('SalesHistoryMetrics', () => {
  it('renders one accessible <dl> with the authoritative summary values', () => {
    const w = mountMetrics({ salesCount: 12, totalSoldCents: 125_000, outstandingDebtCents: 30_000 })
    expect(w.find('dl').exists()).toBe(true)
    expect(w.findAll('dt').map(d => d.text())).toEqual(['Ventas confirmadas', 'Total vendido', 'Saldo pendiente'])
    const dds = w.findAll('dd').map(d => d.text())
    expect(dds[0]).toContain('12')
    expect(dds[1]).toContain('$1,250.00')
    expect(dds[2]).toContain('$300.00')
  })

  it('renders the debt value exactly as summary.outstandingDebtCents', () => {
    const w = mountMetrics({ salesCount: 5, totalSoldCents: 180_000, outstandingDebtCents: 50_000 })
    expect(w.text()).toContain('$1,800.00')
    expect(w.text()).toContain('$500.00')
  })
})
