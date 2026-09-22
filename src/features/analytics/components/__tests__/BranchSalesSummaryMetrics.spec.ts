// BranchSalesSummaryMetrics.spec.ts — eight-metric presentation contract.
//
// Mutation-sensitive: recomputing/netted values, formatting the count as currency,
// collapsing the refund flows, hiding refund-only activity, or dropping the
// non-color debt/pending cues fails these tests.

import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { BranchSalesSummaryResponse } from '../../interfaces/branch-sales-summary.types'
import BranchSalesSummaryMetrics from '../BranchSalesSummaryMetrics.vue'

function makeSummary(over: Partial<BranchSalesSummaryResponse> = {}): BranchSalesSummaryResponse {
  return {
    timeZone: 'America/Mexico_City',
    from: '2025-03-01',
    to: '2025-04-01',
    grossSalesCents: 0,
    netSalesCents: 0,
    collectedCents: 0,
    outstandingDebtCents: 0,
    saleCount: 0,
    averageTicketCents: 0,
    settledRefundsCents: 0,
    pendingRefundObligationsCents: 0,
    ...over,
  }
}

function mountMetrics(summary: BranchSalesSummaryResponse) {
  return mount(BranchSalesSummaryMetrics, { props: { summary } })
}

const ALL_LABELS = [
  'Ventas netas',
  'Ventas brutas',
  'Cobrado',
  'Deuda pendiente',
  'Cantidad de ventas',
  'Ticket promedio',
  'Reembolsos liquidados',
  'Obligaciones de reembolso pendientes',
]

describe('BranchSalesSummaryMetrics — eight authoritative metrics', () => {
  it('renders exactly eight labelled dt/dd pairs in contract order', () => {
    const w = mountMetrics(makeSummary())

    expect(w.findAll('dt').map((term) => term.text())).toEqual(ALL_LABELS)
    expect(w.findAll('dd')).toHaveLength(8)
  })

  it('formats the seven cent fields with the canonical MXN formatter and the count as a count', () => {
    const summary = makeSummary({
      netSalesCents: 100_000,
      grossSalesCents: 123_456,
      collectedCents: 70_000,
      outstandingDebtCents: 25_500,
      saleCount: 1_234,
      averageTicketCents: 5_000,
      settledRefundsCents: 12_300,
      pendingRefundObligationsCents: 7_700,
    })
    const values = mountMetrics(summary)
      .findAll('dd')
      .map((cell) => cell.text())
    const centsCase: Array<[number, number, string]> = [
      [0, summary.netSalesCents, '$1,000.00'],
      [1, summary.grossSalesCents, '$1,234.56'],
      [2, summary.collectedCents, '$700.00'],
      [3, summary.outstandingDebtCents, '$255.00'],
      [5, summary.averageTicketCents, '$50.00'],
      [6, summary.settledRefundsCents, '$123.00'],
      [7, summary.pendingRefundObligationsCents, '$77.00'],
    ]
    for (const [index, cents, expected] of centsCase) {
      expect(values[index]).toContain(expected)
      // Byte-identical to the shared canonical formatter output.
      expect(values[index]).toContain(formatCentsMXN(cents))
    }

    // Count is a count: es-MX grouping, never a currency for saleCount.
    expect(values[4]).toBe('1,234')
    expect(values[4]).not.toContain('$')
  })

  it('renders zero saleCount as the count 0, not as currency', () => {
    const w = mountMetrics(makeSummary())
    const values = w.findAll('dd')

    expect(values[4]!.text()).toBe('0')
    expect(values[4]!.text()).not.toContain('$')
  })
})

describe('BranchSalesSummaryMetrics — separated refund flows', () => {
  it('keeps refund-only activity visible with both flows separate', () => {
    const w = mountMetrics(
      makeSummary({ settledRefundsCents: 12_300, pendingRefundObligationsCents: 7_700 }),
    )
    const sales = w.find('[data-testid="branch-summary-sales-section"]')
    const refunds = w.find('[data-testid="branch-summary-refunds-section"]')

    expect(sales.exists()).toBe(true)
    expect(refunds.findAll('dt').map((term) => term.text())).toEqual([
      'Reembolsos liquidados',
      'Obligaciones de reembolso pendientes',
    ])
    const refundValues = refunds.findAll('dd').map((cell) => cell.text())
    expect(refundValues[0]).toContain('$123.00')
    expect(refundValues[1]).toContain('$77.00')
  })

  it('never invents a combined cash-net metric or label', () => {
    const w = mountMetrics(
      makeSummary({ netSalesCents: 100_000, collectedCents: 70_000, settledRefundsCents: 12_300 }),
    )

    expect(w.findAll('dd')).toHaveLength(8)
    expect(w.text()).not.toMatch(
      /efectivo neto|neto en caja|total neto|balance neto|ventas netas de reembolsos/i,
    )
  })
})

describe('BranchSalesSummaryMetrics — non-color attention cues', () => {
  it('adds a visible icon + text cue to positive debt and pending obligations', () => {
    const w = mountMetrics(
      makeSummary({ outstandingDebtCents: 25_500, pendingRefundObligationsCents: 7_700 }),
    )

    const debt = w.find('[data-testid="branch-summary-debt-status"]')
    expect(debt.exists()).toBe(true)
    expect(debt.text()).toContain('Con deuda pendiente')
    expect(debt.find('svg[aria-hidden="true"]').exists()).toBe(true)

    const pending = w.find('[data-testid="branch-summary-pending-refund-status"]')
    expect(pending.exists()).toBe(true)
    expect(pending.text()).toContain('Reembolsos pendientes')
    expect(pending.find('svg[aria-hidden="true"]').exists()).toBe(true)
  })

  it('claims no outstanding status when debt and pending obligations are zero', () => {
    const w = mountMetrics(makeSummary({ saleCount: 3, netSalesCents: 100_000 }))

    expect(w.find('[data-testid="branch-summary-debt-status"]').exists()).toBe(false)
    expect(w.find('[data-testid="branch-summary-pending-refund-status"]').exists()).toBe(false)
    expect(w.text()).not.toMatch(/con deuda pendiente|reembolsos pendientes/i)
  })
})

describe('BranchSalesSummaryMetrics — accessibility and structure', () => {
  it('exposes labelled sales/refund sections, dl/dt/dd semantics, and tabular numerals', () => {
    const w = mountMetrics(makeSummary())

    expect(w.findAll('h2').map((heading) => heading.text())).toEqual(['Ventas', 'Reembolsos'])
    expect(w.findAll('section')).toHaveLength(2)
    expect(w.findAll('dl')).toHaveLength(2)

    for (const section of w.findAll('section')) {
      const headingId = section.find('h2').attributes('id')
      expect(headingId).toBeTruthy()
      expect(section.attributes('aria-labelledby')).toBe(headingId)
    }

    for (const cell of w.findAll('dd')) {
      expect(cell.classes()).toContain('tabular-nums')
    }
  })

  it('keeps a responsive, overflow-safe layout with wrapping long labels and values', () => {
    const w = mountMetrics(
      makeSummary({ netSalesCents: 125_000_001, pendingRefundObligationsCents: 1 }),
    )
    const root = w.find('[data-testid="branch-summary-metrics"]')
    const salesGrid = w.find('[data-testid="branch-summary-sales-section"] dl')

    expect(root.classes()).toContain('min-w-0')
    expect(salesGrid.classes()).toEqual(expect.arrayContaining(['min-w-0', 'grid-cols-1']))
    // Monetary values wrap instead of forcing horizontal page overflow.
    expect(root.html()).not.toContain('whitespace-nowrap')
    expect(root.html()).not.toMatch(/min-w-\[|w-\[/)
    const terms = w.findAll('dt')
    expect(terms[terms.length - 1]!.text()).toBe('Obligaciones de reembolso pendientes')
  })
})

describe('BranchSalesSummaryMetrics — reference-inspired dashboard hierarchy', () => {
  it('renders net sales as the dedicated dominant hero of the sales section', () => {
    const w = mountMetrics(makeSummary({ netSalesCents: 100_000, grossSalesCents: 123_456 }))
    const salesSection = w.find('[data-testid="branch-summary-sales-section"]')
    const hero = salesSection.find('[data-testid="branch-summary-net-sales-hero"]')

    expect(hero.exists()).toBe(true)
    // The hero is the first metric, so it reads as the dominant card.
    expect(salesSection.findAll('dt')[0]!.text()).toBe('Ventas netas')
    expect(hero.text()).toContain('Ventas netas')
    expect(hero.text()).toContain('$1,000.00')
    // The hero is not duplicated as a secondary grid card.
    expect(hero.find('[data-testid="branch-summary-kpi-card"]').exists()).toBe(false)
  })

  it('groups six sales KPIs and two refund KPIs into their own sections', () => {
    const w = mountMetrics(makeSummary())
    const salesSection = w.find('[data-testid="branch-summary-sales-section"]')
    const refundsSection = w.find('[data-testid="branch-summary-refunds-section"]')

    // Six sales aggregates: the net-sales hero plus five secondary KPI cards.
    expect(salesSection.findAll('dt')).toHaveLength(6)
    expect(salesSection.findAll('[data-testid="branch-summary-kpi-card"]')).toHaveLength(5)
    // Two refund aggregates, isolated from the sales flow.
    expect(refundsSection.findAll('dt')).toHaveLength(2)
    expect(refundsSection.findAll('[data-testid="branch-summary-refund-card"]')).toHaveLength(2)
  })

  it('gives every KPI card a restrained decorative icon, never color alone', () => {
    const w = mountMetrics(makeSummary())
    const cards = w.findAll(
      '[data-testid="branch-summary-kpi-card"], [data-testid="branch-summary-refund-card"]',
    )

    expect(cards).toHaveLength(7)
    for (const card of cards) {
      expect(card.find('svg[aria-hidden="true"]').exists()).toBe(true)
    }
  })

  it('invents no trend, comparison, target, delta or progress visualization', () => {
    const w = mountMetrics(
      makeSummary({
        netSalesCents: 100_000,
        grossSalesCents: 123_456,
        settledRefundsCents: 12_300,
      }),
    )
    const root = w.find('[data-testid="branch-summary-metrics"]')

    expect(root.text()).not.toMatch(
      /%|\bvs\b|anterior|tendencia|proyecci|comparaci|delta|crecimiento|meta de|promedio diario/i,
    )
    expect(root.find('canvas').exists()).toBe(false)
    expect(root.find('[role="progressbar"]').exists()).toBe(false)
    expect(root.find('[data-testid*="trend"]').exists()).toBe(false)
    expect(root.find('[data-testid*="comparison"]').exists()).toBe(false)
    expect(root.find('[data-testid*="delta"]').exists()).toBe(false)
    expect(root.find('[data-testid*="sparkline"]').exists()).toBe(false)
  })
})

describe('BranchSalesSummaryMetrics — valid description-list content model', () => {
  it('keeps dt/dd as the only direct children of every dl grouping', () => {
    const w = mountMetrics(
      makeSummary({ outstandingDebtCents: 25_500, pendingRefundObligationsCents: 7_700 }),
    )
    const lists = w.findAll('dl')

    expect(lists).toHaveLength(2)
    for (const dl of lists) {
      const directTags = Array.from(dl.element.children).map((node) => node.tagName.toLowerCase())
      // A dl may only contain bare dt/dd pairs or <div> groupings.
      expect(directTags.every((tag) => tag === 'dt' || tag === 'dd' || tag === 'div')).toBe(true)

      const groups = Array.from(dl.element.children).filter(
        (node) => node.tagName.toLowerCase() === 'div',
      )
      expect(groups.length).toBeGreaterThan(0)
      for (const group of groups) {
        const groupTags = Array.from(group.children).map((node) => node.tagName.toLowerCase())
        // A grouping <div> may contain nothing but its own dt/dd, terms first.
        expect(groupTags.length).toBeGreaterThan(0)
        expect(groupTags.every((tag) => tag === 'dt' || tag === 'dd')).toBe(true)
        expect(groupTags).toContain('dt')
        expect(groupTags).toContain('dd')
        expect(groupTags.indexOf('dt')).toBeLessThan(groupTags.indexOf('dd'))
      }
    }
  })

  it('nests each decorative icon inside its dt term, never beside it', () => {
    const w = mountMetrics(makeSummary({ outstandingDebtCents: 1 }))
    const groups = w.findAll('dl > div')

    expect(groups).toHaveLength(8)
    for (const group of groups) {
      const term = group.find('dt')
      expect(term.exists()).toBe(true)
      // The icon well lives inside the term, so the grouping div's direct
      // children stay limited to dt/dd.
      expect(term.find('svg[aria-hidden="true"]').exists()).toBe(true)
    }
  })
})
