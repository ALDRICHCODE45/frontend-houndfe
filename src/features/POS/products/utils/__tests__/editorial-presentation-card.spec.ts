import { describe, expect, it } from 'vitest'
import type { EditorialDeclarationChoice } from '../editorial-contract-declaration-choices'
import type { EditorialFactsEditingRow } from '../editorial-contract-facts-editing'
import { resolveEditorialFactsInput } from '../editorial-contract-facts-input'
import { projectEditorialFactsEditingState } from '../editorial-contract-facts-editing'
import {
  applyEditorialCardSource, clearEditorialCardAnswers, copyEditorialCardAnswers, editorialCardQuestions, editorialCardSourceOf, editorialCardSummary,
  editorialSourceBasis, ensureEditorialFactsRow, isEditorialCardComplete, setEditorialCardAnswer, setEditorialOptionalNonpertinence,
  editorialShortDate,
} from '../editorial-presentation-card'

const choice = (key: EditorialDeclarationChoice['key'], choices: { code: string; label: string }[] = [], toyTypeChoices: { code: string; label: string }[] = []): EditorialDeclarationChoice =>
  ({ key, label: key, choices, toyTypeChoices })
// The content.kind options as the vocabulary delivers them: the measure question reads these labels.
const contentKinds = [{ code: 'mass', label: 'Masa' }, { code: 'volume', label: 'Volumen' }, { code: 'count', label: 'Conteo' }, { code: 'length', label: 'Longitud' }, { code: 'area', label: 'Superficie' }]
const food = [choice('contentMagnitude', contentKinds), choice('optionalNonpertinenceCodes', [{ code: 'measure.pack_count', label: 'Piezas por paquete' }])]
const accessory = [choice('contentMagnitude'), choice('fitDeterminesChoice'), choice('capacityDeterminesChoice'), choice('electricalApplies'),
  choice('relevantDimensionCodes', [{ code: 'measure.dimensions.external_length', label: 'Largo' }]),
  choice('relevantFitCodes', [{ code: 'measure.fit.neck', label: 'Cuello' }, { code: 'measure.fit.chest', label: 'Pecho' }]),
  choice('relevantCapacityCodes', [{ code: 'measure.capacity.container', label: 'Capacidad del recipiente' }]),
  choice('relevantEquipmentCodes', [{ code: 'measure.equipment.power', label: 'Potencia' }])]
const label = { sourceRef: 'Etiqueta del empaque', verifiedOn: '2026-11-04' }
let counter = 0
const nextId = () => `id-${++counter}`
const empty = (): EditorialFactsEditingRow => ({ id: 'r', variantId: null, presentation: 'Producto', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } })
const encode = (row: EditorialFactsEditingRow) => resolveEditorialFactsInput(projectEditorialFactsEditingState([row]))

describe('the questions of a card', () => {
  it('asks only what the family offers, in plain words, and never the hidden non-pertinence list', () => {
    expect(editorialCardQuestions(food, null).map(q => q.text)).toEqual(['¿Cómo se mide el contenido?'])
    expect(editorialCardQuestions(food, null)[0]!.options.map(o => o.label)).toEqual(['Masa', 'Volumen', 'Conteo', 'Longitud', 'Superficie'])
    const hygiene = [choice('contentMagnitude'), choice('consumable'), choice('animalApplied')]
    expect(editorialCardQuestions(hygiene, null).map(q => q.text)).toEqual(['¿Cómo se mide el contenido?', '¿Se consume?', '¿Se aplica sobre la mascota?'])
    expect(editorialCardQuestions([choice('presentationKind')], null)[0]!.options.map(o => o.label)).toEqual(['Fórmula', 'Dispositivo', 'Envase'])
  })

  it('reads the measure labels from the content.kind vocabulary, in the declaration order', () => {
    const renamed = [choice('contentMagnitude', [...contentKinds].reverse().map(kind => (kind.code === 'mass' ? { ...kind, label: 'Peso neto' } : kind)))]
    const options = editorialCardQuestions(renamed, null)[0]!.options
    expect(options).toEqual([{ value: 'mass', label: 'Peso neto' }, { value: 'volume', label: 'Volumen' }, { value: 'count', label: 'Conteo' },
      { value: 'length', label: 'Longitud' }, { value: 'area', label: 'Superficie' }])
    const row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, label, nextId)
    expect(editorialCardSummary(editorialCardQuestions(renamed, row), label, new Date(2026, 10, 4))).toBe('Se mide en peso neto · Etiqueta del empaque · 4 nov')
  })

  it('falls back to its own label for a magnitude the vocabulary does not offer', () => {
    const partial = [choice('contentMagnitude', contentKinds.filter(kind => kind.code !== 'area'))]
    expect(editorialCardQuestions(partial, null)[0]!.options.map(o => o.label)).toEqual(['Masa', 'Volumen', 'Conteo', 'Longitud', 'Área'])
    expect(editorialCardQuestions([choice('contentMagnitude')], null)[0]!.options.map(o => o.label)).toEqual(['Peso', 'Volumen', 'Piezas', 'Largo', 'Área'])
    const row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'area' }, label, nextId)
    expect(editorialCardSummary(editorialCardQuestions(partial, row), label, new Date(2026, 10, 4))).toBe('Se mide en área · Etiqueta del empaque · 4 nov')
  })

  it('shows a follow-up list only once its question is answered Sí', () => {
    expect(editorialCardQuestions(accessory, null).map(q => q.key)).toEqual(['contentMagnitude', 'fitDeterminesChoice', 'capacityDeterminesChoice', 'electricalApplies', 'relevantDimensionCodes'])
    const row = setEditorialCardAnswer(empty(), 'fitDeterminesChoice', { state: 'known', value: true }, label, nextId)
    const fit = editorialCardQuestions(accessory, row).find(q => q.key === 'relevantFitCodes')!
    expect(fit.text).toBe('¿Qué medidas de talla cuentan?')
    expect(fit.kind).toBe('many')
    expect(fit.options.map(o => o.label)).toEqual(['Cuello', 'Pecho'])
  })
})

describe('answers write the declarations', () => {
  it('an answer writes a known declaration with the source as evidence and a generated Fundamento', () => {
    const row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, label, nextId)
    expect(row.declarations.map(d => d.input)).toEqual([{ key: 'contentMagnitude', state: 'known', value: 'mass', evidence: label, basis: 'Según la etiqueta del empaque.' }])
    const encoded = encode(row)
    expect(encoded.status).toBe('complete')
  })

  it('No sé writes the unknown state with no evidence', () => {
    const row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'unknown' }, label, nextId)
    expect(row.declarations.map(d => d.input)).toEqual([{ key: 'contentMagnitude', state: 'unknown' }])
    expect(encode(row)).toEqual({ status: 'complete', facts: [{ variantId: null, presentation: 'Producto', careReview: null, declarations: [{ key: 'contentMagnitude', state: 'unknown', evidence: null }] }] })
  })

  it('an answer without a source stays incomplete, so the save is blocked', () => {
    const row = setEditorialCardAnswer(empty(), 'consumable', { state: 'known', value: false }, { sourceRef: '', verifiedOn: '2026-11-04' }, nextId)
    expect(row.declarations[0]!.input).toMatchObject({ state: 'known', value: false, evidence: null, basis: '' })
    expect(encode(row).status).toBe('incomplete')
  })

  it('changing an answer keeps one declaration per key, and clearing it removes the declaration', () => {
    let row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, label, nextId)
    row = setEditorialCardAnswer(row, 'contentMagnitude', { state: 'known', value: 'volume' }, label, nextId)
    expect(row.declarations).toHaveLength(1)
    expect(row.declarations[0]!.input).toMatchObject({ value: 'volume' })
    expect(setEditorialCardAnswer(row, 'contentMagnitude', null, label, nextId).declarations).toEqual([])
  })

  it('an answer keeps the declarations the card does not ask about, in their order', () => {
    const stored: EditorialFactsEditingRow = { ...empty(), declarations: [{ id: 'old', declarationKey: 'presentationKind', input: { key: 'presentationKind', state: 'unknown' } }] }
    const row = setEditorialCardAnswer(stored, 'contentMagnitude', { state: 'known', value: 'mass' }, label, nextId)
    expect(row.declarations.map(d => [d.id, d.declarationKey])).toEqual([['old', 'presentationKind'], [expect.any(String), 'contentMagnitude']])
    expect(stored.declarations).toHaveLength(1)
  })

  it('answering No to a follow-up question drops the follow-up list', () => {
    let row = setEditorialCardAnswer(empty(), 'fitDeterminesChoice', { state: 'known', value: true }, label, nextId)
    row = setEditorialCardAnswer(row, 'relevantFitCodes', { state: 'known', value: ['measure.fit.neck'] }, label, nextId)
    row = setEditorialCardAnswer(row, 'fitDeterminesChoice', { state: 'known', value: false }, label, nextId)
    expect(row.declarations.map(d => d.declarationKey)).toEqual(['fitDeterminesChoice'])
  })

  it('a new source rewrites the evidence and Fundamento of every known answer, and Otro uses its own words', () => {
    let row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, { sourceRef: '', verifiedOn: '2026-11-04' }, nextId)
    row = setEditorialCardAnswer(row, 'consumable', { state: 'unknown' }, { sourceRef: '', verifiedOn: '2026-11-04' }, nextId)
    row = applyEditorialCardSource(row, { sourceRef: 'Catálogo 2026', verifiedOn: '2026-10-01' })
    expect(row.declarations[0]!.input).toMatchObject({ evidence: { sourceRef: 'Catálogo 2026', verifiedOn: '2026-10-01' }, basis: 'Según catálogo 2026.' })
    expect(row.declarations[1]!.input).toEqual({ key: 'consumable', state: 'unknown' })
    expect(editorialCardSourceOf(row)).toEqual({ sourceRef: 'Catálogo 2026', verifiedOn: '2026-10-01' })
  })

  it('writes the Fundamento of each named source', () => {
    expect(editorialSourceBasis('Etiqueta del empaque')).toBe('Según la etiqueta del empaque.')
    expect(editorialSourceBasis('Ficha del fabricante')).toBe('Según la ficha del fabricante.')
    expect(editorialSourceBasis('Sitio del fabricante')).toBe('Según el sitio del fabricante.')
    expect(editorialSourceBasis('  ')).toBe('')
  })
})

describe('the facts row', () => {
  it('is created on demand, prefilled with the presentation name, and reused after', () => {
    counter = 0
    const first = ensureEditorialFactsRow([], { variantId: 'v1', presentation: 'Talla M' }, nextId)
    expect(first.row).toEqual({ id: 'id-1', variantId: 'v1', presentation: 'Talla M', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } })
    expect(ensureEditorialFactsRow(first.state, { variantId: 'v1', presentation: 'otro' }, nextId).row).toBe(first.row)
  })

  it('clearing the answers keeps the hidden non-pertinence list that the table relies on', () => {
    let row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, label, nextId)
    row = setEditorialOptionalNonpertinence(row, 'measure.pack_count', true, label, nextId)
    expect(clearEditorialCardAnswers(row)!.declarations.map(d => d.declarationKey)).toEqual(['optionalNonpertinenceCodes'])
    expect(clearEditorialCardAnswers(setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'unknown' }, label, nextId))).toBeNull()
  })
})

describe('optional non-pertinence', () => {
  it('adds the code with the card source, then removes it and the declaration once empty', () => {
    let row = setEditorialOptionalNonpertinence(empty(), 'measure.pack_count', true, label, nextId)
    expect(row.declarations.map(d => d.input)).toEqual([{ key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.pack_count'], evidence: label, basis: 'Según la etiqueta del empaque.' }])
    row = setEditorialOptionalNonpertinence(row, 'color.base', true, label, nextId)
    expect(row.declarations[0]!.input).toMatchObject({ value: ['measure.pack_count', 'color.base'] })
    row = setEditorialOptionalNonpertinence(row, 'measure.pack_count', false, label, nextId)
    expect(row.declarations[0]!.input).toMatchObject({ value: ['color.base'] })
    expect(setEditorialOptionalNonpertinence(row, 'color.base', false, label, nextId).declarations).toEqual([])
  })
})

describe('the collapsed card', () => {
  it('summarizes the answers and the source in one line', () => {
    let row = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, label, nextId)
    const questions = editorialCardQuestions(food, row)
    expect(isEditorialCardComplete(questions, label)).toBe(true)
    expect(editorialCardSummary(questions, label, new Date(2026, 10, 4))).toBe('Se mide en masa · Etiqueta del empaque · 4 nov')
    row = setEditorialCardAnswer(row, 'contentMagnitude', { state: 'unknown' }, label, nextId)
    expect(editorialCardSummary(editorialCardQuestions(food, row), label, new Date(2026, 10, 4))).toBe('Medida: no se sabe · Etiqueta del empaque · 4 nov')
    expect(isEditorialCardComplete(editorialCardQuestions(food, null), label)).toBe(false)
    expect(isEditorialCardComplete(questions, { sourceRef: '', verifiedOn: '2026-11-04' })).toBe(false)
  })

  it('writes a short date, with the year only when it is not the current one', () => {
    expect(editorialShortDate('2026-11-04', new Date(2026, 0, 1))).toBe('4 nov')
    expect(editorialShortDate('2025-03-12', new Date(2026, 0, 1))).toBe('12 mar 2025')
  })
})

describe('copying the answers of another presentation', () => {
  it('writes the same declarations with the source as evidence and Fundamento, keeping this row\'s "No aplica" list', () => {
    const maker = { sourceRef: 'Ficha del fabricante', verifiedOn: '2026-10-01' }
    let from = setEditorialCardAnswer(empty(), 'contentMagnitude', { state: 'known', value: 'mass' }, maker, nextId)
    from = setEditorialCardAnswer(from, 'fitDeterminesChoice', { state: 'known', value: true }, maker, nextId)
    from = setEditorialCardAnswer(from, 'relevantFitCodes', { state: 'known', value: ['measure.fit.neck'] }, maker, nextId)
    from = setEditorialCardAnswer(from, 'electricalApplies', { state: 'unknown' }, maker, nextId)
    from = setEditorialOptionalNonpertinence(from, 'measure.pack_count', true, maker, nextId)
    const target = setEditorialOptionalNonpertinence({ ...empty(), id: 't', variantId: 'v2', presentation: 'Grande · Negro' }, 'measure.net_mass', true, label, nextId)
    const copied = copyEditorialCardAnswers(from, target, maker, nextId)
    expect(copied).toMatchObject({ id: 't', variantId: 'v2', presentation: 'Grande · Negro', careReview: { state: 'omitted' } })
    const known = (key: string, value: unknown) => ({ key, state: 'known', value, evidence: maker, basis: 'Según la ficha del fabricante.' })
    expect(copied.declarations.map(d => d.input)).toEqual([
      { key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.net_mass'], evidence: label, basis: 'Según la etiqueta del empaque.' },
      known('contentMagnitude', 'mass'), known('fitDeterminesChoice', true), known('relevantFitCodes', ['measure.fit.neck']),
      { key: 'electricalApplies', state: 'unknown' }])
    expect(new Set(copied.declarations.map(d => d.id)).size).toBe(5)
    expect(copied.declarations.some(d => from.declarations.some(f => f.id === d.id))).toBe(false)
    expect(encode(copied).status).toBe('complete')
    // The source row is untouched.
    expect(from.declarations.map(d => d.declarationKey)).toContain('optionalNonpertinenceCodes')
  })
})
