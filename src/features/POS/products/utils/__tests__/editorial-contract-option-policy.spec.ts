import { describe, expect, it } from 'vitest'
import type { EditorialKnownPayload, EditorialValue } from '../../interfaces/editorial-contract-value.types'
import type { EditorialPolicyCase } from '../../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialBasicReferences } from '../editorial-contract-document-references'
import { allowsEditorialNotApplicable, selectEditorialOptionCase, type EditorialOptionSelectionInput } from '../editorial-contract-option-policy'

function fixture(type: 'single' | 'multi' = 'multi'): EditorialOptionSelectionInput {
  return {
    policy: { route: 'option_cases', cases: [] }, currentSubject: 'v',
    family: { id: 'f', code: 'custom', label: 'Custom', bindings: [{
      definitionId: 'd', definitionCode: 'choice', owner: 'sellable', sortOrder: 0,
      exposure: 'INTERNAL', searchable: false, publicationCheck: 'always', policy: { route: 'pending' },
    }] },
    definitions: [{ id: 'd', code: 'choice', label: 'Choice', type,
      options: ['a', 'b', ' A ', '__proto__'].map(code => ({ code, label: code, archived: false, sortOrder: 0 })),
      groups: [], aliases: [] }],
    values: [{ code: 'choice', owner: 'sellable', variantId: 'v', state: 'known',
      payload: type === 'single' ? { type, value: 'a' } : { type, value: ['a', 'b'] }, evidence: null }],
  }
}
function rule(operator: 'equals_set' | 'contains_all' | 'intersects', optionCodes = ['a']): EditorialPolicyCase {
  return { code: 'case', when: [{ definitionCode: 'choice', operator, optionCodes }],
    applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'resolved' }
}
function cases(input: EditorialOptionSelectionInput, ...items: EditorialPolicyCase[]) {
  input.policy = { route: 'option_cases', cases: items }; return input
}
function freeze(value: unknown): void {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
}

describe('selected option policy, not publication scheduling or admission', () => {
  it.each([
    ['single', 'equals_set', ['a'], true], ['single', 'equals_set', ['a', 'b'], false],
    ['single', 'contains_all', ['a'], true], ['single', 'contains_all', ['a', 'b'], false],
    ['single', 'intersects', ['b', 'a'], true], ['single', 'intersects', ['b'], false],
    ['multi', 'equals_set', ['b', 'a'], true], ['multi', 'equals_set', ['a'], false],
    ['multi', 'contains_all', ['b'], true], ['multi', 'contains_all', ['a', '__proto__'], false],
    ['multi', 'intersects', ['__proto__', 'a'], true], ['multi', 'intersects', ['__proto__'], false],
  ] as const)('%s %s %j matches=%s', (type, operator, expected, matches) => {
    const selected = rule(operator, [...expected])
    expect(selectEditorialOptionCase(cases(fixture(type), selected))).toEqual(matches ? selected : null)
  })
  it.each(['equals_set', 'contains_all', 'intersects'] as const)('empty multi never matches nonempty expected %s', operator => {
    const input = fixture(); input.values = [{ ...input.values[0]!, state: 'known', payload: { type: 'multi', value: [] }, evidence: null }]
    expect(selectEditorialOptionCase(cases(input, rule(operator)))).toBeNull()
  })
  it.each(['omitted', 'unknown', 'not_applicable'] as const)('%s selector does not match', state => {
    const input = fixture(); input.values = state === 'omitted' ? [] : [{ code: 'choice', owner: 'sellable', variantId: 'v', state, evidence: null }]
    expect(selectEditorialOptionCase(cases(input, rule('intersects')))).toBeNull()
  })
  it('requires exactly one case, not the first, including unconditional cases', () => {
    const unconditional = { ...rule('intersects'), when: [] }
    expect(selectEditorialOptionCase(fixture())).toBeNull()
    expect(selectEditorialOptionCase(cases(fixture(), unconditional))).toEqual(unconditional)
    expect(selectEditorialOptionCase(cases(fixture(), unconditional, { ...unconditional, code: 'second' }))).toBeNull()
    expect(selectEditorialOptionCase(cases(fixture(), rule('contains_all'), { ...rule('intersects'), code: 'second' }))).toBeNull()
    expect(selectEditorialOptionCase(cases(fixture(), rule('equals_set', ['__proto__']), rule('equals_set', ['b', 'a'])))).toEqual(rule('equals_set', ['b', 'a']))
  })
  it('ANDs tests, resolving each selector owner rather than target ownership', () => {
    const input = fixture()
    input.family.bindings.push({ ...input.family.bindings[0]!, definitionId: 'p', definitionCode: 'product', owner: 'product' })
    input.definitions = [...input.definitions, { ...input.definitions[0]!, id: 'p', code: 'product' }]
    const product: EditorialValue = { code: 'product', owner: 'product', variantId: null, state: 'known', payload: { type: 'multi', value: ['a'] }, evidence: null }
    input.values = [...input.values, product]
    const selected = rule('contains_all'); selected.when.push({ definitionCode: 'product', operator: 'equals_set', optionCodes: ['a'] })
    expect(selectEditorialOptionCase(cases(input, selected))).toEqual(selected)
    input.values = input.values.filter(value => value.code !== 'product')
    expect(selectEditorialOptionCase(input)).toBeNull()
  })
  it('uses explicit sellable subject, never siblings, and supports simple null subjects', () => {
    const input = cases(fixture(), rule('intersects'))
    input.values = [...input.values, { ...input.values[0]!, variantId: 'other', state: 'known', payload: { type: 'multi', value: ['__proto__'] }, evidence: null }]
    expect(selectEditorialOptionCase(input)).toEqual(rule('intersects'))
    input.currentSubject = 'other'; expect(selectEditorialOptionCase(input)).toBeNull()
    input.currentSubject = null; input.values = [{ ...input.values[0]!, variantId: null }]
    expect(selectEditorialOptionCase(input)).toEqual(rule('intersects'))
  })
  it('product selectors always use null, independent of explicit current subject', () => {
    const input = cases(fixture(), rule('intersects')); input.family.bindings[0]!.owner = 'product'
    input.values = [{ ...input.values[0]!, owner: 'product', variantId: null }]
    expect(selectEditorialOptionCase(input)).toEqual(rule('intersects'))
    input.currentSubject = 'other'; expect(selectEditorialOptionCase(input)).toEqual(rule('intersects'))
  })
  it.each(['A', ' a', 'a ', 'alias', 'group'])('never normalizes or expands %j', expected => {
    const input = fixture()
    const definition = input.definitions[0]!
    if (definition.type !== 'multi') throw new Error('fixture')
    definition.options.push({ code: expected, label: expected, archived: false, sortOrder: 0 })
    expect(selectEditorialOptionCase(cases(input, rule('intersects', [expected])))).toBeNull()
  })
  it('preserves special exact identities and ignores missing evidence and set order', () => {
    const input = fixture(); input.values = [{ ...input.values[0]!, state: 'known', payload: { type: 'multi', value: ['__proto__', ' A '] }, evidence: null }]
    const selected = rule('equals_set', [' A ', '__proto__'])
    expect(selectEditorialOptionCase(cases(input, selected))).toEqual(selected)
  })
  it.each<EditorialKnownPayload>([{ type: 'text', value: 'a' }, { type: 'boolean', value: false }, { type: 'single', value: 'a' }])(
    'keeps mismatched payload %j distinct from unresolved matching', payload => {
      const input = cases(fixture(), rule('intersects'))
      input.values = [{ ...input.values[0]!, state: 'known', payload, evidence: null }]
      const issues = inspectEditorialBasicReferences({
        document: { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [], familyCode: 'custom', values: [...input.values], facts: [] },
        vocabulary: { semanticsVersion: 'editorial-production-1', families: [input.family], definitions: [...input.definitions] },
        context: { variants: [{ id: 'v', name: 'V' }] },
      })
      expect(issues).toEqual([{ code: 'PAYLOAD_TYPE', valueIndex: 0 }])
      expect(() => selectEditorialOptionCase(input)).toThrow()
    },
  )
  it('keeps missing selector metadata distinct from unresolved matching', () => {
    const input = cases(fixture(), rule('intersects')); input.family.bindings = []
    expect(() => selectEditorialOptionCase(input)).toThrow()
    input.family = fixture().family; input.definitions = []
    expect(() => selectEditorialOptionCase(input)).toThrow()
  })
  it('pending is unresolved; fact_rule cannot fall through to option cases', () => {
    expect(selectEditorialOptionCase({ ...fixture(), policy: { route: 'pending' } })).toBeNull()
    // @ts-expect-error Production fact rules require their own evaluator.
    const input: EditorialOptionSelectionInput = { ...fixture(), policy: { route: 'fact_rule', rule: { family: 'food', ruleId: 'required', parameter: 'animal.target' } } }
    expect(() => selectEditorialOptionCase(input)).toThrow()
  })
  it('returns a detached selected case without mutating frozen inputs', () => {
    const input = cases(fixture(), rule('contains_all')); const before = JSON.stringify(input); freeze(input)
    const selected = selectEditorialOptionCase(input)!
    expect(selected).toEqual(rule('contains_all')); selected.when[0]!.optionCodes.push('new')
    expect(JSON.stringify(input)).toBe(before)
  })
  it.each(['applicable', 'not_applicable', 'unresolved'] as const)('NA requires the exact conjunction for %s', applicability => {
    for (const allowNA of [false, true]) {
      expect(allowsEditorialNotApplicable({ applicability, allowNA })).toBe(applicability === 'not_applicable' && allowNA)
    }
  })
  it('unresolved selection never authorizes NA', () => { expect(allowsEditorialNotApplicable(null)).toBe(false) })
})
