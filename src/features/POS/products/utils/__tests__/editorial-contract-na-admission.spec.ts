import { describe, expect, it } from 'vitest'
import type { EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import type { EditorialPolicyCase } from '../../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialNotApplicableAdmission as inspect, type EditorialNotApplicableInput } from '../editorial-contract-na-admission'

function fixture(): EditorialNotApplicableInput {
  return {
    vocabulary: { semanticsVersion: 'editorial-production-1', definitions: ['selector', 'target'].map(code => ({
      id: code, code, label: code, type: 'single', options: ['a', 'b'].map(option => ({
        code: option, label: option, archived: false, sortOrder: 0,
      })), groups: [], aliases: [],
    })), families: [{ id: 'f', code: 'custom', label: 'Custom', bindings: ['selector', 'target'].map(code => ({
      definitionId: code, definitionCode: code, owner: 'product', sortOrder: 0,
      exposure: 'INTERNAL', searchable: false, publicationCheck: 'always',
      policy: code === 'selector' ? { route: 'pending' } : { route: 'option_cases', cases: [selected()] },
    })) }] },
    document: { schemaVersion: 2, familyCode: 'custom', commercialTitle: null, description: null, mediaRefs: [], facts: [],
      values: [
        { code: 'selector', owner: 'product', variantId: null, state: 'known', payload: { type: 'single', value: 'a' }, evidence: null },
        { code: 'target', owner: 'product', variantId: null, state: 'not_applicable', evidence: null },
      ] },
  }
}
function selected(): EditorialPolicyCase {
  return { code: 'case', when: [{ definitionCode: 'selector', operator: 'equals_set', optionCodes: ['a'] }],
    applicability: 'not_applicable', required: false, allowNA: true, evidenceRequired: true, documentary: 'unresolved' }
}
const bindings = (input: EditorialNotApplicableInput) => input.vocabulary.families[0]!.bindings
const denied = (valueIndex = 1) => [{ code: 'NA_NOT_ALLOWED', valueIndex }]
function production(): EditorialNotApplicableInput {
  return {
    vocabulary: { semanticsVersion: 'editorial-production-1',
      definitions: [{ id: 'd', code: 'hygiene.form', label: 'Form', type: 'single', options: [], groups: [], aliases: [] }],
      families: [{ id: 'f', code: 'hygiene', label: 'Hygiene', bindings: [{
        definitionId: 'd', definitionCode: 'hygiene.form', owner: 'sellable', sortOrder: 0,
        exposure: 'DETAIL', searchable: false, publicationCheck: 'always',
        policy: { route: 'fact_rule', rule: { family: 'hygiene', ruleId: 'form', parameter: 'hygiene.form' } },
      }] }] },
    document: { schemaVersion: 2, familyCode: 'hygiene', commercialTitle: null, description: null, mediaRefs: [],
      values: [{ code: 'hygiene.form', owner: 'sellable', variantId: 'v', state: 'not_applicable', evidence: null }], facts: [] },
  }
}
function facts(variantId: string | null, state: 'unknown' | boolean): EditorialSellableFacts {
  return { variantId, presentation: 'Presentation', careReview: null, declarations: [
    state === 'unknown' ? { key: 'consumable', state: 'unknown', evidence: null }
      : { key: 'consumable', state: 'known', value: state, evidence: { sourceRef: 'Manufacturer', verifiedOn: '2026-01-01' }, basis: 'Determination' },
  ] }
}

describe('S32 explicit NA-only admission after fresh/reference prerequisites', () => {
  it.each(['applicable', 'not_applicable', 'unresolved'] as const)('uses only applicability/allowNA for %s', applicability => {
    for (const allowNA of [false, true]) {
      const input = fixture()
      bindings(input)[1]!.policy = { route: 'option_cases', cases: [{ ...selected(), applicability, allowNA }] }
      expect(inspect(input)).toEqual(applicability === 'not_applicable' && allowNA ? [] : denied())
    }
  })
  it('denies pending, zero and multiple matches without guessing a case', () => {
    const input = fixture()
    bindings(input)[1]!.policy = { route: 'pending' }; expect(inspect(input)).toEqual(denied())
    bindings(input)[1]!.policy = { route: 'option_cases', cases: [] }; expect(inspect(input)).toEqual(denied())
    bindings(input)[1]!.policy = { route: 'option_cases', cases: [selected(), { ...selected(), code: 'other' }] }
    expect(inspect(input)).toEqual(denied())
  })
  it('product rules read product selectors once, even alongside sellable assignments', () => {
    const input = fixture()
    bindings(input).push({ ...bindings(input)[1]!, definitionId: 'other', definitionCode: 'other', owner: 'sellable', policy: { route: 'pending' } })
    input.vocabulary.definitions.push({ id: 'other', code: 'other', label: 'Other', type: 'text' })
    input.document.values.push({ code: 'other', owner: 'sellable', variantId: 'v', state: 'unknown', evidence: null })
    expect(inspect(input)).toEqual([])
  })
  it('sellable rules may read product selectors without variant inheritance', () => {
    const input = fixture(); bindings(input)[1]!.owner = 'sellable'
    input.document.values[1]!.owner = 'sellable'; input.document.values[1]!.variantId = 'v'
    input.document.values.push({ ...input.document.values[1]!, variantId: 'w' })
    expect(inspect(input)).toEqual([])
  })
  it('sellable selectors use only the exact current subject, including simple null', () => {
    const input = fixture()
    for (const binding of bindings(input)) binding.owner = 'sellable'
    for (const value of input.document.values) value.owner = 'sellable'
    expect(inspect(input)).toEqual([])
    for (const value of input.document.values) value.variantId = 'v'
    input.document.values.push({ code: 'selector', owner: 'sellable', variantId: 'w', state: 'known', payload: { type: 'single', value: 'b' }, evidence: null },
      { code: 'target', owner: 'sellable', variantId: 'w', state: 'not_applicable', evidence: null })
    expect(inspect(input)).toEqual(denied(3))
  })
  it.each(['unknown', 'not_applicable', 'omitted'] as const)('%s selector never grants target NA', state => {
    const input = fixture()
    if (state === 'omitted') input.document.values.shift()
    else {
      input.document.values[0] = { code: 'selector', owner: 'product', variantId: null, state, evidence: null }
    }
    // An asserted NA selector itself is checked: its policy is pending.
    const expected = state === 'not_applicable' ? [...denied(0), ...denied(1)] : denied(state === 'omitted' ? 0 : 1)
    expect(inspect(input)).toEqual(expected)
  })
  it('does not evaluate known/unknown/omitted assertions or reject known contradictions', () => {
    const input = fixture()
    input.document.values[1] = { code: 'target', owner: 'product', variantId: null, state: 'known', payload: { type: 'single', value: 'a' }, evidence: null }
    expect(inspect(input)).toEqual([])
    input.document.values[1] = { code: 'target', owner: 'product', variantId: null, state: 'unknown', evidence: null }
    expect(inspect(input)).toEqual([])
    input.document.values = []; input.document.familyCode = null
    expect(inspect(input)).toEqual([])
  })
  it.each(['missing', 'unknown', false, true] as const)('production projection %s controls only its explicit NA', state => {
    const input = production()
    if (state !== 'missing') input.document.facts = [facts('v', state)]
    expect(inspect(input)).toEqual(state === false ? [] : denied(0))
  })
  it('never borrows sibling facts or filters explicit NA by an invented eligibility set', () => {
    const input = production()
    input.document.facts = [facts('w', false)]
    expect(inspect(input)).toEqual(denied(0))
    input.document.values.push({ ...input.document.values[0]!, variantId: 'w' })
    expect(inspect(input)).toEqual(denied(0))
    input.document.facts.push(facts('v', false))
    expect(inspect(input)).toEqual([])
    input.document.values[0]!.variantId = null; input.document.values.length = 1
    input.document.facts = [facts(null, false)]
    expect(inspect(input)).toEqual([])
  })
  it('missing family or binding is a violated prerequisite, not unresolved policy', () => {
    const input = fixture(); input.document.familyCode = 'missing'
    expect(() => inspect(input)).toThrow()
    input.document.familyCode = 'custom'; bindings(input).pop()
    expect(() => inspect(input)).toThrow()
  })
  it('returns deterministic indexed failures without mutating frozen inputs', () => {
    const input = fixture(); bindings(input)[1]!.policy = { route: 'pending' }
    function freeze(value: unknown): void {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    }
    const before = JSON.stringify(input); freeze(input)
    expect(inspect(input)).toEqual(denied()); expect(JSON.stringify(input)).toBe(before)
  })
})
