import { http } from '@/core/shared/api/http'
import type {
  BranchSalesSummaryQuery,
  BranchSalesSummaryResponse,
} from '../interfaces/branch-sales-summary.types'

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
}
