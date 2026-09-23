/**
 * branchSalesSummary.utils.ts — pure presentation helpers for the analytics
 * sales-summary payload.
 *
 * Locked contract (ODD branch-sales-summary A2):
 *   - The eight numeric metrics are authoritative backend integers; the
 *     frontend never derives, re-sums or nets them.
 *   - A summary is empty ONLY when every one of the eight metrics is zero.
 *     Refund-only activity (for example a settled refund with no sales) is
 *     therefore non-empty, which is why a `saleCount === 0` check is not enough.
 */

import type { BranchSalesSummaryResponse } from '../interfaces/branch-sales-summary.types'

/** The eight numeric metrics, in payload order. */
export const BRANCH_SALES_SUMMARY_METRIC_KEYS = [
  'grossSalesCents',
  'netSalesCents',
  'collectedCents',
  'outstandingDebtCents',
  'saleCount',
  'averageTicketCents',
  'settledRefundsCents',
  'pendingRefundObligationsCents',
] as const

export type BranchSalesSummaryMetricKey = (typeof BRANCH_SALES_SUMMARY_METRIC_KEYS)[number]

/** The numeric subset of the payload every emptiness decision depends on. */
export type BranchSalesSummaryMetrics = Pick<
  BranchSalesSummaryResponse,
  BranchSalesSummaryMetricKey
>

/**
 * True only when every one of the eight numeric metrics is exactly zero.
 *
 * A missing payload (null/undefined) is reported as NOT empty: absence of data
 * is an unknown/loading state, never proof of zero activity.
 */
export function isBranchSalesSummaryEmpty(
  summary: BranchSalesSummaryMetrics | null | undefined,
): boolean {
  if (!summary) return false

  return BRANCH_SALES_SUMMARY_METRIC_KEYS.every((key) => summary[key] === 0)
}
