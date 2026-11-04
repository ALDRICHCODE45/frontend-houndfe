import type { EditorialDeclarationValues } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialSellableFacts } from '../interfaces/editorial-contract-document.types'
import type { EditorialDeclarationInput } from './editorial-contract-declaration-input'
import type { EditorialCareReviewInput } from './editorial-contract-care-input'
import { toEditorialFactsInput, type EditorialFactsInput } from './editorial-contract-facts-input'
import { snapshotJson } from './editorial-contract-value'
type EditorialDeclarationEditingRow = { id: string; declarationKey: keyof EditorialDeclarationValues; input: EditorialDeclarationInput }
export type EditorialFactsEditingRow = {
  id: string; variantId: string | null; presentation: string; declarations: EditorialDeclarationEditingRow[]
  careReview: EditorialCareReviewInput; careRowIds: { requirements: string[]; warnings: string[] }
}
export type EditorialFactsEditingState = EditorialFactsEditingRow[]
/** Initialize primitive-decoded history only on explicit owner replacement.
 * Caller allocates unique owner-scoped UI IDs; this module owns no counter/store.
 * Preserve history without fresh validation. Never reinitialize on ordinary edits.
 */
export function toEditorialFactsEditingState(facts: EditorialSellableFacts[], nextId: () => string): EditorialFactsEditingState {
  return toEditorialFactsInput(facts).map((row, rowIndex) => ({
    id: nextId(), variantId: row.variantId, presentation: row.presentation,
    declarations: row.declarations.map((input, index) => ({
      id: nextId(), declarationKey: facts[rowIndex]!.declarations[index]!.key, input,
    })),
    careReview: row.careReview,
    careRowIds: row.careReview.state === 'prepared' ? {
      requirements: row.careReview.requirements.map(() => nextId()),
      warnings: row.careReview.warnings.map(() => nextId()),
    } : { requirements: [], warnings: [] },
  }))
}

/** Derive detached raw mapper input, never a second stored buffer or save verdict.
 * Explicit selection excludes UI identity; omitted, mismatched and incomplete raw
 * inputs remain unchanged. The existing facts resolver performs atomic encoding.
 */
export function projectEditorialFactsEditingState(state: EditorialFactsEditingState): EditorialFactsInput {
  const raw: EditorialFactsInput = state.map(row => ({
    variantId: row.variantId, presentation: row.presentation,
    declarations: row.declarations.map(declaration => declaration.input), careReview: row.careReview,
  }))
  // SAFETY: caller owns typed JSON raw input; detach without fresh validation.
  return snapshotJson(raw) as unknown as EditorialFactsInput
}
