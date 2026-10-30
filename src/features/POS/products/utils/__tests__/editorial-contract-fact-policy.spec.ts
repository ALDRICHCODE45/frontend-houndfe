import { describe, expect, it } from 'vitest'
import type { EditorialDeclaration, EditorialDeclarationValues } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import type { EditorialFactRule, EditorialRuleResult } from '../../interfaces/editorial-contract-vocabulary.types'
import { resolveEditorialFactRule } from '../editorial-contract-fact-policy'

const outcomes: Record<'O' | 'R' | 'N' | 'U', EditorialRuleResult> = {
  O: { applicability: 'applicable', required: false, allowNA: false, evidenceRequired: true, documentary: 'resolved' },
  R: { applicability: 'applicable', required: true, allowNA: false, evidenceRequired: true, documentary: 'resolved' },
  N: { applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'resolved' },
  U: { applicability: 'unresolved', required: false, allowNA: false, evidenceRequired: true, documentary: 'resolved' },
}
const evidence = { sourceRef: 'Manufacturer', verifiedOn: '2026-01-01' }
function facts(values: Partial<EditorialDeclarationValues> = {}): EditorialSellableFacts {
  const declarations = Object.entries(values).map(([key, value]) => ({
    key, state: 'known', value, evidence, basis: 'Manufacturer determination',
  })) as EditorialDeclaration[]
  return { variantId: 'v', presentation: 'Presentation', declarations, careReview: null }
}
const rules = {
  required: { family: 'food', ruleId: 'required', parameter: 'food.format' },
  optional: { family: 'food', ruleId: 'optional', parameter: 'life.stage' },
  animal: { family: 'hygiene', ruleId: 'animal', parameter: 'animal.target' },
  form: { family: 'hygiene', ruleId: 'form', parameter: 'hygiene.form' },
  content: { family: 'food', ruleId: 'content', parameter: 'measure.net_mass' },
  dimensions: { family: 'toy', ruleId: 'dimensions', parameter: 'measure.dimensions.external_width' },
  fit: { family: 'accessory', ruleId: 'fit', parameter: 'measure.fit.neck' },
  capacity: { family: 'accessory', ruleId: 'capacity', parameter: 'measure.capacity.container' },
  space: { family: 'habitat', ruleId: 'space', parameter: 'measure.capacity.container' },
  equipment: { family: 'habitat', ruleId: 'equipment', parameter: 'measure.equipment.power' },
  optional_equipment: { family: 'accessory', ruleId: 'optional_equipment', parameter: 'measure.equipment.power' },
  presentation: { family: 'care', ruleId: 'presentation', parameter: 'care.form' },
} satisfies Record<EditorialFactRule['ruleId'], EditorialFactRule>
const unknownKeys = ['contentMagnitude', 'consumable', 'animalApplied', 'fitDeterminesChoice', 'capacityDeterminesChoice',
  'electricalApplies', 'relevantDimensionCodes', 'relevantFitCodes', 'relevantCapacityCodes', 'relevantEquipmentCodes',
  'presentationKind', 'optionalNonpertinenceCodes'] as const
function check(rule: EditorialFactRule, values: Partial<EditorialDeclarationValues>, expected: keyof typeof outcomes) {
  expect(resolveEditorialFactRule(rule, facts(values))).toEqual(outcomes[expected])
}

describe('S29 production route outcomes, not whole-document or publication approval', () => {
  it.each(Object.values(rules))('null, omitted and unknown projections for $ruleId', rule => {
    const unknown = facts()
    unknown.declarations = unknownKeys.map(key => ({ key, state: 'unknown', evidence: null }))
    const expected = rule.ruleId === 'required' ? outcomes.R
      : rule.ruleId === 'optional' || rule.ruleId === 'optional_equipment' ? outcomes.O : outcomes.U
    expect(resolveEditorialFactRule(rule, null)).toEqual(expected)
    expect(resolveEditorialFactRule(rule, facts())).toEqual(expected)
    expect(resolveEditorialFactRule(rule, unknown)).toEqual(expected)
  })
  it('optional nonpertinence selects only the exact optional parameter, never other routes', () => {
    check(rules.optional, { optionalNonpertinenceCodes: [] }, 'O')
    check(rules.optional, { optionalNonpertinenceCodes: ['pack.sale'] }, 'O')
    check(rules.optional, { optionalNonpertinenceCodes: ['life.stage'] }, 'N')
    check(rules.required, { optionalNonpertinenceCodes: ['life.stage'] }, 'R')
  })
  it.each(['animal', 'form'] as const)('%s preserves known false/true rather than unknown', route => {
    const key = route === 'animal' ? 'animalApplied' : 'consumable'
    check(rules[route], { [key]: false }, 'N'); check(rules[route], { [key]: true }, 'R')
  })
  const measures = {
    mass: 'measure.net_mass', volume: 'measure.net_volume', count: 'measure.content_count',
    length: 'measure.coverage.length', area: 'measure.coverage.area',
  } as const
  it.each(['food', 'treat', 'hygiene', 'care', 'toy', 'accessory', 'habitat'] as const)(
    '%s content applies only its own minima and matching measure', family => {
      const magnitudes = family === 'hygiene' || family === 'habitat'
        ? Object.keys(measures) as (keyof typeof measures)[] : ['mass', 'volume', 'count'] as const
      for (const magnitude of magnitudes) for (const other of magnitudes) {
        const parameter = measures[other]
        check({ family, ruleId: 'content', parameter }, {
          contentMagnitude: magnitude, ...(family === 'hygiene' ? { consumable: true } : {}),
        }, ['food', 'treat', 'hygiene', 'care'].includes(family) && magnitude === other ? 'R' : 'O')
      }
      const rule: EditorialFactRule = { family, ruleId: 'content', parameter: 'measure.net_mass' }
      check(rule, {}, ['food', 'treat', 'hygiene', 'care'].includes(family) ? 'U' : 'O')
    },
  )
  it('hygiene consumable gates content before magnitude; false is evidenced nonpertinence', () => {
    const rule: EditorialFactRule = { family: 'hygiene', ruleId: 'content', parameter: 'measure.net_mass' }
    check(rule, { consumable: false }, 'N')
    check(rule, { consumable: false, contentMagnitude: 'mass' }, 'N')
    check(rule, { contentMagnitude: 'mass' }, 'U')
    check(rule, { consumable: true }, 'U')
    check(rule, { consumable: true, contentMagnitude: 'volume' }, 'O')
  })
  it('treat length/area cannot produce a required content measure', () => {
    const rule: EditorialFactRule = { family: 'treat', ruleId: 'content', parameter: 'measure.net_mass' }
    // Table-level defense for these projections; reference admission separately rejects unbound measures.
    check(rule, { contentMagnitude: 'length' }, 'U'); check(rule, { contentMagnitude: 'area' }, 'U')
  })
  it('dimension subsets distinguish missing, empty, selected and omitted axes', () => {
    check(rules.dimensions, {}, 'U')
    check(rules.dimensions, { relevantDimensionCodes: { codes: [], toyTypes: [] } }, 'N')
    check(rules.dimensions, { relevantDimensionCodes: { codes: ['measure.dimensions.external_width'], toyTypes: ['toy'] } }, 'R')
    check(rules.dimensions, { relevantDimensionCodes: { codes: ['measure.dimensions.external_length'], toyTypes: ['toy'] } }, 'O')
  })
  it.each(['measure.dimensions.external_width', 'measure.capacity.container'] as const)(
    'space requires both determinations before selecting %s subset', parameter => {
      const rule: EditorialFactRule = { family: 'habitat', ruleId: 'space', parameter }
      check(rule, { relevantDimensionCodes: { codes: [], toyTypes: [] } }, 'U')
      check(rule, { relevantCapacityCodes: [] }, 'U')
      check(rule, { relevantDimensionCodes: { codes: [], toyTypes: [] }, relevantCapacityCodes: [] }, 'N')
      check(rule, { relevantDimensionCodes: { codes: ['measure.dimensions.external_width'], toyTypes: [] },
        relevantCapacityCodes: ['measure.capacity.container'] }, 'R')
      check(rule, { relevantDimensionCodes: { codes: ['measure.dimensions.external_length'], toyTypes: [] },
        relevantCapacityCodes: ['measure.capacity.habitat_usable_volume'] }, 'O')
    },
  )
  const flags = [
    ['fit', 'fitDeterminesChoice', 'relevantFitCodes', 'measure.fit.neck', 'measure.fit.chest'],
    ['capacity', 'capacityDeterminesChoice', 'relevantCapacityCodes', 'measure.capacity.container', 'measure.capacity.habitat_usable_volume'],
    ['equipment', 'electricalApplies', 'relevantEquipmentCodes', 'measure.equipment.power', 'measure.equipment.voltage'],
    ['optional_equipment', 'electricalApplies', 'relevantEquipmentCodes', 'measure.equipment.power', 'measure.equipment.voltage'],
  ] as const
  it.each(flags)('%s complete flag/subset truth table', (route, flag, subset, selected, other) => {
    for (const value of [undefined, false, true]) for (const members of [undefined, [], [selected], [other]]) {
      const input = { ...(value === undefined ? {} : { [flag]: value }), ...(members === undefined ? {} : { [subset]: members }) }
      const expected = value === false ? members?.length ? 'U' : 'N'
        : value === true ? !members?.length ? 'U' : route !== 'optional_equipment' && members.some(member => member === selected) ? 'R' : 'O'
          : route === 'optional_equipment' ? 'O' : 'U'
      check(rules[route], input, expected)
    }
  })
  it.each(['formulation', 'device', 'packaging'] as const)('care %s selects only its representation', presentationKind => {
    const selected = { formulation: 'care.form', device: 'care.device', packaging: 'pack.form' } as const
    for (const parameter of Object.values(selected)) {
      check({ family: 'care', ruleId: 'presentation', parameter }, { presentationKind }, parameter === selected[presentationKind] ? 'R' : 'O')
    }
  })
  it('known empty/false projection stays distinct from an unknown declaration', () => {
    const row = facts({ electricalApplies: false, relevantEquipmentCodes: [] })
    expect(resolveEditorialFactRule(rules.equipment, row)).toEqual(outcomes.N)
    row.declarations[0] = { key: 'electricalApplies', state: 'unknown', evidence: null }
    expect(resolveEditorialFactRule(rules.equipment, row)).toEqual(outcomes.U)
  })
  it('does not borrow another row and returns fresh outcomes without modifying frozen inputs', () => {
    const first = facts({ animalApplied: true }); const sibling = facts({ animalApplied: false }); sibling.variantId = 'sibling'
    function freeze(value: unknown): void {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    }
    freeze(first); freeze(sibling); freeze(rules.animal)
    const before = JSON.stringify([first, sibling])
    const result = resolveEditorialFactRule(rules.animal, first)
    expect(result).toEqual(outcomes.R); result.required = false
    expect(resolveEditorialFactRule(rules.animal, first)).toEqual(outcomes.R)
    expect(resolveEditorialFactRule(rules.animal, sibling)).toEqual(outcomes.N)
    expect(resolveEditorialFactRule(rules.animal, null)).toEqual(outcomes.U)
    expect(JSON.stringify([first, sibling])).toBe(before)
  })
})
