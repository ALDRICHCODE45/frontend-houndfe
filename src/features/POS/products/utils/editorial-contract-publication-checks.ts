import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialCandidateCapture } from './editorial-contract-candidate-capture'
import { inspectEditorialNotApplicableAdmission } from './editorial-contract-na-admission'

export type EditorialRuntimeIssue = { code: string; valueIndex?: number }
/** Supplied-content checks only. The admitted server vocabulary is a prerequisite
 * for production dispatch. Context is NOT E; per-E requiredness, fact conflicts,
 * evidence sufficiency and care eligibility remain authoritative under server lock.
 */
export function inspectEditorialRuntimeCandidate(document: unknown, baseline: unknown,
  vocabulary: EditorialContractVocabulary, context: EditorialContractContext): EditorialRuntimeIssue[] {
  const capture = inspectEditorialCandidateCapture({ document, storedDraft: baseline, vocabulary, context })
  const issues: EditorialRuntimeIssue[] = [...capture.basicIssues, ...(capture.referenceConservationIssues ?? [])]
  if (capture.factsCapture === 'invalid') issues.push({ code: 'FACTS_CAPTURE' })
  if (capture.document && issues.length === 0) issues.push(...inspectEditorialNotApplicableAdmission({ document: capture.document, vocabulary }))
  return issues
}

export function inspectEditorialPublicationContent(document: EditorialContractDocument,
  published: EditorialContractDocument | null, vocabulary: EditorialContractVocabulary,
  context: EditorialContractContext): EditorialRuntimeIssue[] {
  const issues = inspectEditorialRuntimeCandidate(document, published, vocabulary, context)
  if (document.commercialTitle === null || !document.commercialTitle.trim()) issues.push({ code: 'title' })
  if (document.mediaRefs.length) issues.push({ code: 'media' })
  document.values.forEach((value, valueIndex) => {
    if (value.state !== 'known' || !['number', 'range'].includes(value.payload.type)) return
    const definition = vocabulary.definitions.find(item => item.code === value.code)
    if (definition && (definition.type === 'number' || definition.type === 'range') && definition.numericPolicy.status === 'pending') {
      issues.push({ code: 'NUMERIC_POLICY_PENDING', valueIndex })
    }
  })
  return issues
}
