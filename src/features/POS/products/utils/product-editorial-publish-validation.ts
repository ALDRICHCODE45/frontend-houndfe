import { validateEditorialAssignments, type EditorialAssignmentIssue } from './product-editorial-assignment-validation'
import { decodeEditorialDocument } from './product-editorial-document'

export interface EditorialPublishInput {
  readonly document: unknown
  readonly publishedDocument: unknown
  readonly vocabulary: unknown
  readonly context: unknown
}
export type EditorialPublishIssue = EditorialAssignmentIssue | { code: 'title' }
export interface EditorialPublishValidation { valid: boolean; issues: EditorialPublishIssue[] }

/** Validate the SAVED document without normalization. Only current Published
 * can conserve archived assignments; absent Published conserves nothing.
 */
export function validateEditorialPublish(input: EditorialPublishInput): EditorialPublishValidation {
  const decoded = decodeEditorialDocument(input.document)
  if (!decoded.readable) return { valid: false, issues: [{ code: 'structure' }] }
  const issues: EditorialPublishIssue[] = []
  if (decoded.document.commercialTitle === null || decoded.document.commercialTitle.trim() === '') {
    issues.push({ code: 'title' })
  }
  if (decoded.document.mediaRefs.length > 0) issues.push({ code: 'media' })
  const assignments = validateEditorialAssignments({ document: input.document,
    persistedBaseline: input.publishedDocument === null ? {
      commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [],
    } : input.publishedDocument,
    vocabulary: input.vocabulary, context: input.context })
  issues.push(...assignments.issues.filter(issue => issue.code !== 'media' || !issues.some(item => item.code === 'media')))
  return { valid: issues.length === 0, issues }
}
