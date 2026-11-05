/**
 * T9 (S12) guidance, carried by the cells the section cards read (ported from the table component spec in
 * T13): «No aplica» is admitted only where the editorial policy admits it (the save check's own evaluation),
 * «Requerido para publicar» and «Interno» come from the policy, and a description is the field's help.
 */
import { describe, expect, it } from 'vitest'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialDeclaration } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialBinding, EditorialFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import { toEditorialFactsEditingState, type EditorialFactsEditingState } from '../editorial-contract-facts-editing'
import { buildEditorialContentSections, editorialRowCell } from '../editorial-content-sections'

const content = (parameter: 'measure.net_mass' | 'measure.net_volume'): EditorialBinding['policy'] => ({ route: 'fact_rule', rule: { family: 'food', ruleId: 'content', parameter } })
const optional = (parameter: 'measure.net_volume'): EditorialBinding['policy'] => ({ route: 'fact_rule', rule: { family: 'food', ruleId: 'optional', parameter } })
const binding = (code: string, owner: 'product' | 'sellable', policy: EditorialBinding['policy'], exposure: EditorialBinding['exposure'] = 'DETAIL'): EditorialBinding => ({
  definitionId: code, definitionCode: code, owner, sortOrder: 0, exposure, searchable: false, publicationCheck: 'when_asserted', policy,
})
const openCase: EditorialBinding['policy'] = { route: 'option_cases', cases: [{ code: 'open', when: [], applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'resolved' }] }
const closedCase: EditorialBinding['policy'] = { route: 'option_cases', cases: [{ code: 'closed', when: [], applicability: 'applicable', required: false, allowNA: false, evidenceRequired: true, documentary: 'resolved' }] }
const def = (code: string, label: string, description?: string | null): EditorialDefinition => ({ id: code, code, label, type: 'text', ...(description === undefined ? {} : { description }) })
const definitions: EditorialDefinition[] = [
  def('measure.net_mass', 'Peso neto'), def('measure.net_volume', 'Volumen neto'), def('material', 'Material'), def('origin', 'Origen'),
  def('text.clinical_analysis', 'Análisis clínico', 'Texto interno del equipo. No se publica.'),
]
const family: EditorialFamily = { id: 'food', code: 'food', label: 'Alimento', bindings: [
  binding('measure.net_mass', 'sellable', content('measure.net_mass')), binding('measure.net_volume', 'sellable', optional('measure.net_volume')),
  binding('material', 'product', openCase), binding('origin', 'product', closedCase), binding('text.clinical_analysis', 'product', { route: 'pending' }, 'INTERNAL'),
] }
const subjects = [{ variantId: 'v1', label: '3 kg' }, { variantId: 'v2', label: '1 kg' }]
const evidence = { sourceRef: 'Etiqueta', verifiedOn: '2026-01-01' }
const declared = (variantId: string, declarations: EditorialDeclaration[]) => {
  let counter = 0
  return toEditorialFactsEditingState([{ variantId, presentation: variantId, declarations, careReview: null }], () => `f${++counter}`)
}
const mass = declared('v1', [{ key: 'contentMagnitude', state: 'known', value: 'mass', evidence, basis: 'Etiqueta' }])
const volumeIsNotRelevant = declared('v1', [{ key: 'optionalNonpertinenceCodes', state: 'known', value: ['measure.net_volume'], evidence, basis: 'No lleva volumen' }])
function cell(label: string, variantId: string | null, facts: EditorialFactsEditingState = []) {
  const result = buildEditorialContentSections({ family, definitions, values: [], subjects, facts })
  const row = result.sections.flatMap(section => section.rows).find(item => item.label === label)!
  return { row, cell: editorialRowCell(result.table, row, variantId)! }
}

describe('«No aplica» only where the policy admits it', () => {
  it('admits it where an option case admits it, and not where none does', () => {
    expect(cell('Material', null).cell.naAdmitted).toBe(true)
    expect(cell('Origen', null).cell.naAdmitted).toBe(false)
  })

  it('admits it on an optional datum in every presentation, declared or not', () => {
    expect(cell('Volumen neto', 'v1').cell.naAdmitted).toBe(true)
    expect(cell('Volumen neto', 'v1', volumeIsNotRelevant).cell.naAdmitted).toBe(true)
    expect(cell('Volumen neto', 'v2', volumeIsNotRelevant).cell.naAdmitted).toBe(true)
  })

  it('never admits it for the weight of a food, whatever is declared', () => {
    expect(cell('Peso neto', 'v1', mass).cell.naAdmitted).toBe(false)
    expect(cell('Peso neto', 'v1').cell.naAdmitted).toBe(false)
  })
})

describe('«Requerido para publicar», «Interno» and the help', () => {
  it('requires the datum the policy requires once mass is declared, in that presentation only', () => {
    expect(cell('Peso neto', 'v1', mass).cell.required).toBe(true)
    expect(cell('Peso neto', 'v2', mass).cell.required).toBe(false)
    expect(cell('Volumen neto', 'v1', mass).cell.required).toBe(false)
    expect(cell('Peso neto', 'v1').cell.required).toBe(false)
  })

  it('marks the internal binding and carries a non-blank description as help', () => {
    expect(cell('Análisis clínico', null).row).toMatchObject({ internal: true, description: 'Texto interno del equipo. No se publica.' })
    expect(cell('Material', null).row).toMatchObject({ internal: false, description: null })
  })

  it.each([['absent', undefined], ['null', null], ['blank', '   '], ['empty', '']])('has no help when the description is %s', (_name, description) => {
    const result = buildEditorialContentSections({ family, subjects, values: [],
      definitions: definitions.map(item => (item.code === 'text.clinical_analysis' ? def(item.code, item.label, description) : item)) })
    expect(result.sections.flatMap(section => section.rows).find(item => item.label === 'Análisis clínico')!.description).toBeNull()
  })
})
