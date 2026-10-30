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
