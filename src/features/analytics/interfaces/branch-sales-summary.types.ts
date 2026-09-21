/**
 * branch-sales-summary.types.ts — wire + query contracts for the backend-owned
 * `GET /analytics/sales/summary` endpoint.
 *
 * Locked contract (ODD branch-sales-summary A1):
 *   - Tenant/branch identity comes from the JWT. The request carries ONLY the
 *     two calendar boundaries — never tenantId, branchId, currency or timestamps.
 *   - `from` is INCLUSIVE and `to` is EXCLUSIVE, both plain `YYYY-MM-DD`
 *     calendar strings in `America/Mexico_City`. They stay strings end-to-end;
 *     no `Date` parsing happens at this boundary (parsing shifts calendar days
 *     through UTC/browser zones).
 *   - Every metric is an integer the BACKEND owns: integer cents for monetary
 *     values and an integer count for `saleCount`. The frontend MUST NOT derive,
 *     round, re-sum or otherwise recompute them, and MUST NOT combine the sales
 *     lines into an invented cash net.
 *   - Sales and refund flows carry intentionally distinct accounting semantics,
 *     which is why `settledRefundsCents` and `pendingRefundObligationsCents`
 *     remain separate fields beside `netSalesCents`.
 */

/**
 * The only calendar zone this endpoint accepts or emits. Kept as a literal so a
 * typo cannot compile, and so the response contract can pin the exact string.
 * MXN is intentionally NOT derived from this zone — the product-wide MXN
 * configuration is the external currency authority.
 */
export const BRANCH_SALES_SUMMARY_TIME_ZONE = 'America/Mexico_City' as const

/** Literal type derived from the constant (constant stays the single source of truth). */
export type BranchSalesSummaryTimeZone = typeof BRANCH_SALES_SUMMARY_TIME_ZONE

/**
 * Query contract. Both boundaries are exact local calendar strings
 * (`YYYY-MM-DD`) in `America/Mexico_City`; `from` inclusive, `to` exclusive.
 * These two keys are the complete request surface — the API layer passes
 * nothing else.
 */
export interface BranchSalesSummaryQuery {
  from: string
  to: string
}

/**
 * Wire response contract: the eight authoritative metrics plus the echoed
 * window metadata. Fields are flat because that is the backend JSON shape.
 */
export interface BranchSalesSummaryResponse {
  /** Effective calendar zone of the reported window. */
  timeZone: BranchSalesSummaryTimeZone
  /** Echo of the inclusive lower boundary (`YYYY-MM-DD`). */
  from: string
  /** Echo of the exclusive upper boundary (`YYYY-MM-DD`). */
  to: string
  /** Gross sales value for the window, in integer cents. */
  grossSalesCents: number
  /** Net sales value for the window, in integer cents. */
  netSalesCents: number
  /** Amount actually collected during the window, in integer cents. */
  collectedCents: number
  /** Outstanding debt attributable to the window cohort, in integer cents. */
  outstandingDebtCents: number
  /** Number of sales counted in the window (integer count, not cents). */
  saleCount: number
  /** Backend-computed average ticket, in integer cents. */
  averageTicketCents: number
  /** Refunds already settled during the window, in integer cents. */
  settledRefundsCents: number
  /** Refund obligations still pending at window close, in integer cents. */
  pendingRefundObligationsCents: number
}
