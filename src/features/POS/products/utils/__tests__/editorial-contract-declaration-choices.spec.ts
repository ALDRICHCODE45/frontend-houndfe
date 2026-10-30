import { describe, expect, it } from 'vitest'
import type { EditorialDeclaration } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialBinding, EditorialFamily, EditorialProductionFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES as codes } from '../../interfaces/editorial-production-codes'
import { projectEditorialDeclarationChoices as project } from '../editorial-contract-declaration-choices'
import { inspectEditorialFactsReferences as inspect } from '../editorial-contract-facts-references'
const labels = [
  ['contentMagnitude', 'Magnitud del contenido'], ['consumable', 'Consumible'], ['animalApplied', 'Aplicado al animal'],
  ['fitDeterminesChoice', 'El ajuste determina la elección'], ['capacityDeterminesChoice', 'La capacidad determina la elección'],
  ['electricalApplies', 'Aplica electricidad'], ['relevantDimensionCodes', 'Dimensiones relevantes'],
  ['relevantFitCodes', 'Medidas de ajuste relevantes'], ['relevantCapacityCodes', 'Capacidades relevantes'],
  ['relevantEquipmentCodes', 'Especificaciones de equipo relevantes'], ['presentationKind', 'Tipo de presentación'],
  ['optionalNonpertinenceCodes', 'Códigos opcionales no pertinentes'],
] as const
const allowed: Record<string, readonly string[]> = {
  food: ['contentMagnitude', 'optionalNonpertinenceCodes'], treat: ['contentMagnitude', 'optionalNonpertinenceCodes'],
  toy: ['contentMagnitude', 'relevantDimensionCodes', 'optionalNonpertinenceCodes'],
  hygiene: ['contentMagnitude', 'consumable', 'animalApplied', 'relevantDimensionCodes', 'optionalNonpertinenceCodes'],
  accessory: ['contentMagnitude', 'fitDeterminesChoice', 'capacityDeterminesChoice', 'electricalApplies', 'relevantDimensionCodes', 'relevantFitCodes', 'relevantCapacityCodes', 'relevantEquipmentCodes', 'optionalNonpertinenceCodes'],
  habitat: ['contentMagnitude', 'electricalApplies', 'relevantDimensionCodes', 'relevantCapacityCodes', 'relevantEquipmentCodes', 'optionalNonpertinenceCodes'],
  care: ['contentMagnitude', 'relevantDimensionCodes', 'presentationKind', 'optionalNonpertinenceCodes'],
  custom: ['contentMagnitude', 'optionalNonpertinenceCodes'],
}
function fixture(code = 'accessory', bound: readonly string[] = []) {
  const family: EditorialFamily = { id: 'family', code, label: 'Family', bindings: bound.map((definitionCode, i) => ({
    definitionId: 'id-' + i, definitionCode, sortOrder: -i, owner: 'product', exposure: 'INTERNAL',
    searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' },
  })) }
  const definitions: EditorialDefinition[] = bound.map((code, i) => ({ id: 'id-' + i, code, label: ' Etiqueta ', type: 'text' }))
  return { family, definitions }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function choices(input: ReturnType<typeof fixture>, key: EditorialDeclaration['key']) {
  const entry = project(input).find(entry => entry.key === key)
  expect(entry).toBeDefined()
  return entry!
}
describe('declaration display choices', () => {
  it.each(Object.entries(allowed))('retains %s zero-binding keys and Spanish order independently of values', (code, keys) => {
    const input = freeze(fixture(code)), before = JSON.stringify(input)
    expect(project(input)).toEqual(labels.filter(([key]) => keys.includes(key)).map(([key, label]) => ({ key, label, choices: [], toyTypeChoices: [] })))
    expect(JSON.stringify(input)).toBe(before)
    // Genuine unknown declaration fixtures pin reference parity; production never probes the inspector.
    for (const [key] of labels) {
      const issues = inspect({ family: input.family, vocabulary: { semanticsVersion: 'editorial-production-1', families: [input.family], definitions: [] },
        context: { variants: [] }, facts: [{ variantId: null, presentation: '', careReview: null, declarations: [{ key, state: 'unknown', evidence: null }] }] })
      expect(issues.length === 0).toBe(keys.includes(key))
    }
  })
  it('offers nothing without a selected family', () => { expect(project({ family: null, definitions: [] })).toEqual([]) })
  it.each(['__proto__', 'constructor', 'toString', 'TOY', 'toy '])('treats %s as an exact custom family', code => {
    expect(project(fixture(code)).map(row => row.key)).toEqual(allowed.custom)
  })
  const axes = [
    ['relevantDimensionCodes', ['measure.dimensions.external_length', 'measure.dimensions.external_width', 'measure.dimensions.external_height', 'measure.dimensions.external_diameter', 'measure.dimensions.internal_length', 'measure.dimensions.internal_width', 'measure.dimensions.internal_height', 'measure.dimensions.internal_diameter']],
    ['relevantFitCodes', ['measure.fit.neck', 'measure.fit.chest', 'measure.fit.back_length']],
    ['relevantCapacityCodes', ['measure.capacity.container', 'measure.capacity.habitat_usable_volume']],
    ['relevantEquipmentCodes', ['measure.equipment.power', 'measure.equipment.voltage', 'measure.equipment.frequency', 'measure.equipment.flow', 'measure.equipment.temperature']],
  ] as const
  it.each(axes)('intersects exact %s members, preserving binding order and labels', (key, members) => {
    const bound = [...members].reverse(), input = freeze(fixture(key === 'relevantCapacityCodes' ? 'habitat' : 'accessory',
      [...bound, 'measure.dimensions.fake', 'measure.fit.fake', 'measure.capacity.fake', 'measure.equipment.fake', 'custom'] ))
    expect(choices(input, key).choices).toEqual(bound.map(code => ({ code, label: ' Etiqueta ' })))
  })
  it('limits accessory capacity without filtering owner, exposure or publication flags', () => {
    const input = fixture('accessory', ['measure.capacity.habitat_usable_volume', 'measure.capacity.container'])
    expect(choices(input, 'relevantCapacityCodes').choices).toEqual([{ code: 'measure.capacity.container', label: ' Etiqueta ' }])
  })
  it.each(['food', 'treat', 'toy', 'hygiene', 'accessory', 'habitat', 'care'] as EditorialProductionFamily[])('projects exact optional routes for %s in binding order', family => {
    const input = fixture(family, codes)
    input.family.bindings.forEach((b, i) => { b.policy = { route: 'fact_rule', rule: { family, ruleId: 'optional', parameter: codes[i]! } } })
    expect(choices(freeze(input), 'optionalNonpertinenceCodes').choices).toEqual(codes.map(code => ({ code, label: ' Etiqueta ' })))
  })
  it.each([
    { route: 'pending' }, { route: 'option_cases', cases: [] },
    { route: 'fact_rule', rule: { family: 'accessory', ruleId: 'optional_equipment', parameter: 'measure.equipment.power' } },
    { route: 'fact_rule', rule: { family: 'habitat', ruleId: 'optional', parameter: 'measure.equipment.power' } },
    { route: 'fact_rule', rule: { family: 'accessory', ruleId: 'optional', parameter: 'measure.equipment.voltage' } },
  ] satisfies EditorialBinding['policy'][])('excludes nonexact optional policy %j', policy => {
    const input = fixture('accessory', ['measure.equipment.power']); input.family.bindings[0]!.policy = policy
    expect(choices(freeze(input), 'optionalNonpertinenceCodes').choices).toEqual([])
  })
  it('keeps custom optional choices empty even with a production optional binding', () => {
    const input = fixture('custom', ['measure.equipment.power'])
    input.family.bindings[0]!.policy = { route: 'fact_rule', rule: { family: 'accessory', ruleId: 'optional', parameter: 'measure.equipment.power' } }
    expect(choices(freeze(input), 'optionalNonpertinenceCodes').choices).toEqual([])
  })
  it.each(['single', 'multi'] as const)('preserves %s toy option identities, archives, labels and input order without aliases/groups', type => {
    const input = fixture('toy', ['toy.type'])
    input.definitions[0] = { id: 'id-0', code: 'toy.type', label: 'Tipo', type,
      options: ['__proto__', 'constructor', 'old'].map((code, i) => ({ code, label: ' Igual ', sortOrder: -i, archived: true })),
      aliases: [{ label: 'Alias', optionCode: 'old' }], groups: [{ code: 'group', label: 'Grupo', optionCodes: ['old'] }] }
    const before = JSON.stringify(input), expected = input.definitions[0].options.map(({ code, label }) => ({ code, label }))
    const result = choices(freeze(input), 'relevantDimensionCodes')
    expect(result.toyTypeChoices).toEqual(expected)
    result.toyTypeChoices[0]!.label = 'Changed'; result.choices.push({ code: 'fake', label: '' })
    expect(JSON.stringify(input)).toBe(before)
    expect(choices(input, 'relevantDimensionCodes').toyTypeChoices).toEqual(expected)
    const other = { ...input, family: { ...input.family, code: 'hygiene' } }
    expect(choices(other, 'relevantDimensionCodes').toyTypeChoices).toEqual([])
  })
  it.each(['id', 'code'] as const)('does not resolve definitions by %s mismatch', field => {
    const input = fixture('toy', ['toy.type', 'measure.dimensions.external_width'])
    input.definitions.forEach(definition => { definition[field] = 'wrong' })
    expect(choices(freeze(input), 'relevantDimensionCodes')).toMatchObject({ choices: [], toyTypeChoices: [] })
  })
  it('does not derive scalar options or toy types from a non-option definition', () => {
    const input = fixture('toy', ['toy.type', 'measure.net_mass'])
    expect(choices(input, 'contentMagnitude').choices).toEqual([])
    expect(choices(input, 'relevantDimensionCodes').toyTypeChoices).toEqual([])
  })
  it('detaches labels/choices and uses only selected family bindings', () => {
    const input = fixture('accessory', ['measure.fit.neck'])
    input.definitions.push({ id: 'unbound', code: 'measure.fit.chest', label: 'Other', type: 'text' })
    const before = JSON.stringify(input), result = choices(freeze(input), 'relevantFitCodes')
    expect(result.choices).toEqual([{ code: 'measure.fit.neck', label: ' Etiqueta ' }])
    result.label = 'Changed'; result.choices[0]!.label = 'Changed'
    expect(JSON.stringify(input)).toBe(before)
    expect(choices(input, 'relevantFitCodes').label).toBe('Medidas de ajuste relevantes')
  })
})
