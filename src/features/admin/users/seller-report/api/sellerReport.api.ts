import { http } from '@/core/shared/api/http'
import {
  parseSellerSalesReportResponse,
  type SellerReportRequest,
  type SellerSalesReport,
} from '../interfaces/seller-report.types'

/**
 * sellerReport.api.ts — authenticated transport for the seller sales report.
 *
 * Locked contract:
 *   - `GET /analytics/sales/sellers/:sellerUserId/report` requires JWT plus
 *     `read:User`, `read:Sale` and `read:Analytics`; the interceptor in
 *     `core/shared/api/http` attaches the bearer token and disables HTTP caching
 *     for authenticated GETs.
 *   - Tenant identity comes from the JWT, so the request sends ONLY `from` and
 *     `to` as query params. The params object is rebuilt explicitly instead of
 *     forwarded, so a forbidden key (tenantId, currency, timestamps, page, or a
 *     future caller typo) can never cross the wire.
 *   - The seller id travels as a PATH SEGMENT and is therefore encoded: a
 *     hostile value can never escape its slot into another path or query.
 *   - `tenantId` is supplied as an EXPECTATION, never as a query param: the
 *     backend resolves the tenant from the JWT, and the response must echo the
 *     caller's tenant context.
 *   - The response crosses a network boundary and is UNTRUSTED. It is validated
 *     against the request before it reaches a composable, and a deviation
 *     rejects instead of being repaired (no fill, sort, dedupe or derivation in
 *     the browser).
 *   - The TanStack `signal` is forwarded so a superseded request is aborted at
 *     the HTTP layer, not merely ignored.
 */

export interface SellerReportRequestContext {
  /** Tenant the response must echo. Cache/validation context only — never sent. */
  tenantId: string
  /** TanStack abort signal for a superseded request. */
  signal?: AbortSignal
}

export const sellerReportApi = {
  async getReport(
    params: SellerReportRequest,
    context: SellerReportRequestContext,
  ): Promise<SellerSalesReport> {
    const { data } = await http.get<unknown>(
      `/analytics/sales/sellers/${encodeURIComponent(params.sellerUserId)}/report`,
      {
        params: { from: params.from, to: params.to },
        signal: context.signal,
      },
    )

    return parseSellerSalesReportResponse(data, {
      tenantId: context.tenantId,
      sellerUserId: params.sellerUserId,
      from: params.from,
      to: params.to,
    })
  },
}
