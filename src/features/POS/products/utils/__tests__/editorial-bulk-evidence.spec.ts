/**
 * T24 (S19): one source for every known datum that still has none. Only known values without evidence
 * change; unknown, «No aplica», existing (even invalid) evidence stay exactly as they are.
 */
import { describe, expect, it } from 'vitest'
import type { EditorialAssignmentEditingRow } from '../editorial-contract-document-editing'
import { applyEditorialBulkEvidence, editorialBulkEvidenceErrors, editorialBulkEvidenceTargets } from '../editorial-bulk-evidence'

const row = (id: string, input: EditorialAssignmentEditingRow['input'], variantId: string | null = null): EditorialAssignmentEditingRow =>
  ({ id, target: { code: `code.${id}`, owner: variantId === null ? 'product' : 'sellable', variantId }, input })
const text = (value: string) => ({ type: 'text' as const, value })
const label = { sourceRef: 'Etiqueta del empaque', verifiedOn: '2026-11-01' }

const values = (): EditorialAssignmentEditingRow[] => [
  row('known', { state: 'known', payload: text('Perro'), evidence: null }),
  row('variant', { state: 'known', payload: text('3 kg'), evidence: null }, 'v1'),
  row('unknown', { state: 'unknown' }),
  row('na', { state: 'not_applicable' }),
  row('omitted', { state: 'omitted' }),
  row('sourced', { state: 'known', payload: text('Croqueta'), evidence: { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-10-01' } }),
  row('invalid', { state: 'known', payload: text('Pollo'), evidence: { sourceRef: '   ', verifiedOn: '2026-13-40' } }),
]

describe('editorialBulkEvidenceTargets', () => {
  it('lists only the known values with no evidence, product and per-presentation alike', () => {
    expect(editorialBulkEvidenceTargets(values()).map(item => item.id)).toEqual(['known', 'variant'])
  })
})

describe('applyEditorialBulkEvidence', () => {
  it('sets the evidence on known values without one and leaves every other row as it was', () => {
    const before = values()
    const after = applyEditorialBulkEvidence(before, label)
    expect(after.find(item => item.id === 'known')!.input).toEqual({ state: 'known', payload: text('Perro'), evidence: label })
    expect(after.find(item => item.id === 'variant')!.input).toEqual({ state: 'known', payload: text('3 kg'), evidence: label })
    for (const id of ['unknown', 'na', 'omitted', 'sourced', 'invalid']) expect(after.find(item => item.id === id)).toBe(before.find(item => item.id === id))
    expect(after.map(item => item.id)).toEqual(before.map(item => item.id))
  })
  it('does not mutate the rows it was given', () => {
    const before = values()
    applyEditorialBulkEvidence(before, label)
    expect(before[0]!.input).toEqual({ state: 'known', payload: text('Perro'), evidence: null })
  })
  it('gives each row its own copy of the evidence, with the source trimmed', () => {
    const after = applyEditorialBulkEvidence(values(), { sourceRef: '  Catálogo del proveedor ', verifiedOn: '2026-11-01' })
    const [first, second] = editorialBulkEvidenceTargets(values()).map(target => after.find(item => item.id === target.id)!.input)
    expect(first).toMatchObject({ evidence: { sourceRef: 'Catálogo del proveedor', verifiedOn: '2026-11-01' } })
    expect(first!.state === 'known' && second!.state === 'known' && first!.evidence !== second!.evidence).toBe(true)
  })
})

describe('editorialBulkEvidenceErrors', () => {
  it('accepts a source of 1 to 1000 characters and a real date', () => {
    expect(editorialBulkEvidenceErrors(label)).toEqual({})
    expect(editorialBulkEvidenceErrors({ sourceRef: 'x'.repeat(1000), verifiedOn: '2024-02-29' })).toEqual({})
  })
  it('asks for a source when it is blank after trimming', () => {
    expect(editorialBulkEvidenceErrors({ sourceRef: '   ', verifiedOn: '2026-11-01' })).toEqual({ sourceRef: 'Indica de dónde salen estos datos.' })
  })
  it('refuses more than 1000 characters and control characters', () => {
    expect(editorialBulkEvidenceErrors({ sourceRef: 'x'.repeat(1001), verifiedOn: '2026-11-01' }).sourceRef).toBe('La fuente puede tener hasta 1000 caracteres.')
    expect(editorialBulkEvidenceErrors({ sourceRef: 'Etiqueta\tdel empaque', verifiedOn: '2026-11-01' }).sourceRef).toBe('Quita los saltos de línea y tabuladores de la fuente.')
  })
  it('asks for a real date as AAAA-MM-DD', () => {
    for (const verifiedOn of ['', '2026-02-30', '01/11/2026', '2026-11-1'])
      expect(editorialBulkEvidenceErrors({ sourceRef: 'Etiqueta del empaque', verifiedOn })).toEqual({ verifiedOn: 'Elige una fecha válida.' })
  })
})
