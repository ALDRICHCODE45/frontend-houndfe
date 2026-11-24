import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SaleListSummary, SalesListCounts } from '@/features/POS/sales/interfaces/sale.types'
import SalesHistoryMetrics from './SalesHistoryMetrics.vue'

// Sales history redesign T1: one metric strip from the customer-wide `summary` and `counts`.
// «Ticket promedio» requires backend (S4) and is not rendered.
const makeSummary = (over: Partial<SaleListSummary> = {}): SaleListSummary => ({
  salesCount: 0,
  totalSoldCents: 0,
  outstandingDebtCents: 0,
  ...over,
})
const makeCounts = (over: Partial<SalesListCounts> = {}): SalesListCounts => ({
  all: 0,
  pendingPayments: 0,
  notDelivered: 0,
  ...over,
})
const mountMetrics = (summary: SaleListSummary, counts?: SalesListCounts) =>
  mount(SalesHistoryMetrics, { props: { summary, counts }, global: { stubs: { UIcon: true } } })

describe('SalesHistoryMetrics', () => {
  it('renders one accessible <dl> strip with the authoritative summary values', () => {
    const w = mountMetrics({ salesCount: 12, totalSoldCents: 125_000, outstandingDebtCents: 30_000 })
    expect(w.get('dl').attributes('aria-label')).toBe('Resumen del cliente')
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['Ventas confirmadas', 'Total vendido', 'Saldo pendiente'])
    const dds = w.findAll('dd').map((d) => d.text())
    expect(dds[0]).toContain('12')
    expect(dds[1]).toContain('$1,250.00')
    expect(dds[2]).toContain('$300.00')
    expect(w.text()).not.toContain('Ticket promedio')
    expect(w.text()).not.toContain('requiere backend')
  })

  it('adds the counts: sales not delivered and sales to collect', () => {
    const w = mountMetrics(
      makeSummary({ salesCount: 23, totalSoldCents: 1_846_050, outstandingDebtCents: 128_400 }),
      makeCounts({ all: 23, pendingPayments: 2, notDelivered: 1 }),
    )
    const dds = w.findAll('dd')
    expect(dds[0]!.text()).toContain('1 sin entregar')
    expect(dds[2]!.text()).toContain('2 ventas por cobrar')
  })

  it('uses the singular for one sale to collect and hides zero counts', () => {
    const w = mountMetrics(
      makeSummary({ salesCount: 3, outstandingDebtCents: 100 }),
      makeCounts({ pendingPayments: 1, notDelivered: 0 }),
    )
    expect(w.text()).toContain('1 venta por cobrar')
    expect(w.text()).not.toContain('sin entregar')
  })

  it('highlights a positive balance in the warning tone and announces it', () => {
    const w = mountMetrics(makeSummary({ salesCount: 1, outstandingDebtCents: 1 }))
    const cell = w.get('[data-testid="metric-debt"]')
    expect(cell.classes()).toContain('bg-[var(--hf-warning-soft)]')
    expect(cell.get('dd').attributes('aria-live')).toBe('polite')
    expect(cell.get('dd').classes()).toContain('text-[var(--hf-warning)]')
  })

  it('zero debt with sales reads «Al corriente»; zero sales reads nothing extra', () => {
    expect(mountMetrics(makeSummary({ salesCount: 3 })).text()).toContain('Al corriente')
    const empty = mountMetrics(makeSummary())
    expect(empty.text()).not.toContain('Al corriente')
    expect(empty.find('[aria-live="polite"]').exists()).toBe(false)
  })

  it('formats integer-cent currency values exactly', () => {
    const w = mountMetrics({ salesCount: 1, totalSoldCents: 1_250_000_01, outstandingDebtCents: 1 })
    expect(w.text()).toContain('$1,250,000.01')
    expect(w.text()).toContain('$0.01')
  })

  it('is a two-column strip on phones (balance full width) and three columns from sm', () => {
    const w = mountMetrics(makeSummary({ salesCount: 5 }))
    const dl = w.get('dl')
    expect(dl.classes()).toEqual(expect.arrayContaining(['grid-cols-2', 'sm:grid-cols-3', 'min-w-0', 'rounded-xl', 'border']))
    const cells = dl.findAll(':scope > div')
    expect(cells).toHaveLength(3)
    expect(cells[2]!.classes()).toEqual(expect.arrayContaining(['col-span-2', 'sm:col-span-1']))
    for (const value of w.findAll('dd > span:first-child')) {
      expect(value.classes()).toEqual(expect.arrayContaining(['hf-figure', 'whitespace-nowrap']))
    }
  })
})
