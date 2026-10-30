import { describe, expect, it } from 'vitest'
import { decodeEditorialContractVocabulary as decode } from '../editorial-contract-vocabulary'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES } from '../../interfaces/editorial-production-codes'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'

const test = { definitionCode: ' selector ', operator: 'equals_set', optionCodes: [' old ', 'other'] }
const policyCase = {
  code: ' case ', when: [test], applicability: 'applicable', required: true,
  allowNA: false, evidenceRequired: true, documentary: 'resolved',
}
const rule = { family: 'food', ruleId: 'required', parameter: 'animal.target' }
const pending = { route: 'pending' }
const cases = { route: 'option_cases', cases: [policyCase] }
const fact = { route: 'fact_rule', rule }
const binding = {
  definitionId: ' definition-id ', definitionCode: 'custom.definition', owner: 'product',
  sortOrder: -2, exposure: 'INTERNAL', searchable: false, publicationCheck: 'always', policy: cases,
}
const family = { id: ' family-id ', code: 'custom.family', label: ' Family 🐾 ', bindings: [binding] }
const definition = { id: ' definition-id ', code: 'custom.definition', label: ' Label ', type: 'text' }
const vocabulary = {
  semanticsVersion: 'editorial-production-1', families: [family], definitions: [definition],
}
const withBinding = (value: unknown) => ({ ...vocabulary, families: [{ ...family, bindings: [value] }] })
const withPolicy = (value: unknown) => withBinding({ ...binding, policy: value })
const withCase = (value: unknown) => withPolicy({ ...cases, cases: [value] })
const withTest = (value: unknown) => withCase({ ...policyCase, when: [value] })
const withRule = (value: unknown) => withPolicy({ ...fact, rule: value })
const shapes = [
  { name: 'vocabulary', value: vocabulary, wrap: (v: unknown) => v },
  { name: 'family', value: family, wrap: (v: unknown) => ({ ...vocabulary, families: [v] }) },
  { name: 'binding', value: binding, wrap: withBinding },
  { name: 'pending', value: pending, wrap: withPolicy },
  { name: 'cases', value: cases, wrap: withPolicy },
  { name: 'fact', value: fact, wrap: withPolicy },
  { name: 'case', value: policyCase, wrap: withCase },
  { name: 'test', value: test, wrap: withTest },
  { name: 'rule', value: rule, wrap: withRule },
]

describe('decodeEditorialContractVocabulary primitive contract', () => {
  it.each([pending, cases, fact])('preserves policy route $route', (policy) => {
    const raw = withPolicy(policy)
    const decoded: EditorialContractVocabulary | null = decode(raw)
    expect(decoded).toEqual(raw)
    expect(decoded).not.toBe(raw)
  })

  for (const { name, value, wrap } of shapes) {
    describe(`${name} closed required shape`, () => {
      it('rejects extras', () => expect(decode(wrap({ ...value, extra: true }))).toBeNull())
      for (const key of Object.keys(value)) {
        it(`requires ${key}`, () => {
          const missing: Record<string, unknown> = { ...value }
          delete missing[key]
          expect(decode(wrap(missing))).toBeNull()
        })
        it(`rejects wrong type for ${key}`, () => {
          expect(decode(wrap({ ...value, [key]: typeof (value as Record<string, unknown>)[key] === 'object' ? false : {} }))).toBeNull()
        })
      }
    })
  }

  const enums = [
    { value: test, key: 'operator', values: ['equals_set', 'contains_all', 'intersects'], wrap: withTest },
    { value: policyCase, key: 'applicability', values: ['applicable', 'not_applicable', 'unresolved'], wrap: withCase },
    { value: policyCase, key: 'documentary', values: ['resolved', 'not_applicable', 'unresolved'], wrap: withCase },
    { value: rule, key: 'family', values: ['food', 'treat', 'toy', 'hygiene', 'accessory', 'habitat', 'care'], wrap: withRule },
    { value: rule, key: 'ruleId', values: ['required', 'optional', 'animal', 'form', 'content', 'dimensions', 'fit', 'capacity', 'space', 'equipment', 'optional_equipment', 'presentation'], wrap: withRule },
    { value: binding, key: 'owner', values: ['product', 'sellable'], wrap: withBinding },
    { value: binding, key: 'exposure', values: ['INTERNAL', 'DETAIL', 'FACET'], wrap: withBinding },
    { value: binding, key: 'publicationCheck', values: ['always', 'when_asserted'], wrap: withBinding },
  ]
  for (const { value, key, values, wrap } of enums) {
    it.each(values)(`accepts exact ${key} %s`, (literal) => {
      const raw = wrap({ ...value, [key]: literal })
      expect(decode(raw)).toEqual(raw)
    })
    it(`rejects unknown ${key}`, () => expect(decode(wrap({ ...value, [key]: 'custom' }))).toBeNull())
  }

  it.each(EDITORIAL_PRODUCTION_DEFINITION_CODES)('accepts finite fact parameter %s', (parameter) => {
    const raw = withRule({ ...rule, parameter })
    expect(decode(raw)).toEqual(raw)
  })
  it.each(['custom.definition', 'animal', ' animal.target ', 'ANIMAL.TARGET'])('rejects noncatalog parameter %s', (parameter) => {
    expect(decode(withRule({ ...rule, parameter }))).toBeNull()
  })

  const identities = [
    { value: family, keys: ['id', 'code', 'label'], wrap: (v: unknown) => ({ ...vocabulary, families: [v] }) },
    { value: binding, keys: ['definitionId', 'definitionCode'], wrap: withBinding },
    { value: policyCase, keys: ['code'], wrap: withCase },
    { value: test, keys: ['definitionCode'], wrap: withTest },
  ]
  for (const { value, keys, wrap } of identities) {
    for (const key of keys) {
      it.each(['', ' \t\n', '\ud800', '\udfff'])(`rejects invalid identity ${key} %j`, (invalid) => {
        expect(decode(wrap({ ...value, [key]: invalid }))).toBeNull()
      })
    }
  }
  it.each(['', ' ', '\ud800', 2, null])('rejects invalid option identity %j', (invalid) => {
    expect(decode(withTest({ ...test, optionCodes: [invalid] }))).toBeNull()
  })
  it.each([0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '1', null])('rejects sortOrder %j', (sortOrder) => {
    expect(decode(withBinding({ ...binding, sortOrder }))).toBeNull()
  })
  it.each([Number.MIN_SAFE_INTEGER, -1, 0, Number.MAX_SAFE_INTEGER])('accepts safe sortOrder %s', (sortOrder) => {
    const raw = withBinding({ ...binding, sortOrder })
    expect(decode(raw)).toEqual(raw)
  })
  it.each([null, [], false, {}, { ...vocabulary, semanticsVersion: 2 }, { ...vocabulary, semanticsVersion: 'editorial-production-2' }])('rejects invalid root %j', (raw) => {
    expect(decode(raw)).toBeNull()
  })
  it('rejects the removed minimumContractVersion field at root and family', () => {
    for (const minimumContractVersion of [1, 2, null]) {
      expect(decode({ ...vocabulary, minimumContractVersion })).toBeNull()
      expect(decode({
        ...vocabulary, families: [{ ...family, minimumContractVersion }],
      })).toBeNull()
    }
  })
  it('rejects unknown routes and fields belonging to another route', () => {
    for (const policy of [{ route: 'custom' }, { ...pending, cases: [] }, { ...cases, rule }, { ...fact, cases: [] }]) {
      expect(decode(withPolicy(policy))).toBeNull()
    }
  })

  it('composes all six existing definition branches without losing metadata', () => {
    const definitions = ['text', 'boolean', 'number', 'range', 'single', 'multi'].map((type) => ({
      ...definition, type,
      ...(type === 'number' || type === 'range' ? { units: [{ code: null, label: null, sortOrder: -1 }], numericPolicy: { status: 'pending' } } : {}),
      ...(type === 'single' || type === 'multi' ? {
        options: [{ code: 'old', label: ' Archived ', archived: true, sortOrder: -1 }],
        groups: [{ code: 'group', label: ' Group ', optionCodes: ['old'] }],
        aliases: [{ label: ' Alias ', optionCode: 'old' }],
      } : {}),
    }))
    const raw = { ...vocabulary, definitions }
    expect(decode(raw)).toEqual(raw)
  })
  it('rejects the whole root for a malformed definition or nested child, never pruning', () => {
    for (const raw of [
      { ...vocabulary, definitions: [definition, { ...definition, type: 'range' }] },
      { ...vocabulary, families: [family, { ...family, bindings: [binding, { ...binding, policy: { ...cases, cases: [policyCase, { ...policyCase, when: [test, { ...test, operator: 'bad' }] }] } }] }] },
    ]) expect(decode(raw)).toBeNull()
  })
  it('returns deeply detached ordered data and leaves input unchanged', () => {
    const raw = structuredClone({ ...vocabulary, families: [family, { ...family, code: 'second' }] })
    const before = structuredClone(raw)
    const decoded = decode(raw)!
    expect(decoded).toEqual(before)
    decoded.families.reverse()
    decoded.families[1]!.label = 'changed'
    const policy = decoded.families[1]!.bindings[0]!.policy
    if (policy.route === 'option_cases') policy.cases[0]!.when[0]!.optionCodes.reverse()
    decoded.definitions[0]!.label = 'changed'
    expect(raw).toEqual(before)
  })
  it('defers selector cycles, numeric relationships and production binding admission', () => {
    const selfSelector = {
      ...test, definitionCode: binding.definitionCode, optionCodes: ['missing'],
    }
    const raw = {
      ...vocabulary,
      families: [{
        ...family, bindings: [{
          ...binding,
          policy: { ...cases, cases: [{ ...policyCase, when: [selfSelector] }] },
        }],
      }, { ...family, bindings: [] }],
      definitions: [{
        ...definition, type: 'range', units: [{ code: null, label: 'unpaired', sortOrder: 0 }],
        numericPolicy: {
          status: 'resolved', magnitude: '', integer: true,
          lower: 20, upper: -10, lowerInclusive: true, upperInclusive: false,
        },
      }],
    }
    expect(decode(raw)).toEqual(raw)
    const invalid = structuredClone(raw)
    invalid.families[0]!.bindings[0]!.policy.cases[0]!.when[0]!.operator = 'invalid'
    const before = structuredClone(invalid)
    expect(decode(invalid)).toBeNull()
    expect(invalid).toEqual(before)
  })
  it('preserves explicit true and false flags', () => {
    for (const flag of [true, false]) {
      const raw = withBinding({
        ...binding, searchable: flag,
        policy: { ...cases, cases: [{
          ...policyCase, required: flag, allowNA: flag, evidenceRequired: flag,
        }] },
      })
      expect(decode(raw)).toEqual(raw)
    }
  })
  it('rejects a nested getter without invoking it', () => {
    let calls = 0
    const nested = { ...test }
    Object.defineProperty(nested, 'operator', { enumerable: true, get() { calls++; return 'equals_set' } })
    expect(decode(withTest(nested))).toBeNull()
    expect(calls).toBe(0)
  })
  it('preserves empty/duplicate/unresolved input without claiming metadata qualification', () => {
    const unresolved = { ...policyCase, required: true, applicability: 'unresolved', when: [test, test] }
    const raw = withBinding({ ...binding, publicationCheck: 'when_asserted', policy: { ...cases, cases: [unresolved, unresolved, { ...policyCase, when: [] }] } })
    expect(decode(raw)).toEqual(raw)
    for (const policy of [{ ...cases, cases: [] }, { ...cases, cases: [{ ...policyCase, when: [{ ...test, optionCodes: [] }, { ...test, optionCodes: ['old', 'old'] }] }] }, fact]) {
      const candidate = { ...withPolicy(policy), definitions: [] }
      expect(decode(candidate)).toEqual(candidate)
    }
    const empty = { ...vocabulary, families: [], definitions: [] }
    expect(decode(empty)).toEqual(empty)
    const duplicate = { ...vocabulary, families: [family, family], definitions: [definition, definition] }
    expect(decode(duplicate)).toEqual(duplicate)
  })
})
