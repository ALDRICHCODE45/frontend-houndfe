import { http } from '@/core/shared/api/http'
import type {
  BranchSalesSummaryQuery,
  BranchSalesSummaryResponse,
} from '../interfaces/branch-sales-summary.types'
import {
  parseBranchSalesTimeseriesResponse,
  type BranchSalesTimeseriesQuery,
  type BranchSalesTimeseriesResponse,
} from '../interfaces/branch-sales-timeseries.types'

/**
 * analytics.api.ts — authenticated transport for the backend analytics contract.
 *
 * Locked contract (ODD branch-sales-summary A1):
 *   - `GET /analytics/sales/summary` requires JWT + `read:Analytics`; the
 *     interceptor in `core/shared/api/http` attaches the bearer token.
 *   - Tenant/branch identity comes from the JWT, so the request sends ONLY the
 *     `from` and `to` calendar boundaries. The params object is rebuilt
 *     explicitly instead of forwarded, so forbidden keys (tenantId, branchId,
 *     currency, timestamps, or any future caller typo) can never cross the wire
 *     even if the caller passes an over-wide object.
 *   - `response.data` is destructured and returned: callers receive the wire
 *     body, never the AxiosResponse envelope.
 *
 * Locked contract (ODD dashboard-operational-insights OI-4):
 *   - `GET /analytics/sales/timeseries` has the same JWT + `read:Analytics`
 *     scope. Tenant/branch identity stays in the JWT, so the request sends ONLY
 *     `{ from, to, interval }` rebuilt from the typed params: an over-wide
 *     caller object cannot leak tenant, branch, currency or product
 *     dimensions onto the wire.
 *   - The response crosses a network boundary and is therefore UNTRUSTED. It is
 *     validated against the request before it reaches a composable, and a
 *     deviation rejects instead of being repaired (no fill, sort, dedupe or
 *     derivation in the browser).
 *   - The TanStack `signal` is forwarded so a superseded request is aborted at
 *     the HTTP layer, not merely ignored.
 */

export const analyticsApi = {
  async getBranchSalesSummary(
    params: BranchSalesSummaryQuery,
  ): Promise<BranchSalesSummaryResponse> {
    const { data } = await http.get<BranchSalesSummaryResponse>('/analytics/sales/summary', {
      params: { from: params.from, to: params.to },
    })
    return data
  },

  async getBranchSalesTimeseries(
    params: BranchSalesTimeseriesQuery,
    options: { signal?: AbortSignal } = {},
  ): Promise<BranchSalesTimeseriesResponse> {
    const { data } = await http.get<unknown>('/analytics/sales/timeseries', {
      params: { from: params.from, to: params.to, interval: params.interval },
      signal: options.signal,
    })

    return parseBranchSalesTimeseriesResponse(data, {
      from: params.from,
      to: params.to,
      interval: params.interval,
    })
  },
}
