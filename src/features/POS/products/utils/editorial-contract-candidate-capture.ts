import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialArchivedWarning } from '../interfaces/editorial-contract-response.types'
import { inspectEditorialBasicAdmission, type EditorialBasicInput, type EditorialBasicIssue } from './editorial-contract-fresh-validation'
import { inspectEditorialArchivedConservation, type EditorialConservationIssue } from './editorial-contract-conservation'
import { isFreshEditorialFactsCapture } from './editorial-contract-facts-validation'

export type EditorialCandidateCaptureInput = EditorialBasicInput & { storedDraft: unknown }
export type EditorialCandidateCaptureResult = {
  document: EditorialContractDocument | null
  basicIssues: EditorialBasicIssue[]
  factsCapture: 'not_checked' | 'valid' | 'invalid'
  referenceConservationIssues: EditorialConservationIssue[] | null
  warnings: EditorialArchivedWarning[]
}
/**
 * Fresh candidate capture/conservation only, never permission to save or publish.
 * Requires qualified vocabulary/current context; caller supplies stored Draft, not edits.
 * Diagnostics intentionally retain overlap in separate stages; facts capture is aggregate.
 * Warnings establish conservation only, even when unrelated fresh checks fail.
 * Excludes selected NA, production dispatch admission, media ownership, serialized size,
 * permissions/CAS, independent fact conflicts, E, and publication/care readiness.
 * Never apply to initialize copies, historical reads or recorded acknowledgements.
 */
export function inspectEditorialCandidateCapture(input: EditorialCandidateCaptureInput): EditorialCandidateCaptureResult {
  const basic = inspectEditorialBasicAdmission(input)
  if (basic.document === null) {
    return { document: null, basicIssues: basic.issues, factsCapture: 'not_checked', referenceConservationIssues: null, warnings: [] }
  }
  // Reuse existing public boundaries on the detached candidate, not the raw input again.
  const factsCapture = isFreshEditorialFactsCapture(basic.document.facts) ? 'valid' : 'invalid'
  const conservation = inspectEditorialArchivedConservation({
    document: basic.document, baseline: input.storedDraft, vocabulary: input.vocabulary, context: input.context,
  })
  return {
    document: basic.document, basicIssues: basic.issues, factsCapture,
    referenceConservationIssues: conservation.issues, warnings: conservation.warnings,
  }
}
