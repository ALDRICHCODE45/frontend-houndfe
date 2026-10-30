import { describe, expect, it } from 'vitest'
import type { EditorialDeclaration } from '../../interfaces/editorial-contract-declaration.types'
import type { EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import type { EditorialBinding, EditorialContractVocabulary, EditorialFamily, EditorialProductionFamily } from '../../interfaces/editorial-contract-vocabulary.types'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES } from '../../interfaces/editorial-production-codes'
import { inspectEditorialFactsReferences as inspect, type EditorialFactsReferencesInput } from '../editorial-contract-facts-references'
import { decodeEditorialSellableFacts } from '../editorial-contract-document'
import { isFreshEditorialFactsCapture } from '../editorial-contract-facts-validation'

const families = ['food', 'treat', 'toy', 'hygiene', 'accessory', 'habitat', 'care', 'custom']
const permissions = {
  contentMagnitude: families, consumable: ['hygiene'], animalApplied: ['hygiene'],
  fitDeterminesChoice: ['accessory'], capacityDeterminesChoice: ['accessory'],
  electricalApplies: ['accessory', 'habitat'],
  relevantDimensionCodes: ['toy', 'hygiene', 'accessory', 'habitat', 'care'],
  relevantFitCodes: ['accessory'], relevantCapacityCodes: ['accessory', 'habitat'],
  relevantEquipmentCodes: ['accessory', 'habitat'], presentationKind: ['care'],
  optionalNonpertinenceCodes: families,
} satisfies Record<EditorialDeclaration['key'], string[]>
const unknown = (key: EditorialDeclaration['key']): EditorialDeclaration => ({ key, state: 'unknown', evidence: null })
function known<K extends EditorialDeclaration['key']>(key: K, value: Extract<EditorialDeclaration, { key: K; state: 'known' }>['value']): EditorialDeclaration {
  return { key, state: 'known', value, evidence: { sourceRef: '', verifiedOn: 'bad' }, basis: '' } as EditorialDeclaration
}
const row = (declarations: EditorialDeclaration[] = [], variantId: string | null = null): EditorialSellableFacts =>
  ({ variantId, presentation: '', declarations, careReview: null })
function input(code = 'custom', declarations: EditorialDeclaration[] = [], codes: string[] = []): EditorialFactsReferencesInput {
  const family: EditorialFamily = { id: code, code, label: code, bindings: codes.map((definitionCode) => ({
    definitionId: definitionCode, definitionCode, owner: 'sellable', sortOrder: 0,
    exposure: 'INTERNAL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' },
  })) }
  const vocabulary: EditorialContractVocabulary = { semanticsVersion: 'editorial-production-1', families: [family], definitions: [] }
  return { family, vocabulary, context: { variants: [] }, facts: [row(declarations)] }
}
function binding(data: EditorialFactsReferencesInput): EditorialBinding { return data.family!.bindings[0]! }
function toyDefinition(data: EditorialFactsReferencesInput) {
  data.vocabulary.definitions.push({ id: 'toy.type', code: 'toy.type', label: 'Toy', type: 'single',
    options: ['ball', '__proto__', 'constructor', 'toString'].map((code) => ({ code, label: code, archived: false, sortOrder: 0 })),
    groups: [{ code: 'group', label: 'Group', optionCodes: ['ball'] }], aliases: [{ label: 'alias', optionCode: 'ball' }] })
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

describe('inspectEditorialFactsReferences — S24/S25 reference boundary only', () => {
  for (const [key, allowed] of Object.entries(permissions)) {
    it.each(families)(`${key} unknown family permission: %s`, (family) => {
      const issues = inspect(input(family, [unknown(key as EditorialDeclaration['key'])]))
      expect(issues).toEqual(allowed.includes(family) ? [] : [{ code: 'declaration_family', rowIndex: 0, declarationIndex: 0 }])
    })
  }
  const knownSamples: EditorialDeclaration[] = [
    known('contentMagnitude', 'mass'), known('consumable', false), known('animalApplied', false),
    known('fitDeterminesChoice', false), known('capacityDeterminesChoice', false), known('electricalApplies', false),
    known('relevantDimensionCodes', { codes: [], toyTypes: [] }), known('relevantFitCodes', []),
    known('relevantCapacityCodes', []), known('relevantEquipmentCodes', []),
    known('presentationKind', 'packaging'), known('optionalNonpertinenceCodes', []),
  ]
  for (const declaration of knownSamples) {
    it.each(families)(`${declaration.key} known family permission: %s`, (family) => {
      const data = input(family, [declaration], ['measure.net_mass'])
      expect(inspect(data)).toEqual(permissions[declaration.key].includes(family) ? []
        : [{ code: 'declaration_family', rowIndex: 0, declarationIndex: 0 }])
    })
  }
  it.each(['__proto__', 'constructor', 'toString', 'toy ', 'TOY'])('special/exact family identity %s grants no production rights', (family) => {
    const data = input(family, [unknown('consumable'), unknown('contentMagnitude')])
    expect(inspect(data)).toEqual([{ code: 'declaration_family', rowIndex: 0, declarationIndex: 0 }])
  })
  const magnitudes = [
    ['mass', 'measure.net_mass'], ['volume', 'measure.net_volume'], ['count', 'measure.content_count'],
    ['length', 'measure.coverage.length'], ['area', 'measure.coverage.area'],
  ] as const
  for (const [magnitude, measure] of magnitudes) {
    it.each(families)(`known ${magnitude} exact canonical binding: %s`, (family) => {
      const data = input(family, [known('contentMagnitude', magnitude)], [measure])
      expect(inspect(data)).toEqual([])
      binding(data).definitionCode = `${measure} `
      expect(inspect(data)).toEqual([{ code: 'binding', rowIndex: 0, declarationIndex: 0 }])
    })
  }
  it('custom unknown content and optional empty/unknown need zero bindings; known mass/nonempty do not pass', () => {
    expect(inspect(input('custom', [unknown('contentMagnitude'), unknown('optionalNonpertinenceCodes'), known('optionalNonpertinenceCodes', [])]))).toEqual([])
    expect(inspect(input('custom', [known('contentMagnitude', 'mass'), known('optionalNonpertinenceCodes', ['material'])])))
      .toEqual([{ code: 'binding', rowIndex: 0, declarationIndex: 0 }, { code: 'optional_route', rowIndex: 0, declarationIndex: 1 }])
  })
  const axes = [
    { key: 'relevantDimensionCodes', prefix: 'measure.dimensions.', family: 'toy' },
    { key: 'relevantFitCodes', prefix: 'measure.fit.', family: 'accessory' },
    { key: 'relevantCapacityCodes', prefix: 'measure.capacity.', family: 'habitat' },
    { key: 'relevantEquipmentCodes', prefix: 'measure.equipment.', family: 'habitat' },
  ] as const
  for (const axis of axes) {
    for (const code of EDITORIAL_PRODUCTION_DEFINITION_CODES.filter((code) => code.startsWith(axis.prefix))) {
      it(`${axis.key} requires bound ${code}`, () => {
        const declaration = axis.key === 'relevantDimensionCodes'
          ? known(axis.key, { codes: [code as 'measure.dimensions.external_length'], toyTypes: [] })
          : known(axis.key, [code] as never)
        expect(inspect(input(axis.family, [declaration], [code]))).toEqual([])
        expect(inspect(input(axis.family, [declaration]))).toEqual([{ code: 'binding', rowIndex: 0, declarationIndex: 0 }])
      })
    }
  }
  it('checks every member of a mixed bound/unbound subset and toy list independently', () => {
    const data = input('toy', [known('relevantDimensionCodes', {
      codes: ['measure.dimensions.external_length', 'measure.dimensions.external_width'], toyTypes: ['ball', 'missing'],
    })], ['measure.dimensions.external_length', 'toy.type'])
    toyDefinition(data)
    expect(inspect(data)).toEqual([
      { code: 'binding', rowIndex: 0, declarationIndex: 0 }, { code: 'toy_type', rowIndex: 0, declarationIndex: 0 },
    ])
    data.vocabulary.definitions = []
    expect(inspect(data)).toHaveLength(2)
  })
  it('accessory permits only bound container capacity, not habitat volume', () => {
    expect(inspect(input('accessory', [known('relevantCapacityCodes', ['measure.capacity.container'])], ['measure.capacity.container']))).toEqual([])
    expect(inspect(input('accessory', [known('relevantCapacityCodes', ['measure.capacity.habitat_usable_volume'])], ['measure.capacity.habitat_usable_volume'])))
      .toEqual([{ code: 'binding', rowIndex: 0, declarationIndex: 0 }])
  })
  it.each(['ball', '__proto__', 'constructor', 'toString', 'group', 'alias', ' ball ', 'missing'])('toyTypes exact options only: %s', (code) => {
    const data = input('toy', [known('relevantDimensionCodes', { codes: [], toyTypes: [code] })], ['toy.type'])
    toyDefinition(data)
    expect(inspect(data)).toEqual(['ball', '__proto__', 'constructor', 'toString'].includes(code) ? [] : [{ code: 'toy_type', rowIndex: 0, declarationIndex: 0 }])
    data.family!.bindings = []
    expect(inspect(data)).toEqual([{ code: 'toy_type', rowIndex: 0, declarationIndex: 0 }])
  })
  it.each(['hygiene', 'accessory', 'habitat', 'care'])('non-toy %s requires empty toyTypes even with toy binding', (family) => {
    const data = input(family, [known('relevantDimensionCodes', { codes: [], toyTypes: ['ball'] })], ['toy.type'])
    toyDefinition(data)
    expect(inspect(data)).toEqual([{ code: 'toy_type', rowIndex: 0, declarationIndex: 0 }])
    data.facts[0]!.declarations = [known('relevantDimensionCodes', { codes: [], toyTypes: [] })]
    expect(inspect(data)).toEqual([])
  })
  for (const family of families.slice(0, 7)) {
    it(`${family} optional list requires selected exact optional fact-rule`, () => {
      const data = input(family, [known('optionalNonpertinenceCodes', ['material'])], ['material'])
      const b = binding(data)
      b.policy = { route: 'fact_rule', rule: { family: family as EditorialProductionFamily, ruleId: 'optional', parameter: 'material' } }
      expect(inspect(data)).toEqual([])
      for (const policy of [
        { route: 'pending' }, { route: 'option_cases', cases: [] },
        { route: 'fact_rule', rule: { family, ruleId: 'optional_equipment', parameter: 'material' } },
        { route: 'fact_rule', rule: { family, ruleId: 'optional', parameter: 'color.base' } },
        { route: 'fact_rule', rule: { family: 'custom', ruleId: 'optional', parameter: 'material' } },
      ]) {
        b.policy = policy as EditorialBinding['policy']
        expect(inspect(data)).toEqual([{ code: 'optional_route', rowIndex: 0, declarationIndex: 0 }])
      }
      b.policy = { route: 'fact_rule', rule: { family: family as EditorialProductionFamily, ruleId: 'optional', parameter: 'material' } }
      data.vocabulary.families.push({ id: 'other', code: 'other', label: 'Other', bindings: [structuredClone(b)] })
      data.family!.bindings = [] // Other families never supply a selected binding.
      expect(inspect(data)).toEqual([{ code: 'optional_route', rowIndex: 0, declarationIndex: 0 }])
    })
  }
  it('custom bindings cannot grant production declarations or optional-list rights', () => {
    const data = input('custom', [unknown('relevantDimensionCodes'), known('optionalNonpertinenceCodes', ['material'])], ['material'])
    binding(data).policy = { route: 'option_cases', cases: [] }
    expect(inspect(data)).toEqual([
      { code: 'declaration_family', rowIndex: 0, declarationIndex: 0 },
      { code: 'optional_route', rowIndex: 0, declarationIndex: 1 },
    ])
  })
  it.each(families)('nonnull careReview including unknown is care-only: %s', (family) => {
    const data = input(family)
    data.facts[0]!.careReview = { state: 'unknown' }
    expect(inspect(data)).toEqual(family === 'care' ? [] : [{ code: 'care_family', rowIndex: 0 }])
  })
  it('requires a family only when rows exist', () => {
    const data = input()
    data.family = null
    expect(inspect(data)).toEqual([{ code: 'family', rowIndex: 0 }])
    data.facts = []
    expect(inspect(data)).toEqual([])
  })
  it.each([null, 'current', 'orphan', 'inactive', '__proto__', 'constructor', 'toString', ' current '])('matches every variant row exactly: %j', (id) => {
    const data = input()
    data.context.variants = ['current', '__proto__', 'constructor', 'toString'].map((id) => ({ id, name: id }))
    data.facts = [row([], id)]
    expect(inspect(data)).toEqual(id !== null && data.context.variants.some((v) => v.id === id) ? [] : [{ code: 'subject', rowIndex: 0 }])
    data.context.variants = []
    expect(inspect(data)).toEqual(id === null ? [] : [{ code: 'subject', rowIndex: 0 }])
  })
  it('does not impose capture, evidence, count, contradictions, completeness or numeric domains', () => {
    const data = input('accessory', [known('fitDeterminesChoice', false), known('relevantFitCodes', ['measure.fit.neck'])], ['measure.fit.neck'])
    data.facts = Array.from({ length: 201 }, () => row(Array.from({ length: 13 }, () => data.facts[0]!.declarations[1]!)))
    data.facts[0]!.presentation = 'x'.repeat(301)
    data.vocabulary.definitions.push({ id: 'measure.fit.neck', code: 'measure.fit.neck', label: 'Neck', type: 'number', units: [],
      numericPolicy: { status: 'resolved', magnitude: 'length', integer: true, lower: 100, upper: null, lowerInclusive: true, upperInclusive: false } })
    expect(data.facts.every((fact) => decodeEditorialSellableFacts(fact) !== null)).toBe(true)
    expect(isFreshEditorialFactsCapture(data.facts)).toBe(false)
    expect(inspect(data)).toEqual([])
  })
  it('care reference permission does not become care capture/readiness admission', () => {
    const data = input('care')
    data.facts[0]!.careReview = { state: 'prepared', jurisdiction: '', intendedUse: '', determination: 'none_applicable',
      basis: '', evidence: [{ sourceRef: '', verifiedOn: 'bad' }],
      requirements: [{ key: '', description: '', disposition: 'conflicting', evidence: [], basis: '' }], warnings: [] }
    expect(decodeEditorialSellableFacts(data.facts[0])).not.toBeNull()
    expect(isFreshEditorialFactsCapture(data.facts)).toBe(false)
    expect(inspect(data)).toEqual([])
  })
  it('preserves deeply frozen input and emits deterministic row/declaration order', () => {
    const data = input('custom', [unknown('consumable'), known('contentMagnitude', 'mass')])
    data.facts[0]!.careReview = { state: 'unknown' }
    data.facts.push(row([unknown('animalApplied')], 'orphan'))
    const before = structuredClone(data)
    freeze(data)
    const expected = [
      { code: 'declaration_family', rowIndex: 0, declarationIndex: 0 },
      { code: 'binding', rowIndex: 0, declarationIndex: 1 }, { code: 'care_family', rowIndex: 0 },
      { code: 'subject', rowIndex: 1 }, { code: 'declaration_family', rowIndex: 1, declarationIndex: 0 },
    ]
    expect(inspect(data)).toEqual(expected)
    expect(inspect(data)).toEqual(expected)
    expect(data).toEqual(before)
  })
})
