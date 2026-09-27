import type { SellerReportRequest } from './interfaces/seller-report.types'

/**
 * query-keys.ts — cache keys for the seller sales report slice.
 *
 * The central registry (`src/core/shared/constants/query-keys.ts`) is the normal
 * home for query keys, but this slice must not write into that shared module, so
 * the key lives next to the feature that owns it. The namespace mirrors the
 * committed admin-users convention (`['admin', 'users', tenantId, ...]`):
 *
 * - `tenantId` is CACHE ISOLATION ONLY. It is part of the key so two tenants can
 *   never share a cached report, and it is never sent to the API (the backend
 *   resolves the tenant from the JWT).
 * - `sellerUserId` participates in the key, so opening the report for another
 *   seller can never reuse the previous seller's payload.
 * - Both `YYYY-MM-DD` boundaries participate, so two windows never share a slot.
 */
export const sellerSalesReportQueryKeys = {
  /** Prefix that matches every seller report slot of the active tenant. */
  prefix: (tenantId: string) => ['admin', 'users', tenantId, 'seller-sales-report'] as const,
  /** One seller report for one exact half-open Mexico City window. */
  report: (tenantId: string, request: SellerReportRequest) =>
    [
      ...sellerSalesReportQueryKeys.prefix(tenantId),
      request.sellerUserId,
      request.from,
      request.to,
    ] as const,
}
