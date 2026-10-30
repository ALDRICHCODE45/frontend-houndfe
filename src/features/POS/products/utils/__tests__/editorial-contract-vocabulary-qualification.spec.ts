import { describe, expect, it } from 'vitest'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'
import type {
  EditorialBinding, EditorialContractVocabulary as Vocabulary, EditorialPolicyCase,
} from '../../interfaces/editorial-contract-vocabulary.types'
import { qualifyEditorialContractVocabulary as qualify } from '../editorial-contract-vocabulary-qualification'
import { decodeEditorialContractVocabulary } from '../editorial-contract-vocabulary'

type Choice = Extract<EditorialDefinition, { type: 'single' | 'multi' }>
type Numeric = Extract<EditorialDefinition, { type: 'number' | 'range' }>
const choice = (v: Vocabulary, index = 0) => v.definitions[index] as Choice
const numeric = (v: Vocabulary) => v.definitions[2] as Numeric
const bindings = (v: Vocabulary) => v.families[0]!.bindings
const policyCase = (): EditorialPolicyCase => ({
  code: 'case', when: [{ definitionCode: 'selector', operator: 'intersects', optionCodes: ['a'] }],
  applicability: 'applicable', required: false, allowNA: false,
  evidenceRequired: false, documentary: 'unresolved',
})
const cases = (v: Vocabulary, items = [policyCase()], index = 1) => {
  bindings(v)[index]!.policy = { route: 'option_cases', cases: items }
}
function fixture(): Vocabulary {
  const definitions: EditorialDefinition[] = ['selector', 'dependent'].map((code) => ({
    id: `${code}-id`, code, label: ' Same label ', type: 'single',
    options: [
      { code: 'b', label: 'same', archived: true, sortOrder: 5 },
      { code: 'a', label: 'same', archived: false, sortOrder: -2 },
    ],
    groups: [{ code: 'a', label: 'same', optionCodes: ['b', 'a'] }],
    aliases: [{ label: ' Original ', optionCode: 'b' }],
  }))
  definitions.push({
    id: 'numeric-id', code: 'measure.net_mass', label: 'Mass', type: 'number',
    units: [{ code: 'kg', label: 'kg', sortOrder: 2 }, { code: null, label: null, sortOrder: -1 }],
    numericPolicy: {
      status: 'resolved', magnitude: 'custom magnitude', integer: false,
      lower: -10, lowerInclusive: false, upper: null, upperInclusive: false,
    },
  })
  const familyBindings: EditorialBinding[] = definitions.map((d, index) => ({
    definitionId: d.id, definitionCode: d.code, owner: index === 0 ? 'product' : 'sellable',
    sortOrder: -index, exposure: 'INTERNAL', searchable: false,
    publicationCheck: 'always', policy: { route: 'pending' },
  }))
  const v: Vocabulary = {
    semanticsVersion: 'editorial-production-1', definitions,
    families: [{ id: 'food-id', code: 'food', label: 'Food', bindings: familyBindings }],
  }
  cases(v)
  return v
}
function resolved(v: Vocabulary) {
  const policy = numeric(v).numericPolicy
  if (policy.status !== 'resolved') throw new Error('Expected resolved fixture')
  return policy
}
type Mutation = (v: Vocabulary) => void
function check(mutate: Mutation, accepted: boolean) {
  const input = fixture()
  mutate(input)
  const before = structuredClone(input)
  const output = qualify(input)
  expect(input).toEqual(before)
  if (!accepted) {
    expect(output).toBeNull()
    return
  }
  expect(output).toEqual(before) // Includes all strings, arrays, archive flags and ordering.
  expect(output).not.toBe(input)
  expect(output!.definitions).not.toBe(input.definitions)
  if (input.definitions.length > 0) {
    expect(output!.definitions[0]).not.toBe(input.definitions[0])
    expect(choice(output!).options).not.toBe(choice(input).options)
    choice(output!).options[0]!.label = 'detached'
  }
  expect(input).toEqual(before)
}

describe('S16 consumer vocabulary qualification (not full backend admission)', () => {
  it.each([
    ['product', 'product', true], ['product', 'sellable', false],
    ['sellable', 'product', true], ['sellable', 'sellable', true],
  ] as const)('S30 target %s with selector %s accepted=%s', (target, selector, accepted) => {
    const input = fixture()
    bindings(input)[1]!.owner = target
    bindings(input)[0]!.owner = selector
    const before = structuredClone(input)
    expect(decodeEditorialContractVocabulary(input)).toEqual(before)
    expect(qualify(input)).toEqual(accepted ? before : null)
    expect(input).toEqual(before)
  })

  it('S30 does not reject product pending or unconditional rules because sellable bindings exist', () => {
    check(v => {
      bindings(v)[1]!.owner = 'product'; bindings(v)[0]!.owner = 'sellable'
      bindings(v)[1]!.policy = { route: 'pending' }
    }, true)
    check(v => {
      bindings(v)[1]!.owner = 'product'; bindings(v)[0]!.owner = 'sellable'
      cases(v, [{ ...policyCase(), when: [] }])
    }, true)
  })

  it.each<[string, Mutation]>([
    ['family IDs unique', v => { v.families.push({ ...structuredClone(v.families[0]!), code: 'other' }) }],
    ['family codes unique', v => { v.families.push({ ...structuredClone(v.families[0]!), id: 'other' }) }],
    ['definition IDs unique', v => { v.definitions.push({ ...v.definitions[0]!, code: 'other' }) }],
    ['definition codes unique', v => { v.definitions.push({ ...v.definitions[0]!, id: 'other' }) }],
    ['binding unique per family even with different owner', v => {
      bindings(v).push({ ...bindings(v)[0]!, owner: 'sellable' })
    }],
    ['binding missing ID', v => { bindings(v)[0]!.definitionId = 'absent' }],
    ['binding missing code', v => { bindings(v)[0]!.definitionCode = 'absent' }],
    ['binding ID and code same identity', v => { bindings(v)[0]!.definitionCode = 'dependent' }],
    ['binding exact matching without trim', v => { bindings(v)[0]!.definitionId += ' ' }],
  ])('%s', (_, mutate) => check(mutate, false))

  it.each<[string, Mutation]>([
    ['unit null code requires null label', v => { numeric(v).units[0]!.code = null }],
    ['unit null label requires null code', v => { numeric(v).units[0]!.label = null }],
    ['range forbids null unit even when pending', v => {
      numeric(v).type = 'range'; numeric(v).numericPolicy = { status: 'pending' }
    }],
    ['unit codes unique', v => { numeric(v).units.push({ code: 'kg', label: 'other', sortOrder: 0 }) }],
    ['unit null code unique', v => { numeric(v).units.push({ code: null, label: null, sortOrder: 0 }) }],
    ['null lower inclusive false', v => { resolved(v).lower = null; resolved(v).lowerInclusive = true }],
    ['null upper inclusive false', v => { resolved(v).upperInclusive = true }],
    ['finite bounds ordered', v => { resolved(v).upper = -11 }],
    ['equal bounds require inclusive lower', v => {
      resolved(v).upper = -10; resolved(v).upperInclusive = true
    }],
    ['equal bounds require inclusive upper', v => {
      resolved(v).upper = -10; resolved(v).lowerInclusive = true
    }],
    ['equal bounds reject both exclusive', v => { resolved(v).upper = -10 }],
  ])('%s', (_, mutate) => check(mutate, false))

  it.each<[string, Mutation]>([
    ['option codes unique including archived identities', v => {
      choice(v).options.push({ ...choice(v).options[0]!, archived: false })
    }],
    ['group codes unique', v => { choice(v).groups.push(structuredClone(choice(v).groups[0]!)) }],
    ['group members unique', v => { choice(v).groups[0]!.optionCodes.push('a') }],
    ['group members must be options not aliases/groups', v => { choice(v).groups[0]!.optionCodes = [' Original '] }],
    ['alias exact labels unique even same target', v => { choice(v).aliases.push({ ...choice(v).aliases[0]! }) }],
    ['alias targets exist locally', v => { choice(v).aliases[0]!.optionCode = 'missing' }],
    ['option refs cannot resolve in other definition', v => {
      choice(v, 1).options.push({ code: 'foreign', label: 'foreign', archived: false, sortOrder: 0 })
      choice(v).groups[0]!.optionCodes = ['foreign']
    }],
  ])('%s', (_, mutate) => check(mutate, false))

  it.each<[string, Mutation]>([
    ['case codes unique per binding', v => { cases(v, [policyCase(), policyCase()]) }],
    ['when selector codes unique', v => {
      const c = policyCase(); c.when.push({ ...c.when[0]! }); cases(v, [c])
    }],
    ['expected options nonempty', v => {
      const c = policyCase(); c.when[0]!.optionCodes = []; cases(v, [c])
    }],
    ['expected options unique', v => {
      const c = policyCase(); c.when[0]!.optionCodes = ['a', 'a']; cases(v, [c])
    }],
    ['expected options must exist (no group expansion)', v => {
      choice(v).groups.push({ code: 'group-only', label: 'Group', optionCodes: ['a'] })
      const c = policyCase(); c.when[0]!.optionCodes = ['group-only']; cases(v, [c])
    }],
    ['selector must exist', v => {
      const c = policyCase(); c.when[0]!.definitionCode = 'missing'; cases(v, [c])
    }],
    ['selector must be bound', v => { bindings(v).shift() }],
    ['selector bound in another family insufficient', v => {
      v.families.push({ id: 'other', code: 'other', label: 'Other', bindings: [bindings(v).shift()!] })
    }],
    ['selector must be choice', v => {
      const c = policyCase(); c.when[0]!.definitionCode = 'measure.net_mass'; cases(v, [c])
    }],
    ['self dependency rejected', v => { cases(v, [policyCase()], 0) }],
    ['multi-node dependency cycle rejected', v => {
      const c = policyCase(); c.when[0]!.definitionCode = 'dependent'; cases(v, [c], 0)
    }],
    ['three-node conditional cycle rejected', v => {
      v.definitions[2] = { ...structuredClone(choice(v)), id: 'numeric-id', code: 'measure.net_mass' }
      const first = policyCase(); first.when[0]!.definitionCode = 'dependent'; cases(v, [first], 0)
      const second = policyCase(); second.when[0]!.definitionCode = 'measure.net_mass'; cases(v, [second], 1)
      cases(v, [policyCase()], 2)
    }],
    ['required implies applicable', v => {
      const c = policyCase(); c.required = true; c.applicability = 'not_applicable'; cases(v, [c])
    }],
    ['required cannot be unresolved', v => {
      const c = policyCase(); c.required = true; c.applicability = 'unresolved'; cases(v, [c])
    }],
    ['potentially required requires always', v => {
      const c = policyCase(); c.required = true; cases(v, [c]); bindings(v)[1]!.publicationCheck = 'when_asserted'
    }],
    ['fact rule family matches containing family', v => {
      bindings(v)[2]!.policy = { route: 'fact_rule', rule: { family: 'toy', ruleId: 'optional', parameter: 'measure.net_mass' } }
    }],
    ['fact rule parameter matches bound definition', v => {
      bindings(v)[2]!.policy = { route: 'fact_rule', rule: { family: 'food', ruleId: 'optional', parameter: 'animal.target' } }
    }],
    ['fact rule owner must be sellable', v => {
      bindings(v)[2]!.owner = 'product'
      bindings(v)[2]!.policy = { route: 'fact_rule', rule: { family: 'food', ruleId: 'optional', parameter: 'measure.net_mass' } }
    }],
    ['custom family cannot have fact rule', v => {
      v.families[0]!.code = 'custom'
      bindings(v)[2]!.policy = { route: 'fact_rule', rule: { family: 'food', ruleId: 'optional', parameter: 'measure.net_mass' } }
    }],
  ])('%s', (_, mutate) => check(mutate, false))

  it.each<[string, Mutation]>([
    ['archives, homonymous labels, separate option/group namespaces, cross-owner selectors', () => {}],
    ['overlapping groups', v => { choice(v).groups.push({ code: 'overlap', label: 'same', optionCodes: ['a'] }) }],
    ['original alias spellings equivalent under backend normalization', v => {
      choice(v).aliases = [' A ', 'a', 'é', 'e\u0301'].map(label => ({ label, optionCode: 'b' }))
    }],
    ['pending numeric is not resolved unbounded', v => { numeric(v).numericPolicy = { status: 'pending' } }],
    ['equal inclusive bounds', v => {
      Object.assign(resolved(v), { upper: -10, lowerInclusive: true, upperInclusive: true })
    }],
    ['negative fractional and unbounded policy without new physical domain', v => {
      Object.assign(resolved(v), { lower: null, upper: -1.5, upperInclusive: true, integer: true })
    }],
    ['range with nonnull units', v => { numeric(v).type = 'range'; numeric(v).units.pop() }],
    ['empty cases unresolved metadata', v => { cases(v, []) }],
    ['empty when unconditional and inert allowNA evidence documentary flags', v => {
      const c = policyCase(); c.when = []; c.required = true; c.allowNA = true
      c.evidenceRequired = true; c.documentary = 'not_applicable'; cases(v, [c])
    }],
    ['optional unresolved when_asserted metadata', v => {
      const c = policyCase(); c.applicability = 'unresolved'; cases(v, [c])
      bindings(v)[1]!.publicationCheck = 'when_asserted'
    }],
    ['overlapping cases not solved here', v => {
      const c = policyCase(); c.code = 'another'; c.applicability = 'not_applicable'; cases(v, [policyCase(), c])
    }],
    ['acyclic conditional intermediate selector and multi selector', v => {
      choice(v, 1).type = 'multi'
      const c = policyCase(); c.when[0]!.definitionCode = 'dependent'; cases(v, [c], 2)
    }],
    ['AND selectors and all operators with archived options', v => {
      choice(v, 1).type = 'multi'
      cases(v, [], 1)
      const c = policyCase(); c.when[0]!.operator = 'equals_set'; c.when[0]!.optionCodes = ['b']
      c.when.push({ definitionCode: 'dependent', operator: 'contains_all', optionCodes: ['b', 'a'] })
      cases(v, [c], 2)
    }],
    ['different exact identities are not trimmed', v => {
      v.definitions.push({ id: 'selector-id ', code: 'selector ', label: 'same', type: 'text' })
    }],
    ['identities and case codes may repeat in separate scopes', v => {
      v.families.push({ ...structuredClone(v.families[0]!), id: 'other', code: 'other' })
      choice(v, 1).aliases = structuredClone(choice(v).aliases)
    }],
    ['exact special-key IDs codes and refs', v => {
      const d = v.definitions[0]!; d.id = '__proto__'; d.code = 'constructor'
      bindings(v)[0]!.definitionId = d.id; bindings(v)[0]!.definitionCode = d.code
      const c = policyCase(); c.when[0]!.definitionCode = d.code; cases(v, [c])
      choice(v).options[1]!.code = '__proto__'; choice(v).groups[0]!.optionCodes = ['__proto__']
      c.when[0]!.optionCodes = ['__proto__']
    }],
    ['coherent fact rule without canonical inventory exposure table', v => {
      bindings(v)[2]!.policy = { route: 'fact_rule', rule: { family: 'food', ruleId: 'optional', parameter: 'measure.net_mass' } }
    }],
    ['empty vocabulary not publication authorization', v => { v.families = []; v.definitions = [] }],
  ])('accepts %s unchanged', (_, mutate) => check(mutate, true))

  it.each([null, {}, { semanticsVersion: 'old', families: [], definitions: [] }])('delegates primitive rejection: %j', raw => {
    const before = structuredClone(raw)
    expect(qualify(raw)).toBeNull()
    expect(raw).toEqual(before)
  })
  it('does not execute submitted getters', () => {
    let calls = 0
    const raw = { get families() { calls++; return [] } }
    expect(qualify(raw)).toBeNull()
    expect(calls).toBe(0)
  })
})
