import type { EditorialFactsEditingRow as Row } from './editorial-contract-facts-editing'
import type { EditorialDeclarationValues } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialDeclarationInput } from './editorial-contract-declaration-input'
import type { EditorialCareReviewInput } from './editorial-contract-care-input'
import { removeEditorialCareRequirement } from './editorial-contract-care-edits'
import { snapshotJson } from './editorial-contract-value'
type Kind = 'requirements' | 'warnings'

function copy<T>(value: T): T {
  // SAFETY: typed JSON raw input retains its shape through a detached snapshot.
  return snapshotJson(value) as unknown as T
}
function declarationIndex(row: Row, id: string): number {
  const index = row.declarations.findIndex(entry => entry.id === id)
  if (index < 0) throw new RangeError('Declaration row ID was not found')
  return index
}
function checkCareIds(row: Row) {
  for (const kind of ['requirements', 'warnings'] as const) {
    const length = row.careReview.state === 'prepared' ? row.careReview[kind].length : 0
    if (row.careRowIds[kind].length !== length) throw new RangeError('Care row IDs are not aligned')
  }
}
function preparedCopy(row: Row) {
  checkCareIds(row)
  const next = copy(row)
  if (next.careReview.state !== 'prepared') throw new RangeError('Care review is not prepared')
  return { next, care: next.careReview }
}

/** Explicit local creation only; caller owns eligibility and unique ID allocation. */
export function appendEditorialFactsDeclaration(row: Row, key: keyof EditorialDeclarationValues, nextId: () => string): Row {
  const next = copy(row)
  next.declarations.push({ id: nextId(), declarationKey: key, input: { state: 'omitted' } })
  return next
}
/** Preserve wrapper identity even when raw input is omitted or mismatched. Unknown ID throws RangeError. */
export function updateEditorialFactsDeclaration(row: Row, id: string, input: EditorialDeclarationInput): Row {
  const index = declarationIndex(row, id), next = copy(row)
  next.declarations[index]!.input = copy(input)
  return next
}
/** Remove only the selected UI ID; retain all sibling keys/IDs/order. Unknown ID throws RangeError. */
export function removeEditorialFactsDeclaration(row: Row, id: string): Row {
  const index = declarationIndex(row, id), next = copy(row)
  next.declarations.splice(index, 1)
  return next
}
/** Same-position child edits preserve IDs. List size changes use explicit list operations.
 * Caller must complete S41 confirmation before destructive state replacement.
 * No hidden restoration buffer, persistence or readiness authority; invalid alignment
 * or prepared-to-prepared list size changes throw RangeError before allocation.
 */
export function replaceEditorialFactsCare(row: Row, input: EditorialCareReviewInput, nextId: () => string): Row {
  checkCareIds(row)
  if (row.careReview.state === 'prepared' && input.state === 'prepared') {
    for (const kind of ['requirements', 'warnings'] as const)
      if (row.careReview[kind].length !== input[kind].length) throw new RangeError('Care replacement changes list length')
  }
  const next = copy({ ...row, careReview: input })
  if (input.state !== 'prepared') next.careRowIds = { requirements: [], warnings: [] }
  else if (row.careReview.state !== 'prepared') next.careRowIds = {
    requirements: input.requirements.map(() => nextId()), warnings: input.warnings.map(() => nextId()),
  }
  return next
}
/** Append a blank raw child and one ID. Nonprepared/misaligned input throws RangeError. */
export function appendEditorialFactsCareRow(row: Row, kind: Kind, nextId: () => string): Row {
  const { next, care } = preparedCopy(row)
  if (kind === 'requirements') care.requirements.push({ key: '', description: '', disposition: null, basis: '', evidence: [] })
  else care.warnings.push({ key: '', text: '', requirementKeys: [], disclosure: null, handlingBasis: '', evidence: [] })
  next.careRowIds[kind].push(nextId())
  return next
}
/** Delete one UI-identified child. Requirement deletion preserves every warning reference.
 * Nonprepared/misaligned input or an unknown ID throws RangeError; original is unchanged.
 */
export function removeEditorialFactsCareRow(row: Row, kind: Kind, id: string): Row {
  const { next, care } = preparedCopy(row), index = next.careRowIds[kind].indexOf(id)
  if (index < 0) throw new RangeError('Care row ID was not found')
  if (kind === 'requirements') next.careReview = removeEditorialCareRequirement(care, index)
  else care.warnings.splice(index, 1)
  next.careRowIds[kind].splice(index, 1)
  return next
}
