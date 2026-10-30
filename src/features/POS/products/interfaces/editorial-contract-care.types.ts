import type { EditorialEvidence } from './editorial-contract-value.types'

export type EditorialRequirement = {
  key: string
  description: string
  disposition: 'satisfied' | 'not_applicable' | 'unresolved' | 'conflicting'
  evidence: EditorialEvidence[]
  basis: string
}

export type EditorialReviewWarning = {
  key: string
  requirementKeys: string[]
  text: string
  disclosure: 'private_only' | 'public_required' | 'unresolved'
  evidence: EditorialEvidence[]
  handlingBasis: string
}

export type EditorialCareReview =
  | { state: 'unknown' }
  | {
      state: 'prepared'
      jurisdiction: string
      intendedUse: string
      determination: 'identified' | 'none_applicable'
      evidence: EditorialEvidence[]
      basis: string
      requirements: EditorialRequirement[]
      warnings: EditorialReviewWarning[]
    }
