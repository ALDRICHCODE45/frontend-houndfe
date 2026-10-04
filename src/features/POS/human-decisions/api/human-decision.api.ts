/** HD2A/HD4A — human-decision transport; each method unwraps `{ data }`. */

import { http, type ExpirationResolveIsolationConfig } from '@/core/shared/api/http'
import type {
  HumanDecision,
  HumanDecisionListParams,
  HumanDecisionListResponse,
  HumanDecisionResolvePayload,
  ResolvedHumanDecision,
} from '../interfaces/human-decision.types'
import type {
  ExpirationDecisionResolvePayload,
  ResolvedExpirationDecision,
} from '../interfaces/expiration-decision.types'

export const humanDecisionApi = {
  /** GET /human-decisions — one server-ordered inbox page for the selected status filter. */
  async list(params: HumanDecisionListParams): Promise<HumanDecisionListResponse> {
    const { data } = await http.get<HumanDecisionListResponse>('/human-decisions', { params })
    return data
  },

  /** GET /human-decisions/:id — full PENDING or RESOLVED detail projection. */
  async getById(id: string): Promise<HumanDecision> {
    const { data } = await http.get<HumanDecision>(`/human-decisions/${id}`)
    return data
  },

  /** POST /human-decisions/:id/resolve — first resolve and exact replay both return 200. */
  async resolve(id: string, payload: HumanDecisionResolvePayload): Promise<ResolvedHumanDecision> {
    const { data } = await http.post<ResolvedHumanDecision>(
      `/human-decisions/${id}/resolve`,
      payload,
    )
    return data
  },

  /**
   * POST /human-decisions/:id/resolve — EXPIRATION opt-in. A `401` is propagated
   * without rotating tokens, clearing the session or replaying, so the feature can
   * ask the user to re-authenticate and retry. The RESTOCK `resolve` is unchanged.
   */
  async resolveExpiration(
    id: string,
    payload: ExpirationDecisionResolvePayload,
  ): Promise<ResolvedExpirationDecision> {
    const config: ExpirationResolveIsolationConfig = { expirationResolveIsolation: true }
    const { data } = await http.post<ResolvedExpirationDecision>(
      `/human-decisions/${id}/resolve`,
      payload,
      config,
    )
    return data
  },
}
