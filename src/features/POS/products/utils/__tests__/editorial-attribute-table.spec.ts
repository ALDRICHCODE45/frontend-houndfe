import { describe, expect, it } from 'vitest'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialBinding, EditorialFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentInput } from '../editorial-contract-assignment-input'
import type { EditorialAssignmentEditingRow } from '../editorial-contract-document-editing'
import { toEditorialFactsEditingState } from '../editorial-contract-facts-editing'
import {
  applyEditorialCellInput, buildEditorialAttributeTable, isEditorialInputFilled, removeEditorialCell,
} from '../editorial-attribute-table'

const binding = (code: string, owner: 'product' | 'sellable', sortOrder = 0): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder, exposure: 'DETAIL', searchable: false,
  publicationCheck: 'when_asserted', policy: { route: 'pending' },
})
const definitions: EditorialDefinition[] = [
  { id: 'animal.target', code: 'animal.target', label: 'Especie', type: 'single', groups: [], aliases: [], options: [{ code: 'dog', label: 'Perro', archived: false, sortOrder: 0 }] },
  { id: 'material', code: 'material', label: 'Material', type: 'text' },
  { id: 'measure.net_mass', code: 'measure.net_mass', label: 'Peso neto', type: 'number', units: [{ code: 'kg', label: 'kg', sortOrder: 0 }], numericPolicy: { status: 'pending' } },
]
const family: EditorialFamily = { id: 'food', code: 'food', label: 'Alimento', bindings: [
  binding('measure.net_mass', 'sellable', 2), binding('animal.target', 'product', 0), binding('material', 'product', 1),
] }
const subjects = [{ variantId: 'v1', label: '15 kg' }, { variantId: 'v2', label: '7.5 kg' }]
const row = (id: string, code: string, owner: 'product' | 'sellable', variantId: string | null, input: EditorialAssignmentEditingRow['input']): EditorialAssignmentEditingRow =>
  ({ id, target: { code, owner, variantId }, input })
const known = (value: string) => ({ state: 'known' as const, payload: { type: 'text' as const, value }, evidence: null })
const build = (values: EditorialAssignmentEditingRow[] = [], overrides: Partial<Parameters<typeof buildEditorialAttributeTable>[0]> = {}) =>
  buildEditorialAttributeTable({ family, definitions, values, subjects, ...overrides })

describe('buildEditorialAttributeTable', () => {
  it('lists the family definitions by human label, never by code', () => {
    const table = build()
    expect(table.rows.map(item => item.label)).toEqual(['Especie', 'Material', 'Peso neto'])
    expect(JSON.stringify(table.rows.map(item => item.label))).not.toContain('animal.target')
  })

  it('has a Producto column plus one per presentation, with cells only where the binding allows the target', () => {
    const table = build()
    expect(table.columns.map(column => column.label)).toEqual(['Producto', '15 kg', '7.5 kg'])
    const byLabel = Object.fromEntries(table.rows.map(item => [item.label, item.cells.map(cell => (cell ? (cell.target.variantId ?? 'product') : 'none'))]))
    expect(byLabel['Especie']).toEqual(['product', 'none', 'none'])
    expect(byLabel['Peso neto']).toEqual(['none', 'v1', 'v2'])
    expect(table.rows.find(item => item.label === 'Peso neto')!.cells[1]!.target.owner).toBe('sellable')
  })

  it('drops a column when no binding allows it', () => {
    const onlyProduct = { ...family, bindings: [binding('animal.target', 'product')] }
    expect(build([], { family: onlyProduct }).columns.map(column => column.label)).toEqual(['Producto'])
    const onlySellable = { ...family, bindings: [binding('measure.net_mass', 'sellable')] }
    expect(build([], { family: onlySellable }).columns.map(column => column.label)).toEqual(['15 kg', '7.5 kg'])
  })

  it('offers one presentation column for a product without variants', () => {
    const table = build([], { subjects: [{ variantId: null, label: 'Sin presentación' }] })
    expect(table.columns.map(column => column.label)).toEqual(['Producto', 'Sin presentación'])
    expect(table.rows.find(item => item.label === 'Peso neto')!.cells[1]!.target).toEqual({ code: 'measure.net_mass', owner: 'sellable', variantId: null })
  })

  it('calls the only column Producto when the data lives on the product itself, without variants', () => {
    const onlySellable = { ...family, bindings: [binding('measure.net_mass', 'sellable')] }
    const table = build([], { family: onlySellable, subjects: [{ variantId: null, label: 'Sin presentación' }] })
    expect(table.columns.map(column => column.label)).toEqual(['Producto'])
    expect(table.rows[0]!.cells[0]!.target).toEqual({ code: 'measure.net_mass', owner: 'sellable', variantId: null })
  })

  it('reads each cell from its assignment and keeps absent ones omitted', () => {
    const table = build([row('a', 'material', 'product', null, known('Nylon')), row('b', 'animal.target', 'product', null, { state: 'unknown' })])
    const material = table.rows.find(item => item.label === 'Material')!.cells[0]!
    expect(material).toMatchObject({ rowId: 'a', input: known('Nylon'), filled: true })
    expect(table.rows.find(item => item.label === 'Especie')!.cells[0]).toMatchObject({ rowId: 'b', filled: true })
    expect(table.rows.find(item => item.label === 'Peso neto')!.cells[1]).toMatchObject({ rowId: null, input: { state: 'omitted' }, filled: false })
  })

  it('counts answered cells over the total, so unknown and not applicable count as answered', () => {
    const table = build([row('a', 'material', 'product', null, known('Nylon')), row('b', 'animal.target', 'product', null, { state: 'not_applicable' })])
    expect(table).toMatchObject({ answered: 2, total: 4, missing: 2 })
  })

  it('does not count an emptied known value as answered', () => {
    const table = build([row('a', 'material', 'product', null, known('  '))])
    expect(table).toMatchObject({ answered: 0, total: 4 })
  })

  it('keeps stored assignments that are not in the table out of the grid and counts them', () => {
    const table = build([row('x', 'gone.code', 'product', null, known('1')), row('y', 'material', 'product', null, known('a')), row('z', 'material', 'product', null, known('b')),
      row('w', 'material', 'product', null, { state: 'omitted' })])
    expect(table.orphanCount).toBe(2)
    expect(table.rows.find(item => item.label === 'Material')!.cells[0]!.rowId).toBe('y')
  })

  it('has no rows for a missing or unknown family', () => {
    expect(build([], { family: null }).rows).toEqual([])
    expect(build([], { family: null }).columns).toEqual([])
  })
})

describe('isEditorialInputFilled', () => {
  const cases: [EditorialAssignmentInput, boolean][] = [
    [{ state: 'omitted' }, false], [{ state: 'unknown' }, true], [{ state: 'not_applicable' }, true],
    [known(''), false], [known('a'), true],
    [{ state: 'known', payload: { type: 'boolean', value: null }, evidence: null }, false],
    [{ state: 'known', payload: { type: 'boolean', value: false }, evidence: null }, true],
    [{ state: 'known', payload: { type: 'single', value: null }, evidence: null }, false],
    [{ state: 'known', payload: { type: 'multi', value: [] }, evidence: null }, false],
    [{ state: 'known', payload: { type: 'multi', value: ['a'] }, evidence: null }, true],
    [{ state: 'known', payload: { type: 'number', value: '' }, evidence: null }, false],
    [{ state: 'known', payload: { type: 'number', value: '0', unit: null }, evidence: null }, true],
    [{ state: 'known', payload: { type: 'range', min: '', max: '' }, evidence: null }, false],
    [{ state: 'known', payload: { type: 'range', min: '1', max: '' }, evidence: null }, true],
  ]
  it.each(cases)('%j → %s', (input, expected) => {
    expect(isEditorialInputFilled(input)).toBe(expected)
  })
})

describe('applyEditorialCellInput', () => {
  const cell = { target: { code: 'material', owner: 'product' as const, variantId: null } }
  const ids = () => { let n = 0; return () => `new-${++n}` }

  it('creates the assignment when an empty cell gets a value', () => {
    const next = applyEditorialCellInput([], { ...cell, rowId: null }, known('Nylon'), ids())
    expect(next).toEqual([{ id: 'new-1', target: cell.target, input: known('Nylon') }])
  })

  it('creates the assignment when an empty cell gets a state', () => {
    expect(applyEditorialCellInput([], { ...cell, rowId: null }, { state: 'unknown' }, ids())[0]!.input).toEqual({ state: 'unknown' })
    expect(applyEditorialCellInput([], { ...cell, rowId: null }, { state: 'not_applicable' }, ids())[0]!.input).toEqual({ state: 'not_applicable' })
  })

  it('updates the same row in place and leaves every other row untouched', () => {
    const other = row('o', 'animal.target', 'product', null, { state: 'unknown' })
    const current = [other, row('a', 'material', 'product', null, known('Nylon'))]
    const next = applyEditorialCellInput(current, { ...cell, rowId: 'a' }, known('Cuero'), ids())
    expect(next).toEqual([other, { id: 'a', target: cell.target, input: known('Cuero') }])
    expect(next[0]).toBe(other)
    expect(current[1]!.input).toEqual(known('Nylon'))
  })

  it('removes the row when the value is emptied, instead of keeping an unsavable blank', () => {
    const current = [row('a', 'material', 'product', null, known('Nylon'))]
    expect(applyEditorialCellInput(current, { ...cell, rowId: 'a' }, known(''), ids())).toEqual([])
    expect(applyEditorialCellInput([], { ...cell, rowId: null }, known(''), ids())).toEqual([])
  })

  it('keeps a whitespace-only text exactly as typed', () => {
    expect(applyEditorialCellInput([], { ...cell, rowId: null }, known(' '), ids())[0]!.input).toEqual(known(' '))
  })
})

describe('removeEditorialCell', () => {
  it('removes only the requested row, keeping duplicates of the same target', () => {
    const current = [row('a', 'material', 'product', null, known('1')), row('b', 'material', 'product', null, known('2'))]
    expect(removeEditorialCell(current, 'a').map(item => item.id)).toEqual(['b'])
    expect(removeEditorialCell(current, 'missing')).toEqual(current)
  })
})

describe('buildEditorialAttributeTable — guidance', () => {
  const rule = (ruleId: 'content' | 'optional', parameter: 'measure.net_mass' | 'measure.net_volume'): EditorialBinding['policy'] => ({ route: 'fact_rule', rule: { family: 'food', ruleId, parameter } })
  const guided: EditorialFamily = { id: 'food', code: 'food', label: 'Alimento', bindings: [
    { ...binding('measure.net_mass', 'sellable'), policy: rule('content', 'measure.net_mass') },
    { ...binding('animal.target', 'product'), exposure: 'INTERNAL' },
  ] }
  const described: EditorialDefinition[] = definitions.map(item => (item.code === 'animal.target' ? { ...item, description: 'Para qué especie es.' } : item))
  const evidence = { sourceRef: 'Etiqueta', verifiedOn: '2026-01-01' }
  const facts = toEditorialFactsEditingState([{ variantId: 'v1', presentation: '15 kg', careReview: null,
    declarations: [{ key: 'contentMagnitude', state: 'known', value: 'mass', evidence, basis: 'Etiqueta' }] }], () => 'f')

  it('flags a required cell from the rule result of its own presentation', () => {
    const table = build([], { family: guided, facts })
    const mass = table.rows.find(item => item.label === 'Peso neto')!
    expect(mass.cells.map(cell => cell?.required ?? null)).toEqual([null, true, false])
    expect(mass.cells.map(cell => cell?.naAdmitted ?? null)).toEqual([null, false, false])
  })

  it('carries the exposure and the optional description on the row', () => {
    const table = build([], { family: guided, definitions: described, facts })
    expect(table.rows.find(item => item.label === 'Especie')).toMatchObject({ internal: true, description: 'Para qué especie es.' })
    expect(table.rows.find(item => item.label === 'Peso neto')).toMatchObject({ internal: false, description: null })
  })

  it('treats an unresolved policy as not admitting "No aplica" and not required', () => {
    const table = build()
    expect(table.rows.flatMap(item => item.cells).filter(Boolean).every(cell => !cell!.naAdmitted && !cell!.required)).toBe(true)
  })
})
