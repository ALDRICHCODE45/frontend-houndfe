/**
 * HD2A — RESTOCK human-decision read transport: thin Axios wrapper; each
 * method unwraps `{ data }`. Resolve transport lands in HD4.
 */

import { http } from '@/core/shared/api/http'
import type {
  HumanDecision,
  HumanDecisionListParams,
  HumanDecisionListResponse,
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
}
