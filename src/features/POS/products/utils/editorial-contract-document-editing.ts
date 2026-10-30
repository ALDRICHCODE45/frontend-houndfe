import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import { toEditorialAssignmentInput, resolveEditorialAssignmentInput,
  type EditorialAssignmentTarget, type EditorialAssignmentInput } from './editorial-contract-assignment-input'
import { toEditorialFactsEditingState, projectEditorialFactsEditingState,
  type EditorialFactsEditingState } from './editorial-contract-facts-editing'
import { resolveEditorialFactsInput } from './editorial-contract-facts-input'
import { decodeEditorialContractDocument } from './editorial-contract-document'

export type EditorialAssignmentEditingRow = { id: string; target: EditorialAssignmentTarget; input: EditorialAssignmentInput }
export type EditorialDocumentEditingState = Omit<EditorialContractDocument, 'values' | 'facts'> & {
  values: EditorialAssignmentEditingRow[]; facts: EditorialFactsEditingState
}
export type EditorialDocumentEditingResult = { status: 'complete'; document: EditorialContractDocument } | { status: 'incomplete' }

/** Initialize primitive-decoded target history on explicit owner replacement only.
 * The owner supplies unique IDs: assignments first, then the facts bridge's order.
 * Preserve historical duplicates and raw evidence without fresh admission.
 */
export function toEditorialDocumentEditingState(document: EditorialContractDocument, nextId: () => string): EditorialDocumentEditingState {
  return { schemaVersion: document.schemaVersion, commercialTitle: document.commercialTitle, description: document.description,
    mediaRefs: [...document.mediaRefs], familyCode: document.familyCode,
    values: document.values.map(value => ({ id: nextId(), target: { code: value.code, owner: value.owner, variantId: value.variantId },
      input: toEditorialAssignmentInput(value) })),
    facts: toEditorialFactsEditingState(document.facts, nextId),
  }
}

/** Derive an atomic wire candidate, never a synchronized second buffer or save
 * verdict. Raw incompleteness stays with the owner; no previous-valid fallback.
 * This is NOT dirty detection: encoded omission loses meaningful editing content.
 */
export function resolveEditorialDocumentEditingState(state: EditorialDocumentEditingState): EditorialDocumentEditingResult {
  try {
    const values: EditorialContractDocument['values'] = []
    for (const row of state.values) {
      const result = resolveEditorialAssignmentInput(row.target, row.input)
      if (result.status === 'incomplete') return { status: 'incomplete' }
      if (result.assignment !== null) values.push(result.assignment)
    }
    const facts = resolveEditorialFactsInput(projectEditorialFactsEditingState(state.facts))
    if (facts.status === 'incomplete') return { status: 'incomplete' }
    const document = decodeEditorialContractDocument({ schemaVersion: state.schemaVersion,
      commercialTitle: state.commercialTitle, description: state.description, mediaRefs: state.mediaRefs,
      familyCode: state.familyCode, values, facts: facts.facts })
    return document === null ? { status: 'incomplete' } : { status: 'complete', document }
  } catch {
    return { status: 'incomplete' }
  }
}

/** Local S51 discard policy only. Every raw wrapper counts, even omitted/empty.
 * The UI obtains confirmation; cancellation keeps the original state reference.
 * Accepted changes clear both collections, preserving the unrelated envelope.
 * No dialog, allocation, hidden restore buffer, persistence or history mutation.
 */
export function requestEditorialFamilyChange(state: EditorialDocumentEditingState, familyCode: string | null, confirmed = false): {
  status: 'unchanged' | 'confirmation_required' | 'changed'; state: EditorialDocumentEditingState
} {
  if (familyCode === state.familyCode) return { status: 'unchanged', state }
  if (!confirmed && (state.values.length > 0 || state.facts.length > 0)) return { status: 'confirmation_required', state }
  return { status: 'changed', state: { ...state, familyCode, values: [], facts: [] } }
}
