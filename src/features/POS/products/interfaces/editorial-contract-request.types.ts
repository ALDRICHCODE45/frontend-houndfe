import type { EditorialContractDocument } from './editorial-contract-document.types'
import type { EditorialReadinessIssues } from './editorial-contract-readiness.types'

export type EditorialContractInitializeRequest = { expectedCycle: number | null }
export type EditorialContractTransitionRequest = { expectedCycle: number; expectedRevision: number }
export type EditorialContractSaveRequest = EditorialContractTransitionRequest & {
  document: EditorialContractDocument
}
export type EditorialContractContext = { variants: { id: string; name: string }[] }
export type EditorialContractErrorEnvelope =
  | { statusCode: 400; error: 'MALFORMED' }
  | ({ statusCode: 400; error: 'MALFORMED' } & EditorialReadinessIssues)
  | { statusCode: 401; error: 'UNAUTHORIZED' }
  | { statusCode: 403; error: 'FORBIDDEN' }
  | { statusCode: 404; error: 'NOT_FOUND' }
  | { statusCode: 409; error: 'CONFLICT' | 'VOCABULARY_CHANGED' }
  | { statusCode: 500; error: 'EDITORIAL_VOCABULARY_UNREPRESENTABLE' | 'INTERNAL_ERROR' }
export type EditorialContractCareConfirmation = 'review-v1' | null
