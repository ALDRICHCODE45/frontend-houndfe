import type { EditorialFactsEditingRow, EditorialFactsEditingState } from './editorial-contract-facts-editing'

/** UI discard policy, not domain validation. Explicit choices and whitespace count;
 * subject identity and generated UI IDs alone do not make a row populated.
 */
export function requiresEditorialFactsRemovalConfirmation(row: EditorialFactsEditingRow): boolean {
  return row.presentation !== '' || row.declarations.length > 0 || row.careReview.state !== 'omitted'
}

/** Request a local removal by unique owner-supplied UI ID, never by domain identity.
 * On confirmation_required, keep the original state (including incomplete edits).
 * The caller may cancel without replacing state, or retry after explicit consent.
 * Successful removal returns a new array sharing unchanged survivor objects.
 * No dialog, persistence, publication or state ownership lives here.
 * Throws RangeError for an unknown ID without modifying input.
 */
export function requestEditorialFactsRowRemoval(
  state: EditorialFactsEditingState, id: string, confirmed = false,
): { status: 'confirmation_required' | 'removed'; state: EditorialFactsEditingState } {
  const row = state.find(candidate => candidate.id === id)
  if (!row) throw new RangeError('Facts row ID was not found')
  if (requiresEditorialFactsRemovalConfirmation(row) && !confirmed)
    return { status: 'confirmation_required', state }
  return { status: 'removed', state: state.filter(candidate => candidate.id !== id) }
}
