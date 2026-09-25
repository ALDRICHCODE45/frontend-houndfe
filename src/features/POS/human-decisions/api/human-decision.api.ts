/** HD2A/HD4A — RESTOCK human-decision transport; each method unwraps `{ data }`. */

import { http } from '@/core/shared/api/http'
import type {
  HumanDecision,
  HumanDecisionListParams,
  HumanDecisionListResponse,
  HumanDecisionResolvePayload,
  ResolvedHumanDecision,
} from '../interfaces/human-decision.types'

export const humanDecisionApi = {
  /** GET /human-decisions — PENDING RESTOCK inbox page (one-based request page). */
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
}
