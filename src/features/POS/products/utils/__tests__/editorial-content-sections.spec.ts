/**
 * T13 (S15): the attribute sections of the Contenido cards come from the BE vocabulary
 * (L75: families[].sections, bindings[].sectionCode/sectionSortOrder, all optional).
 */
import { describe, expect, it } from 'vitest'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialBinding, EditorialFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentEditingRow } from '../editorial-contract-document-editing'
import { buildEditorialContentSections, editorialRowCell } from '../editorial-content-sections'

const binding = (code: string, owner: 'product' | 'sellable', section?: { code: string; order?: number }): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure: 'DETAIL', searchable: false,
  publicationCheck: 'when_asserted', policy: { route: 'pending' },
  ...(section ? { sectionCode: section.code, ...(section.order === undefined ? {} : { sectionSortOrder: section.order }) } : {}),
})
const text = (code: string, label: string): EditorialDefinition => ({ id: code, code, label, type: 'text' })
const definitions: EditorialDefinition[] = [
  text('animal.target', 'Especie'), text('animal.life_stage', 'Etapa de vida'), text('food.format', 'Formato del alimento'),
  text('food.texture', 'Textura'), text('ingredients', 'Ingredientes'), text('measure.net_mass', 'Peso neto'), text('usage', 'Instrucciones de uso'),
]
const sections = [
  { code: 'content', label: 'Contenido y empaque', sortOrder: 40 },
  { code: 'who', label: 'Para quién', sortOrder: 10 },
  { code: 'what', label: 'Qué es', sortOrder: 20 },
  { code: 'empty', label: 'Sin datos', sortOrder: 5 },
]
const food: EditorialFamily = { id: 'food', code: 'food', label: 'Alimento', sections, bindings: [
  binding('measure.net_mass', 'sellable', { code: 'content', order: 1 }),
  binding('food.texture', 'product', { code: 'what', order: 2 }),
  binding('food.format', 'product', { code: 'what', order: 1 }),
  binding('animal.life_stage', 'product', { code: 'who', order: 3 }),
  binding('animal.target', 'product', { code: 'who', order: 1 }),
  binding('ingredients', 'product'),
  binding('usage', 'product', { code: 'gone' }),
] }
const single: { variantId: string | null; label: string }[] = [{ variantId: null, label: 'Presentación' }]
const collar = [{ variantId: 'v1', label: 'Chico · Azul' }, { variantId: 'v2', label: 'Mediano · Rojo' }, { variantId: 'v3', label: 'Grande · Negro' }]
const value = (id: string, code: string, owner: 'product' | 'sellable', variantId: string | null, input: EditorialAssignmentEditingRow['input']): EditorialAssignmentEditingRow =>
  ({ id, target: { code, owner, variantId }, input })
const known = (text: string) => ({ state: 'known' as const, payload: { type: 'text' as const, value: text }, evidence: null })
const build = (family: EditorialFamily | null, values: EditorialAssignmentEditingRow[] = [], subjects = single) =>
  buildEditorialContentSections({ family, definitions, values, subjects })
const shape = (result: ReturnType<typeof build>) => result.sections.map(section => [section.label, section.rows.map(row => row.label)])

describe('buildEditorialContentSections — order and fallbacks', () => {
  it('orders the sections by sortOrder (gaps allowed), the bindings by sectionSortOrder, and skips a section with no data', () => {
    expect(shape(build(food))).toEqual([
      ['Para quién', ['Especie', 'Etapa de vida']],
      ['Qué es', ['Formato del alimento', 'Textura']],
      ['Contenido y empaque', ['Peso neto']],
      ['Otros datos', ['Ingredientes', 'Instrucciones de uso']],
    ])
  })

  it('keeps the current label order inside a section when sectionSortOrder is missing or tied', () => {
    const family = { ...food, bindings: [binding('food.texture', 'product', { code: 'what' }), binding('food.format', 'product', { code: 'what' }),
      binding('animal.target', 'product', { code: 'what', order: 1 }), binding('animal.life_stage', 'product', { code: 'what', order: 1 })] }
    expect(shape(build(family))).toEqual([['Qué es', ['Especie', 'Etapa de vida', 'Formato del alimento', 'Textura']]])
  })

  it('puts the bindings without a known section in a last «Otros datos» section', () => {
    expect(build(food).sections[build(food).sections.length - 1]).toMatchObject({ code: null, label: 'Otros datos' })
  })

  it('uses one «Datos» section when the family has no sections at all (starter keys omitted)', () => {
    const starter: EditorialFamily = { id: 'f', code: 'f', label: 'F', bindings: [binding('food.texture', 'product'), binding('animal.target', 'product')] }
    expect(shape(build(starter))).toEqual([['Datos', ['Especie', 'Textura']]])
  })

  it('has no sections and nothing missing without a family', () => {
    expect(build(null)).toMatchObject({ sections: [], missing: 0 })
  })

  it('gives every section a unique, stable DOM id', () => {
    const ids = build(food).sections.map(section => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe(build(food).sections[0]!.id)
  })

  it('flags the sections that hold per-presentation data', () => {
    expect(build(food).sections.map(section => section.perPresentation)).toEqual([false, false, true, false])
  })
})

describe('buildEditorialContentSections — counts', () => {
  it('food (one presentation): a field is missing until it has a value or an explicit special answer', () => {
    const result = build(food, [
      value('a', 'animal.target', 'product', null, known('Perro')),
      value('b', 'animal.life_stage', 'product', null, { state: 'unknown' }),
      value('c', 'food.texture', 'product', null, { state: 'not_applicable' }),
      value('d', 'measure.net_mass', 'sellable', null, known('3')),
      value('e', 'ingredients', 'product', null, known('  ')),
    ])
    expect(result.sections.map(section => section.missing)).toEqual([0, 1, 0, 2])
    expect(result.missing).toBe(3)
  })

  it('the collar (three presentations): a per-presentation field is missing while any presentation lacks it', () => {
    const result = build(food, [
      value('a', 'measure.net_mass', 'sellable', 'v1', known('1')),
      value('b', 'measure.net_mass', 'sellable', 'v2', { state: 'unknown' }),
    ], collar)
    expect(result.sections.find(section => section.label === 'Contenido y empaque')!.missing).toBe(1)
    const filled = build(food, [
      value('a', 'measure.net_mass', 'sellable', 'v1', known('1')),
      value('b', 'measure.net_mass', 'sellable', 'v2', { state: 'unknown' }),
      value('c', 'measure.net_mass', 'sellable', 'v3', { state: 'not_applicable' }),
    ], collar)
    expect(filled.sections.find(section => section.label === 'Contenido y empaque')!.missing).toBe(0)
    expect(filled.missing).toBe(result.missing - 1)
  })

  it('«Faltan N» is the sum of the sections', () => {
    const result = build(food, [], collar)
    expect(result.missing).toBe(result.sections.reduce((sum, section) => sum + section.missing, 0))
    expect(result.missing).toBe(7)
  })
})

describe('editorialRowCell — the presentation being edited', () => {
  it('a product field is shared; a per-presentation field follows the chosen presentation', () => {
    const result = build(food, [value('a', 'measure.net_mass', 'sellable', 'v2', known('2'))], collar)
    const mass = result.sections.find(section => section.label === 'Contenido y empaque')!.rows[0]!
    const species = result.sections[0]!.rows[0]!
    expect(editorialRowCell(result.table, mass, 'v2')?.target).toEqual({ code: 'measure.net_mass', owner: 'sellable', variantId: 'v2' })
    expect(editorialRowCell(result.table, mass, 'v2')?.rowId).toBe('a')
    expect(editorialRowCell(result.table, mass, 'v1')?.rowId).toBeNull()
    expect(editorialRowCell(result.table, species, 'v3')?.target).toEqual({ code: 'animal.target', owner: 'product', variantId: null })
  })
})
