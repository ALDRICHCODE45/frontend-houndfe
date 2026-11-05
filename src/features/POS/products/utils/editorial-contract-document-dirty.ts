import type { EditorialDocumentEditingState } from './editorial-contract-document-editing'
import type { EditorialAssignmentInput } from './editorial-contract-assignment-input'

function assignmentContent(input: EditorialAssignmentInput): EditorialAssignmentInput {
  if (input.state !== 'known' || (input.payload.type !== 'number' && input.payload.type !== 'range')) return input
  // Only numeric raw units are optional: absence and undefined mean unselected,
  // whereas null is the actual no-unit selection. No other content is normalized.
  return { ...input, payload: { ...input.payload, unit: input.payload.unit } }
}

function content(state: EditorialDocumentEditingState) {
  return {
    schemaVersion: state.schemaVersion,
    commercialTitle: state.commercialTitle,
    description: state.description,
    mediaRefs: state.mediaRefs,
    familyCode: state.familyCode,
    values: state.values.map(row => ({ target: row.target, input: assignmentContent(row.input) })),
    facts: state.facts.map(row => ({
      variantId: row.variantId,
      presentation: row.presentation,
      declarations: row.declarations.map(declaration => ({
        declarationKey: declaration.declarationKey, input: declaration.input,
      })),
      careReview: row.careReview,
    })),
  }
}

// Typed raw inputs are acyclic JSON-like data, not an untrusted decoding boundary.
// Compare properties by name, but arrays by position; never serialize or hash.
function sameContent(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameContent(value, right[index]))
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false
  // SAFETY: the typed projection contains only JSON-like objects after arrays/null.
  const a = left as Record<string, unknown>
  const b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length
    && keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && sameContent(a[key], b[key]))
}

/** Compare raw editing content, including incomplete and omitted wrappers.
 * Ignore only assignment/fact/declaration wrapper IDs and facts careRowIds.
 * No encoder, admission, mutation, baseline repair or active owner integration.
 */
export function isEditorialDocumentEditingEqual(
  left: EditorialDocumentEditingState,
  right: EditorialDocumentEditingState,
): boolean {
  return sameContent(content(left), content(right))
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}
function differing<T>(left: Map<string, T>, right: Map<string, T>, changes: (a: T | undefined, b: T | undefined) => number): number {
  let total = 0
  for (const key of new Set([...left.keys(), ...right.keys()])) total += changes(left.get(key), right.get(key))
  return total
}

/** How many fields the edit changed, for «3 cambios sin guardar»: the title, the description, the
 * family and the media each count once; then one per datum and presentation, one per presentation
 * answer, care review and presentation name. Same content rules as the equality above; a change it
 * cannot place (a reorder) still counts one, so the count is never zero while there are changes.
 */
export function countEditorialDocumentChanges(current: EditorialDocumentEditingState, saved: EditorialDocumentEditingState | null): number {
  if (!saved) return Math.max(1, countEditorialDocumentChanges(current, { ...current, commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [], facts: [] }))
  const a = content(current), b = content(saved)
  let total = (['commercialTitle', 'description', 'familyCode', 'mediaRefs'] as const).filter(key => !sameContent(a[key], b[key])).length
  const targets = (rows: typeof a.values) => groupBy(rows, row => JSON.stringify([row.target.code, row.target.owner, row.target.variantId]))
  total += differing(targets(a.values), targets(b.values), (left, right) => (sameContent(left ?? [], right ?? []) ? 0 : 1))
  const answers = (row: (typeof a.facts)[number] | undefined) => groupBy(row?.declarations ?? [], item => item.declarationKey)
  const presentations = (rows: typeof a.facts) => new Map([...groupBy(rows, row => JSON.stringify(row.variantId))].map(([key, list]) => [key, list[0]!]))
  total += differing(presentations(a.facts), presentations(b.facts), (left, right) => {
    if (!left || !right) {
      const only = (left ?? right)!
      return Math.max(1, only.declarations.length + (only.careReview.state === 'omitted' ? 0 : 1))
    }
    return (left.presentation === right.presentation ? 0 : 1) + (sameContent(left.careReview, right.careReview) ? 0 : 1)
      + differing(answers(left), answers(right), (x, y) => (sameContent(x ?? [], y ?? []) ? 0 : 1))
  })
  return total === 0 && !isEditorialDocumentEditingEqual(current, saved) ? 1 : total
}
