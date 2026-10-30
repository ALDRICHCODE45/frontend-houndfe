import type { EditorialDeclaration, EditorialDeclarationValues } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialEvidence } from '../interfaces/editorial-contract-value.types'
import { decodeEditorialDeclaration } from './editorial-contract-declaration'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'
import { snapshotJson } from './editorial-contract-value'

export type EditorialDeclarationInput =
  | { state: 'omitted' }
  | { [K in keyof EditorialDeclarationValues]:
      | { key: K; state: 'unknown' }
      | { key: K; state: 'known'; value: EditorialDeclarationValues[K] extends string | boolean
          ? EditorialDeclarationValues[K] | null : EditorialDeclarationValues[K]
          evidence: EditorialEvidence | null; basis: string }
    }[keyof EditorialDeclarationValues]
export type EditorialDeclarationInputResult =
  | { status: 'complete'; declaration: EditorialDeclaration | null }
  | { status: 'incomplete' }

/**
 * Initialize from primitive-decoded history only, not fresh admission.
 * Preserve even fresh-invalid prose/evidence and deeply detach all nested arrays.
 */
export function toEditorialDeclarationInput(declaration: EditorialDeclaration | null): EditorialDeclarationInput {
  if (declaration === null) return { state: 'omitted' }
  if (declaration.state === 'unknown') return { key: declaration.key, state: 'unknown' }
  // SAFETY: primitive-decoded history establishes correlation; snapshot only detaches JSON.
  return snapshotJson(declaration) as unknown as EditorialDeclarationInput
}

/**
 * Complete means primitive encoding plus selected values and valid supplied evidence,
 * NOT fresh capture, references, family/production admission or save/publish authority.
 * Keep exact prose/lists for downstream checks; parent retains every raw edit even
 * when incomplete. No previous declaration is accepted as a saveable fallback.
 */
export function resolveEditorialDeclarationInput(input: EditorialDeclarationInput): EditorialDeclarationInputResult {
  try {
    // SAFETY: typed local input establishes correlation; snapshot only detaches JSON.
    // Snapshot before reading fields: no submitted accessors participate in encoding.
    const raw = snapshotJson(input) as unknown as EditorialDeclarationInput
    if (raw.state === 'omitted') return { status: 'complete', declaration: null }
    if (raw.state === 'known' && (raw.value === null || !isFreshEditorialEvidence(raw.evidence))) {
      return { status: 'incomplete' }
    }
    const declaration = decodeEditorialDeclaration(raw.state === 'unknown' ? { ...raw, evidence: null } : raw)
    return declaration === null ? { status: 'incomplete' } : { status: 'complete', declaration }
  } catch {
    return { status: 'incomplete' }
  }
}
