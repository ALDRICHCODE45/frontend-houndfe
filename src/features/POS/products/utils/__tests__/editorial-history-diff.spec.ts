import { describe, expect, it } from 'vitest'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialAssignmentInput } from '../editorial-contract-assignment-input'
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import { editorialInputText } from '../editorial-value-text'
import { buildEditorialHistoryChanges } from '../editorial-history-diff'

const vocabulary: EditorialContractVocabulary = {
  semanticsVersion: 'editorial-production-1',
  families: [{ id: 'food', code: 'food', label: 'Alimento', bindings: [] }, { id: 'toy', code: 'toy', label: 'Juguete', bindings: [] }],
  definitions: [
    { id: 'a', code: 'animal.target', label: 'Especie', type: 'single', groups: [], aliases: [], options: [{ code: 'dog', label: 'Perro', archived: false, sortOrder: 0 }, { code: 'cat', label: 'Gato', archived: false, sortOrder: 1 }] },
    { id: 'm', code: 'measure.net_mass', label: 'Peso neto', type: 'number', units: [{ code: 'kg', label: 'kg', sortOrder: 0 }], numericPolicy: { status: 'pending' } },
  ],
}
const context = { variants: [{ id: 'v1', name: '15 kg' }] }
const doc = (patch: Partial<EditorialContractDocument> = {}): EditorialContractDocument => ({
  schemaVersion: 2, commercialTitle: 'Croqueta', description: null, mediaRefs: [], familyCode: 'food', values: [], facts: [], ...patch,
})
const species = (value: string) => ({ code: 'animal.target', owner: 'product' as const, variantId: null, state: 'known' as const, payload: { type: 'single' as const, value }, evidence: null })
const changes = (published: EditorialContractDocument | null, draft: EditorialContractDocument | null) =>
  buildEditorialHistoryChanges({ published, draft, vocabulary, context })

describe('buildEditorialHistoryChanges', () => {
  it('lists only the fields that changed, with plain labels', () => {
    const result = changes(doc({ commercialTitle: 'Antes', description: 'Igual' }), doc({ commercialTitle: 'Después', description: 'Igual' }))
    expect(result).toEqual([{ key: 'title', label: 'Título comercial', before: 'Antes', after: 'Después' }])
  })

  it('has no changes when the draft equals the published version', () => {
    expect(changes(doc({ values: [species('dog')] }), doc({ values: [species('dog')] }))).toEqual([])
  })

  it('shows an attribute with its human label and option label, never a code', () => {
    const [change] = changes(doc({ values: [species('dog')] }), doc({ values: [species('cat')] }))
    expect(change).toMatchObject({ label: 'Especie', before: 'Perro', after: 'Gato' })
    expect(JSON.stringify(change)).not.toMatch(/animal\.target|\bdog\b|\bcat\b/)
  })

  it('marks an added attribute with no "before" and a removed one with no "after"', () => {
    const added = changes(doc(), doc({ values: [species('dog')] }))
    expect(added).toEqual([expect.objectContaining({ label: 'Especie', before: null, after: 'Perro' })])
    const removed = changes(doc({ values: [species('dog')] }), doc())
    expect(removed).toEqual([expect.objectContaining({ label: 'Especie', before: 'Perro', after: null })])
  })

  it('names a per-presentation attribute by the presentation, not by its id', () => {
    const mass = (value: number) => ({ code: 'measure.net_mass', owner: 'sellable' as const, variantId: 'v1', state: 'known' as const, payload: { type: 'number' as const, value, unit: 'kg' }, evidence: null })
    const [change] = changes(doc({ values: [mass(10)] }), doc({ values: [mass(15)] }))
    expect(change).toMatchObject({ label: 'Peso neto · 15 kg', before: '10 kg', after: '15 kg' })
    expect(JSON.stringify(change)).not.toContain('v1')
  })

  it('falls back to a generic name for a presentation that no longer exists', () => {
    const gone = { code: 'measure.net_mass', owner: 'sellable' as const, variantId: 'zzz', state: 'unknown' as const, evidence: null }
    const [change] = changes(doc(), doc({ values: [gone] }))
    expect(change!.label).toBe('Peso neto · Presentación')
    expect(change!.after).toBe('Desconocido')
  })

  it('compares the family by label', () => {
    expect(changes(doc({ familyCode: 'food' }), doc({ familyCode: 'toy' }))).toEqual([{ key: 'family', label: 'Familia', before: 'Alimento', after: 'Juguete' }])
  })

  it('summarizes the declarations and care of a presentation without raw keys', () => {
    const facts = (count: number) => ({ variantId: 'v1', presentation: 'x', declarations: Array.from({ length: count }, () => ({ key: 'consumable', state: 'unknown' as const })), careReview: null })
    const [change] = changes(doc({ facts: [facts(1)] as never }), doc({ facts: [facts(2)] as never }))
    expect(change).toMatchObject({ label: 'Declaraciones y cuidado · 15 kg', before: '1 declaración', after: '2 declaraciones' })
    expect(JSON.stringify(change)).not.toContain('consumable')
  })

  it('treats an empty title the same as a missing one', () => {
    expect(changes(doc({ commercialTitle: null }), doc({ commercialTitle: '' }))).toEqual([])
  })

  it('compares against nothing when there is no published version', () => {
    const result = changes(null, doc({ commercialTitle: 'Nuevo', familyCode: null }))
    expect(result).toEqual([{ key: 'title', label: 'Título comercial', before: null, after: 'Nuevo' }])
  })

  it('has no changes without a draft', () => {
    expect(changes(doc(), null)).toEqual([])
  })
})

describe('editorialInputText', () => {
  const single = vocabulary.definitions[0]!
  const number = vocabulary.definitions[1]!
  const cases: [EditorialAssignmentInput, EditorialDefinition | undefined, string][] = [
    [{ state: 'omitted' }, single, 'Sin dato'],
    [{ state: 'unknown' }, single, 'Desconocido'],
    [{ state: 'not_applicable' }, single, 'No aplica'],
    [{ state: 'known', payload: { type: 'single', value: 'dog' }, evidence: null }, single, 'Perro'],
    [{ state: 'known', payload: { type: 'single', value: 'lost' }, evidence: null }, single, 'lost'],
    [{ state: 'known', payload: { type: 'multi', value: ['dog', 'cat'] }, evidence: null }, single, 'Perro, Gato'],
    [{ state: 'known', payload: { type: 'multi', value: [] }, evidence: null }, single, 'Ninguno'],
    [{ state: 'known', payload: { type: 'boolean', value: true }, evidence: null }, single, 'Sí'],
    [{ state: 'known', payload: { type: 'boolean', value: false }, evidence: null }, single, 'No'],
    [{ state: 'known', payload: { type: 'number', value: '12', unit: 'kg' }, evidence: null }, number, '12 kg'],
    [{ state: 'known', payload: { type: 'number', value: '12', unit: null }, evidence: null }, number, '12'],
    [{ state: 'known', payload: { type: 'range', min: '1', max: '2', unit: 'kg' }, evidence: null }, number, '1–2 kg'],
    [{ state: 'known', payload: { type: 'text', value: 'Nylon' }, evidence: null }, undefined, 'Nylon'],
  ]
  it.each(cases)('%j → %s', (input, definition, expected) => {
    expect(editorialInputText(input, definition)).toBe(expected)
  })
})
