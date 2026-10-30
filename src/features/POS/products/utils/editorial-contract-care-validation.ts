import type { EditorialEvidence } from '../interfaces/editorial-contract-value.types'
import { decodeEditorialCareReview } from './editorial-contract-care'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'

// The primitive reader has already proved scalar strings. Controls are allowed in prose.
function boundedProse(value: string, max: number): boolean {
  return value.trim().length > 0 && [...value].length <= max
}

function freshEvidenceList(entries: EditorialEvidence[]): boolean {
  if (entries.length > 16) return false
  const identities = new Set<string>()
  for (const entry of entries) {
    if (!isFreshEditorialEvidence(entry)) return false
    const identity = JSON.stringify([entry.sourceRef, entry.verifiedOn])
    if (identities.has(identity)) return false
    identities.add(identity)
  }
  return true
}

/** Fresh private capture only, never evidence sufficiency or publication readiness. */
export function isFreshEditorialCareCapture(raw: unknown): boolean {
  const review = decodeEditorialCareReview(raw)
  if (!review) return false
  if (review.state === 'unknown') return true
  if (!boundedProse(review.jurisdiction, 200)
    || !boundedProse(review.intendedUse, 1000)
    || !boundedProse(review.basis, 2000)
    || !freshEvidenceList(review.evidence)
    || review.requirements.length > 32 || review.warnings.length > 32) return false

  const requirementKeys = new Set<string>()
  for (const requirement of review.requirements) {
    if (!boundedProse(requirement.key, 80)
      || !boundedProse(requirement.description, 2000)
      || !boundedProse(requirement.basis, 2000)
      || !freshEvidenceList(requirement.evidence)
      || requirementKeys.has(requirement.key)) return false
    requirementKeys.add(requirement.key)
  }

  const warningKeys = new Set<string>()
  for (const warning of review.warnings) {
    if (!boundedProse(warning.key, 80)
      || !boundedProse(warning.text, 4000)
      || !boundedProse(warning.handlingBasis, 2000)
      || !freshEvidenceList(warning.evidence)
      || warningKeys.has(warning.key)
      || warning.requirementKeys.length > 32) return false
    warningKeys.add(warning.key)
    const references = new Set<string>()
    for (const key of warning.requirementKeys) {
      if (!requirementKeys.has(key) || references.has(key)) return false
      references.add(key)
    }
  }
  return true
}
