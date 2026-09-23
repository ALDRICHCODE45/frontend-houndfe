/**
 * branchSalesTimeseries.utils.ts — pure presentation helpers for the daily
 * branch sales series (ODD dashboard-operational-insights OI-5A).
 *
 * Locked contract:
 *   - The six metric fields the backend already returns are the COMPLETE
 *     selectable surface. One metric is shown at a time and addressed 1:1 by
 *     key, so nothing is summed, netted, averaged, compared, ranked, filled or
 *     derived: a value is read exactly as the backend supplied it for one
 *     bucket.
 *   - Cents format through the canonical shared `formatCentsMXN`; `saleCount`
 *     is a grouped integer and is never rendered as a currency amount.
 *   - `collectedCents` and `outstandingDebtCents` describe the CURRENT
 *     (query-time) state of the sales confirmed on that bucket's local date,
 *     not the cash moved or the debt originated that day. The copy below keeps
 *     that distinction explicit in the UI.
 *   - Bucket dates stay exact `YYYY-MM-DD` strings. Labels are built from the
 *     string itself through a fixed month table, never through `Date` or
 *     `Intl`, so no browser time zone can shift the displayed calendar day.
 */

import { CURRENCY_CONFIG, formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { isValidCalendarDateString } from '@/core/shared/utils/mexicoCityCalendar'
import type { BranchSalesTimeseriesPoint } from '../interfaces/branch-sales-timeseries.types'

/**
 * The six selectable backend fields, in display order. This array is the single
 * source of truth for the selector, the table and the type below.
 */
export const BRANCH_SALES_TIMESERIES_METRIC_KEYS = [
  'netSalesCents',
  'grossSalesCents',
  'collectedCents',
  'outstandingDebtCents',
  'saleCount',
  'averageTicketCents',
] as const

/** A selectable metric: exactly one of the six backend point fields. */
export type BranchSalesTimeseriesMetricKey = (typeof BRANCH_SALES_TIMESERIES_METRIC_KEYS)[number]

/** How a metric value is rendered: cents as MXN, or a grouped integer count. */
export type BranchSalesTimeseriesMetricFormat = 'mxn' | 'count'

/** Typed metadata for one selectable metric. */
export interface BranchSalesTimeseriesMetric {
  /** The backend point field this metric reads 1:1. */
  key: BranchSalesTimeseriesMetricKey
  /** Visible label, shared by the selector and the table header. */
  label: string
  /** Concise description of what the value IS. Claims no aggregate or trend. */
  description: string
  /** Presentation format; never a business classification. */
  format: BranchSalesTimeseriesMetricFormat
}

/**
 * The six metrics in display order. Descriptions are deliberately descriptive
 * only: no total, delta, minimum, maximum, average, ratio, forecast or trend
 * direction is stated or implied.
 */
export const BRANCH_SALES_TIMESERIES_METRICS: readonly BranchSalesTimeseriesMetric[] = [
  {
    key: 'netSalesCents',
    label: 'Ventas netas',
    description: 'Ventas netas confirmadas en cada día del periodo.',
    format: 'mxn',
  },
  {
    key: 'grossSalesCents',
    label: 'Ventas brutas',
    description: 'Ventas brutas confirmadas en cada día del periodo.',
    format: 'mxn',
  },
  {
    key: 'collectedCents',
    label: 'Cobrado',
    description:
      'Estado cobrado a la fecha de consulta de las ventas confirmadas ese día. No es el efectivo recibido ese día.',
    format: 'mxn',
  },
  {
    key: 'outstandingDebtCents',
    label: 'Deuda pendiente',
    description:
      'Estado de deuda pendiente a la fecha de consulta de las ventas confirmadas ese día. No es la deuda originada ese día.',
    format: 'mxn',
  },
  {
    key: 'saleCount',
    label: 'Cantidad de ventas',
    description: 'Número de ventas confirmadas en cada día del periodo.',
    format: 'count',
  },
  {
    key: 'averageTicketCents',
    label: 'Ticket promedio',
    description:
      'Ticket promedio calculado por el backend para las ventas confirmadas en cada día del periodo.',
    format: 'mxn',
  },
]

/** The metric shown before the visitor selects another one. */
export const DEFAULT_BRANCH_SALES_TIMESERIES_METRIC: BranchSalesTimeseriesMetricKey =
  'netSalesCents'

const METRICS_BY_KEY: Readonly<
  Record<BranchSalesTimeseriesMetricKey, BranchSalesTimeseriesMetric>
> = Object.fromEntries(
  BRANCH_SALES_TIMESERIES_METRICS.map((metric) => [metric.key, metric]),
) as Record<BranchSalesTimeseriesMetricKey, BranchSalesTimeseriesMetric>

/** Metadata for one selectable metric. */
export function getBranchSalesTimeseriesMetric(
  key: BranchSalesTimeseriesMetricKey,
): BranchSalesTimeseriesMetric {
  return METRICS_BY_KEY[key]
}

/** Read one metric from one backend bucket, 1:1 and in place. */
export function readBranchSalesTimeseriesValue(
  point: BranchSalesTimeseriesPoint,
  key: BranchSalesTimeseriesMetricKey,
): number {
  return point[key]
}

/** Counts are counts: locale grouping only, never a currency presentation. */
const countFormatter = new Intl.NumberFormat(CURRENCY_CONFIG.locale, { maximumFractionDigits: 0 })

/**
 * Format one exact backend value for its metric. Cents go through the canonical
 * MXN formatter; the count is grouped as an integer.
 */
export function formatBranchSalesTimeseriesValue(
  key: BranchSalesTimeseriesMetricKey,
  value: number,
): string {
  return getBranchSalesTimeseriesMetric(key).format === 'count'
    ? countFormatter.format(value)
    : formatCentsMXN(value)
}

/** Fixed Spanish month abbreviations, indexed 0-11. No `Intl`, no locale data. */
const MONTH_LABELS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/** Exact canonical `YYYY-MM-DD` shape, used only to split an already-valid date. */
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Label one exact `YYYY-MM-DD` bucket string as `DD mmm YYYY`.
 *
 * The label is derived from the string characters only: no `Date` is constructed
 * and no zone is consulted (validation uses the canonical zone-free calendar
 * helpers), so the rendered day is the exact backend calendar day regardless of
 * the browser or the runner time zone.
 *
 * The string must be a REAL calendar day, not merely shape-valid: `2026-02-31`
 * and `2026-01-00` match `\d{4}-\d{2}-\d{2}` but are not days, and a malformed
 * value is returned verbatim rather than being "formatted" into a fabricated
 * day. `2024-02-29` is a real leap day and is labelled normally.
 */
export function formatBranchSalesTimeseriesDate(date: string): string {
  if (!isValidCalendarDateString(date)) return date

  const match = CALENDAR_DATE_PATTERN.exec(date)
  if (!match) return date

  const [, year, month, day] = match
  const monthLabel = MONTH_LABELS[Number(month) - 1]
  if (!monthLabel) return date

  return `${day} ${monthLabel} ${year}`
}

/**
 * Accessible label for the chart region: the selected metric plus the exact
 * half-open window, both as the exact backend strings. Values are deliberately
 * absent — they stay reachable through the semantic table.
 */
export function buildBranchSalesTimeseriesChartLabel(
  key: BranchSalesTimeseriesMetricKey,
  from: string,
  to: string,
): string {
  return `${getBranchSalesTimeseriesMetric(key).label} por día del ${from} al ${to} (Hasta excluyente)`
}
