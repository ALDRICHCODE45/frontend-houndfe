import type { EditorialEvidence } from '../interfaces/editorial-contract-value.types'
import type { EditorialAssignmentEditingRow } from './editorial-contract-document-editing'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'

/**
 * «Usar una fuente para todos» (S19): one source and date for every known datum that has none yet.
 * Only known values without evidence take it. Unknown and «No aplica» values carry no evidence, and
 * existing evidence, valid or not, is the user's own: it stays. Pure functions; saving is the owner's.
 */
export function editorialBulkEvidenceTargets(values: readonly EditorialAssignmentEditingRow[]): EditorialAssignmentEditingRow[] {
  return values.filter(row => row.input.state === 'known' && row.input.evidence === null)
}

export function applyEditorialBulkEvidence(values: readonly EditorialAssignmentEditingRow[], source: EditorialEvidence): EditorialAssignmentEditingRow[] {
  const sourceRef = source.sourceRef.trim()
  return values.map(row => (row.input.state === 'known' && row.input.evidence === null
    ? { ...row, input: { ...row.input, evidence: { sourceRef, verifiedOn: source.verifiedOn } } } : row))
}

/** What is wrong with the chosen source, per field, in the contract's terms: a source of 1–1000
 * characters, not blank and with no control characters, and a real date as AAAA-MM-DD. */
export function editorialBulkEvidenceErrors(source: EditorialEvidence): { sourceRef?: string; verifiedOn?: string } {
  const errors: { sourceRef?: string; verifiedOn?: string } = {}
  const sourceRef = source.sourceRef.trim()
  if (!sourceRef) errors.sourceRef = 'Indica de dónde salen estos datos.'
  else if ([...sourceRef].length > 1000) errors.sourceRef = 'La fuente puede tener hasta 1000 caracteres.'
  else if (/[\u0000-\u001f\u007f]/.test(sourceRef)) errors.sourceRef = 'Quita los saltos de línea y tabuladores de la fuente.'
  if (!isFreshEditorialEvidence({ sourceRef: 'x', verifiedOn: source.verifiedOn })) errors.verifiedOn = 'Elige una fecha válida.'
  return errors
}
