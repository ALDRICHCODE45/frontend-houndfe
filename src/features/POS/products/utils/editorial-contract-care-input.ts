import type { EditorialCareReview, EditorialRequirement, EditorialReviewWarning } from '../interfaces/editorial-contract-care.types'
import { decodeEditorialCareReview } from './editorial-contract-care'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'

type PreparedReview = Extract<EditorialCareReview, { state: 'prepared' }>
export type EditorialCareReviewInput =
  | { state: 'omitted' }
  | { state: 'unknown' }
  | (Omit<PreparedReview, 'determination' | 'requirements' | 'warnings'> & {
      determination: PreparedReview['determination'] | null
      requirements: (Omit<EditorialRequirement, 'disposition'> & { disposition: EditorialRequirement['disposition'] | null })[]
      warnings: (Omit<EditorialReviewWarning, 'disclosure'> & { disclosure: EditorialReviewWarning['disclosure'] | null })[]
    })
export type EditorialCareReviewInputResult =
  | { status: 'complete'; careReview: EditorialCareReview | null }
  | { status: 'incomplete' }

/**
 * Initialize from primitive-decoded history only. Deeply detach without fresh
 * validation: invalid historical evidence/prose stays visible for explicit edits.
 */
export function toEditorialCareReviewInput(review: EditorialCareReview | null): EditorialCareReviewInput {
  if (review === null) return { state: 'omitted' }
  if (review.state === 'unknown') return { state: 'unknown' }
  return {
    ...review,
    evidence: review.evidence.map((entry) => ({ ...entry })),
    requirements: review.requirements.map((row) => ({
      ...row, evidence: row.evidence.map((entry) => ({ ...entry })),
    })),
    warnings: review.warnings.map((row) => ({
      ...row, requirementKeys: [...row.requirementKeys],
      evidence: row.evidence.map((entry) => ({ ...entry })),
    })),
  }
}

/**
 * Encoding only, not capture/reference admission, readiness or save permission.
 * Null enum selections or any invalid supplied evidence make the WHOLE result
 * incomplete. Empty arrays remain explicit; prose, duplicate identities, dangling
 * references and unresolved/contradictory content belong to downstream gates.
 * Parent retains raw edits; no previous valid review, pruning, cascade or fallback.
 * Request confirmation tokens and lifecycle revisions are not care content.
 */
export function resolveEditorialCareReviewInput(input: EditorialCareReviewInput): EditorialCareReviewInputResult {
  if (input.state === 'omitted') return { status: 'complete', careReview: null }
  // Primitive decoding rejects unselected enums and detaches before inspection.
  const careReview = decodeEditorialCareReview(input)
  if (careReview === null) return { status: 'incomplete' }
  if (careReview.state === 'prepared') {
    const arrays = [careReview.evidence,
      ...careReview.requirements.map((row) => row.evidence),
      ...careReview.warnings.map((row) => row.evidence)]
    if (!arrays.every((entries) => entries.every(isFreshEditorialEvidence))) return { status: 'incomplete' }
  }
  return { status: 'complete', careReview }
}
