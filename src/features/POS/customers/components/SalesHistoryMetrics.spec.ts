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
  mount(SalesHistoryMetrics, { props: { summary }, global: { stubs } })

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

  it('positive debt renders alert badge and aria-live debt cell', () => {
    const w = mountMetrics(makeSummary({ salesCount: 1, outstandingDebtCents: 1 }))
    const badge = w.find('[data-testid="badge"]')
    expect(badge.attributes('data-label')).toContain('Con saldo pendiente')
    expect(badge.attributes('data-tone')).toBe('error')
    expect(w.find('[aria-live="polite"]').exists()).toBe(true)
  })

  it('zero debt with sales renders Al corriente and no aria-live', () => {
    const w = mountMetrics(makeSummary({ salesCount: 3, outstandingDebtCents: 0 }))
    const badge = w.find('[data-testid="badge"]')
    expect(badge.attributes('data-label')).toContain('Al corriente')
    expect(badge.attributes('data-tone')).toBe('success')
    expect(w.find('[aria-live="polite"]').exists()).toBe(false)
  })

  it('zero sales and zero debt renders no debt badge', () => {
    const w = mountMetrics(makeSummary())
    expect(w.find('[data-testid="badge"]').exists()).toBe(false)
    expect(w.find('[aria-live="polite"]').exists()).toBe(false)
  })

  it('formats integer-cent currency values exactly', () => {
    const w = mountMetrics({ salesCount: 1, totalSoldCents: 1_250_000_01, outstandingDebtCents: 1 })
    expect(w.text()).toContain('$1,250,000.01')
    expect(w.text()).toContain('$0.01')
  })

  it('uses grid-cols-2 and places exactly three cells with third spanning full width', () => {
    const w = mountMetrics({ salesCount: 5, totalSoldCents: 99_000, outstandingDebtCents: 0 })
    const dl = w.find('dl')
    expect(dl.classes()).toContain('grid-cols-2')
    expect(dl.classes()).not.toContain('grid-cols-3')
    const cells = dl.findAll(':scope > div')
    expect(cells).toHaveLength(3)
    expect(cells[2]!.classes()).toContain('col-span-2')
  })

  it('uses width-safe compact mobile metric cards while restoring desktop sizing', () => {
    const w = mountMetrics({ salesCount: 3, totalSoldCents: 50_000, outstandingDebtCents: 0 })
    const dl = w.find('dl')
    const cells = dl.findAll(':scope > div')

    expect(dl.classes()).toEqual(expect.arrayContaining(['min-w-0', 'p-3', 'lg:p-4']))
    expect(cells).toHaveLength(3)
    for (const cell of cells) {
      expect(cell.classes()).toEqual(expect.arrayContaining([
        'grid', 'min-w-0', 'grid-cols-[2rem_minmax(0,1fr)]',
        'gap-x-2', 'lg:grid-cols-[2.25rem_minmax(0,1fr)]', 'lg:gap-x-3',
        'rounded-xl', 'border', 'p-3',
      ]))
      expect(cell.classes()).not.toContain('overflow-hidden')
    }
    expect(cells[2]!.classes()).toContain('col-span-2')

    expect(w.findAll('.size-8.lg\\:size-9')).toHaveLength(3)
    for (const label of w.findAll('dt')) {
      expect(label.classes()).toEqual(expect.arrayContaining(['text-[11px]', 'leading-tight', 'lg:text-xs']))
    }
    for (const valueCell of w.findAll('dd')) {
      expect(valueCell.classes()).toEqual(expect.arrayContaining([
        'col-span-2', 'lg:col-span-1', 'lg:col-start-2',
      ]))
      expect(valueCell.classes()).not.toContain('truncate')
    }
    expect(w.findAll('.text-lg.leading-tight.lg\\:text-xl.tabular-nums.whitespace-nowrap')).toHaveLength(3)
  })
})
