// branchSalesTimeseries.utils.spec.ts — pure presentation contract for the
// daily branch sales series (ODD dashboard-operational-insights OI-5A).
//
// Mutation-sensitive: reordering or renaming a metric key, formatting the count
// as currency, collapsing the cohort-state wording of `collectedCents` /
// `outstandingDebtCents`, deriving a value instead of reading it 1:1 from one
// backend bucket, or introducing `Date`/browser-zone parsing for the exact
// `YYYY-MM-DD` labels fails these tests.

import { describe, expect, it, vi } from 'vitest'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { BranchSalesTimeseriesPoint } from '../../interfaces/branch-sales-timeseries.types'
import {
  BRANCH_SALES_TIMESERIES_METRIC_KEYS,
  BRANCH_SALES_TIMESERIES_METRICS,
  DEFAULT_BRANCH_SALES_TIMESERIES_METRIC,
  buildBranchSalesTimeseriesChartLabel,
  formatBranchSalesTimeseriesDate,
  formatBranchSalesTimeseriesValue,
  getBranchSalesTimeseriesMetric,
  readBranchSalesTimeseriesValue,
  type BranchSalesTimeseriesMetricKey,
} from '../branchSalesTimeseries.utils'

/** One backend bucket where every field carries a distinguishable value. */
const POINT: BranchSalesTimeseriesPoint = {
  date: '2025-03-01',
  grossSalesCents: 125_000,
  netSalesCents: 100_000,
  collectedCents: 80_000,
  outstandingDebtCents: 20_000,
  saleCount: 3,
  averageTicketCents: 33_333,
}

describe('branchSalesTimeseries.utils — selectable metric surface', () => {
  it('exposes exactly the six backend fields, in payload order, as selectable keys', () => {
    expect(BRANCH_SALES_TIMESERIES_METRIC_KEYS).toEqual([
      'netSalesCents',
      'grossSalesCents',
      'collectedCents',
      'outstandingDebtCents',
      'saleCount',
      'averageTicketCents',
    ])
    expect(BRANCH_SALES_TIMESERIES_METRICS.map((metric) => metric.key)).toEqual([
      ...BRANCH_SALES_TIMESERIES_METRIC_KEYS,
    ])
    expect(BRANCH_SALES_TIMESERIES_METRICS).toHaveLength(6)
  })

  it('gives every metric its own distinct visible label', () => {
    const labels = BRANCH_SALES_TIMESERIES_METRICS.map((metric) => metric.label)

    expect(labels).toEqual([
      'Ventas netas',
      'Ventas brutas',
      'Cobrado',
      'Deuda pendiente',
      'Cantidad de ventas',
      'Ticket promedio',
    ])
    expect(new Set(labels).size).toBe(6)
  })

  it('maps only `saleCount` to the count format and every other field to MXN cents', () => {
    for (const metric of BRANCH_SALES_TIMESERIES_METRICS) {
      const expected = metric.key === 'saleCount' ? 'count' : 'mxn'
      expect(getBranchSalesTimeseriesMetric(metric.key).format, metric.key).toBe(expected)
    }
  })

  it('defaults the selection to net sales', () => {
    expect(DEFAULT_BRANCH_SALES_TIMESERIES_METRIC).toBe('netSalesCents')
    expect(getBranchSalesTimeseriesMetric(DEFAULT_BRANCH_SALES_TIMESERIES_METRIC).format).toBe(
      'mxn',
    )
  })

  it('reads every metric 1:1 from one backend bucket without deriving anything', () => {
    expect(readBranchSalesTimeseriesValue(POINT, 'netSalesCents')).toBe(100_000)
    expect(readBranchSalesTimeseriesValue(POINT, 'grossSalesCents')).toBe(125_000)
    expect(readBranchSalesTimeseriesValue(POINT, 'collectedCents')).toBe(80_000)
    expect(readBranchSalesTimeseriesValue(POINT, 'outstandingDebtCents')).toBe(20_000)
    expect(readBranchSalesTimeseriesValue(POINT, 'saleCount')).toBe(3)
    expect(readBranchSalesTimeseriesValue(POINT, 'averageTicketCents')).toBe(33_333)
  })

  it('keeps the bucket identity intact while reading a single field', () => {
    const snapshot = { ...POINT }

    for (const key of BRANCH_SALES_TIMESERIES_METRIC_KEYS) {
      readBranchSalesTimeseriesValue(POINT, key)
    }

    expect(POINT).toEqual(snapshot)
  })
})

describe('branchSalesTimeseries.utils — deterministic value formatting', () => {
  const CENT_KEYS = BRANCH_SALES_TIMESERIES_METRIC_KEYS.filter(
    (key: BranchSalesTimeseriesMetricKey) => key !== 'saleCount',
  )

  it('formats every cent field with the canonical MXN formatter', () => {
    for (const key of CENT_KEYS) {
      expect(formatBranchSalesTimeseriesValue(key, 4_998), key).toBe(formatCentsMXN(4_998))
      expect(formatBranchSalesTimeseriesValue(key, 4_998), key).toBe('$49.98')
    }
  })

  it('formats the count as a grouped integer and never as currency', () => {
    expect(formatBranchSalesTimeseriesValue('saleCount', 1_234)).toBe('1,234')
    expect(formatBranchSalesTimeseriesValue('saleCount', 0)).toBe('0')
    expect(formatBranchSalesTimeseriesValue('saleCount', 1_234)).not.toContain('$')
    expect(formatBranchSalesTimeseriesValue('saleCount', 1_234)).not.toContain('.')
  })

  it('uses the metric metadata to choose the formatter', () => {
    for (const metric of BRANCH_SALES_TIMESERIES_METRICS) {
      const value = metric.format === 'count' ? 12 : 1_200
      const expected = metric.format === 'count' ? '12' : formatCentsMXN(1_200)
      expect(formatBranchSalesTimeseriesValue(metric.key, value), metric.key).toBe(expected)
    }
  })
})

describe('branchSalesTimeseries.utils — cohort-state descriptions', () => {
  it('describes collected as query-time state of the confirmed-day cohort, not that day\u2019s cash', () => {
    const description = getBranchSalesTimeseriesMetric('collectedCents').description

    expect(description).toContain('a la fecha de consulta')
    expect(description).toContain('No es el efectivo recibido ese día')
  })

  it('describes outstanding debt as query-time state of the confirmed-day cohort, not that day\u2019s originations', () => {
    const description = getBranchSalesTimeseriesMetric('outstandingDebtCents').description

    expect(description).toContain('a la fecha de consulta')
    expect(description).toContain('No es la deuda originada ese día')
  })

  it('describes every metric with non-empty copy that claims no comparison or aggregate', () => {
    for (const metric of BRANCH_SALES_TIMESERIES_METRICS) {
      expect(metric.description.trim().length, metric.key).toBeGreaterThan(20)
      expect(metric.description, metric.key).not.toMatch(/total|promedio del periodo|vs\.|variaci/i)
    }
  })
})

describe('branchSalesTimeseries.utils — timezone-neutral date formatting', () => {
  it('formats the exact YYYY-MM-DD bucket string deterministically', () => {
    expect(formatBranchSalesTimeseriesDate('2025-03-01')).toBe('01 mar 2025')
    expect(formatBranchSalesTimeseriesDate('2024-02-29')).toBe('29 feb 2024')
    expect(formatBranchSalesTimeseriesDate('2025-12-31')).toBe('31 dic 2025')
    expect(formatBranchSalesTimeseriesDate('2025-01-01')).toBe('01 ene 2025')
  })

  it('never consults the clock, so no browser zone can shift the displayed calendar day', () => {
    // A clock-based implementation would resolve a different calendar day for at
    // least one of these instants (Mexico City is UTC-6, and the second instant
    // is a UTC year boundary). The label must not move at all.
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.UTC(2025, 0, 1, 4, 0, 0))
      const atUtcOffsetInstant = formatBranchSalesTimeseriesDate('2025-06-15')
      vi.setSystemTime(Date.UTC(2025, 11, 31, 23, 30, 0))
      const atYearBoundaryInstant = formatBranchSalesTimeseriesDate('2025-06-15')

      expect(atUtcOffsetInstant).toBe('15 jun 2025')
      expect(atYearBoundaryInstant).toBe(atUtcOffsetInstant)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns a non-canonical or impossible date string verbatim instead of inventing a day', () => {
    expect(formatBranchSalesTimeseriesDate('2025-6-5')).toBe('2025-6-5')
    expect(formatBranchSalesTimeseriesDate('2025-13-01')).toBe('2025-13-01')
    expect(formatBranchSalesTimeseriesDate('2025-03-01T00:00:00Z')).toBe('2025-03-01T00:00:00Z')
    expect(formatBranchSalesTimeseriesDate('')).toBe('')
  })

  it('rejects shape-valid but impossible calendar days instead of formatting a fabricated one', () => {
    // Every string below matches the exact `YYYY-MM-DD` shape, so shape alone
    // cannot reject them: only real calendar validation can.
    expect(formatBranchSalesTimeseriesDate('2026-02-31')).toBe('2026-02-31')
    expect(formatBranchSalesTimeseriesDate('2026-04-31')).toBe('2026-04-31')
    expect(formatBranchSalesTimeseriesDate('2026-01-00')).toBe('2026-01-00')
    expect(formatBranchSalesTimeseriesDate('2025-02-29')).toBe('2025-02-29')
    expect(formatBranchSalesTimeseriesDate('2026-06-31')).toBe('2026-06-31')
    expect(formatBranchSalesTimeseriesDate('2025-00-10')).toBe('2025-00-10')
    expect(formatBranchSalesTimeseriesDate('0000-01-01')).toBe('0000-01-01')
  })

  it('still formats the real leap day of a leap year', () => {
    expect(formatBranchSalesTimeseriesDate('2024-02-29')).toBe('29 feb 2024')
  })

  it('builds the chart region label from the metric label plus the exact half-open window', () => {
    expect(buildBranchSalesTimeseriesChartLabel('collectedCents', '2025-03-01', '2025-03-16')).toBe(
      'Cobrado por día del 2025-03-01 al 2025-03-16 (Hasta excluyente)',
    )
    expect(buildBranchSalesTimeseriesChartLabel('saleCount', '2025-06-01', '2025-06-16')).toContain(
      'Cantidad de ventas',
    )
  })
})
