import type { EditorialCareReviewInput } from './editorial-contract-care-input'
import { snapshotJson } from './editorial-contract-value'
export type PreparedEditorialCareInput = Extract<EditorialCareReviewInput, { state: 'prepared' }>

function detachedReview(review: PreparedEditorialCareInput, index: number): PreparedEditorialCareInput {
  if (!Number.isInteger(index) || index < 0 || index >= review.requirements.length)
    throw new RangeError('Requirement index is out of bounds')
  // SAFETY: caller owns typed raw input; this detaches without fresh validation.
  return snapshotJson(review) as unknown as PreparedEditorialCareInput
}

/** Rename only the selected local row. Warning references remain verbatim.
 * Raw blank/duplicate keys stay editable; downstream validation still applies.
 * Throws RangeError for an invalid row index; never mutates input or saves.
 */
export function renameEditorialCareRequirement(review: PreparedEditorialCareInput, index: number, key: string): PreparedEditorialCareInput {
  const next = detachedReview(review, index)
  next.requirements[index]!.key = key
  return next
}

/** Remove only the selected local row, never its warnings or their references.
 * Dangling references require explicit correction, not automatic reassignment.
 * Throws RangeError for an invalid row index; never mutates input or saves.
 */
export function removeEditorialCareRequirement(review: PreparedEditorialCareInput, index: number): PreparedEditorialCareInput {
  const next = detachedReview(review, index)
  next.requirements.splice(index, 1)
  return next
}
