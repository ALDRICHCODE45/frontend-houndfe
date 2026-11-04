import type { EditorialSellableFacts } from '../interfaces/editorial-contract-document.types'
import { resolveEditorialDeclarationInput, toEditorialDeclarationInput, type EditorialDeclarationInput } from './editorial-contract-declaration-input'
import { resolveEditorialCareReviewInput, toEditorialCareReviewInput, type EditorialCareReviewInput } from './editorial-contract-care-input'
import { decodeEditorialSellableFacts } from './editorial-contract-document'
import { snapshotJson } from './editorial-contract-value'
type EditorialFactsRowInput = Omit<EditorialSellableFacts, 'declarations' | 'careReview'> & {
  declarations: EditorialDeclarationInput[]; careReview: EditorialCareReviewInput
}
export type EditorialFactsInput = EditorialFactsRowInput[]
export type EditorialFactsInputResult = { status: 'complete'; facts: EditorialSellableFacts[] } | { status: 'incomplete' }
/** Detach primitive-decoded history, without fresh validation or inferred subjects. */
export function toEditorialFactsInput(facts: EditorialSellableFacts[]): EditorialFactsInput {
  return facts.map(row => ({ ...row, declarations: row.declarations.map(toEditorialDeclarationInput),
    careReview: toEditorialCareReviewInput(row.careReview) }))
}

/**
 * Atomic control encoding only, not capture/reference or save/publication authority.
 * Parent retains raw edits. Only explicit omissions are removed; an incomplete
 * child rejects the entire array rather than returning partial or previous facts.
 * Exact subjects, duplicates and fresh-invalid prose remain downstream concerns.
 */
export function resolveEditorialFactsInput(input: EditorialFactsInput): EditorialFactsInputResult {
  try {
    // SAFETY: typed local input supplies the shape; snapshot detaches without getters.
    const raw = snapshotJson(input) as unknown as EditorialFactsInput
    const facts: EditorialSellableFacts[] = []
    for (const row of raw) {
      const declarations: EditorialSellableFacts['declarations'] = []
      for (const entry of row.declarations) {
        const result = resolveEditorialDeclarationInput(entry)
        if (result.status === 'incomplete') return { status: 'incomplete' }
        if (result.declaration !== null) declarations.push(result.declaration)
      }
      const care = resolveEditorialCareReviewInput(row.careReview)
      if (care.status === 'incomplete') return { status: 'incomplete' }
      const decoded = decodeEditorialSellableFacts({ ...row, declarations, careReview: care.careReview })
      if (decoded === null) return { status: 'incomplete' }
      facts.push(decoded)
    }
    return { status: 'complete', facts }
  } catch {
    return { status: 'incomplete' }
  }
}
