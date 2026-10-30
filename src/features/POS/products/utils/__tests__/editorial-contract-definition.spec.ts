import { describe, expect, it } from 'vitest'
import { decodeEditorialDefinition } from '../editorial-contract-definition'
import type { EditorialDefinition } from '../../interfaces/editorial-contract-definition.types'

const base = { id: ' custom-id ', code: 'custom.definition', label: ' Label 🐾 ' }
const unit = { code: 'kg', label: ' Kilograms ', sortOrder: -2 }
const option = { code: 'old', label: ' Archived ', archived: true, sortOrder: -1 }
const group = { code: 'group', label: ' Group ', optionCodes: ['old', 'other'] }
const alias = { label: ' Alias ', optionCode: 'old' }
const resolved = {
  status: 'resolved', magnitude: 'custom magnitude', integer: false,
  lower: -2.5, lowerInclusive: true, upper: 12, upperInclusive: false,
}
function definition(type: string): Record<string, unknown> {
  if (type === 'number' || type === 'range') {
    return { ...base, type, units: [{ ...unit }], numericPolicy: { ...resolved } }
  }
  if (type === 'single' || type === 'multi') {
    return {
      ...base, type, options: [{ ...option }],
      groups: [{ ...group, optionCodes: [...group.optionCodes] }], aliases: [{ ...alias }],
    }
  }
  return { ...base, type }
}
const branches = ['text', 'boolean', 'number', 'range', 'single', 'multi']

// These tables exercise every declared field at its actual nested schema boundary.
const shapes = [
  { name: 'text', value: definition('text'), wrap: (v: unknown) => v },
  { name: 'boolean', value: definition('boolean'), wrap: (v: unknown) => v },
  { name: 'number', value: definition('number'), wrap: (v: unknown) => v },
  { name: 'range', value: definition('range'), wrap: (v: unknown) => v },
  { name: 'single', value: definition('single'), wrap: (v: unknown) => v },
  { name: 'multi', value: definition('multi'), wrap: (v: unknown) => v },
  { name: 'unit', value: unit, wrap: (v: unknown) => ({ ...definition('number'), units: [v] }) },
  { name: 'option', value: option, wrap: (v: unknown) => ({ ...definition('single'), options: [v] }) },
  { name: 'group', value: group, wrap: (v: unknown) => ({ ...definition('single'), groups: [v] }) },
  { name: 'alias', value: alias, wrap: (v: unknown) => ({ ...definition('single'), aliases: [v] }) },
  { name: 'pending', value: { status: 'pending' }, wrap: (v: unknown) => ({ ...definition('number'), numericPolicy: v }) },
  { name: 'resolved', value: resolved, wrap: (v: unknown) => ({ ...definition('number'), numericPolicy: v }) },
]

describe('decodeEditorialDefinition primitive contract', () => {
  it.each(branches)('preserves the complete %s branch', (type) => {
    const raw = definition(type)
    const decoded: EditorialDefinition | null = decodeEditorialDefinition(raw)
    expect(decoded).toEqual(raw)
    expect(decoded).not.toBe(raw)
  })

  for (const { name, value, wrap } of shapes) {
    describe(`${name} shape`, () => {
      it('rejects an extra field', () => {
        expect(decodeEditorialDefinition(wrap({ ...value, extra: true }))).toBeNull()
      })
      for (const key of Object.keys(value)) {
        it(`requires ${key}`, () => {
          const missing: Record<string, unknown> = { ...value }
          delete missing[key]
          expect(decodeEditorialDefinition(wrap(missing))).toBeNull()
        })
        it(`rejects an object in primitive/array field ${key}`, () => {
          expect(decodeEditorialDefinition(wrap({ ...value, [key]: {} }))).toBeNull()
        })
      }
    })
  }

  it.each(['number', 'range'])('accepts pending and nullable resolved policy for %s', (type) => {
    for (const numericPolicy of [
      { status: 'pending' },
      { ...resolved, magnitude: '', lower: null, upper: null },
    ]) {
      const raw = { ...definition(type), numericPolicy, units: [] }
      expect(decodeEditorialDefinition(raw)).toEqual(raw)
    }
  })

  it.each(['single', 'multi'])('requires but accepts empty %s metadata arrays', (type) => {
    const raw = { ...definition(type), options: [], groups: [], aliases: [] }
    expect(decodeEditorialDefinition(raw)).toEqual(raw)
  })

  it.each([null, [], false, 1, 'text', {}, { ...base, type: 'unknown' }])('rejects invalid root %j', (raw) => {
    expect(decodeEditorialDefinition(raw)).toBeNull()
  })

  it('rejects metadata belonging to another branch', () => {
    for (const type of branches) {
      const raw = definition(type)
      const extra = type === 'single' || type === 'multi' ? { units: [] } : { options: [] }
      expect(decodeEditorialDefinition({ ...raw, ...extra })).toBeNull()
    }
    expect(decodeEditorialDefinition({ ...definition('number'), numericPolicy: { status: 'pending', lower: null } })).toBeNull()
  })

  const stringTargets = [
    ...['id', 'code', 'label'].map((key) => (v: unknown) => ({ ...definition('text'), [key]: v })),
    ...['code', 'label'].map((key) => (v: unknown) => ({ ...definition('number'), units: [{ ...unit, [key]: v }] })),
    ...['code', 'label'].map((key) => (v: unknown) => ({ ...definition('single'), options: [{ ...option, [key]: v }] })),
    ...['code', 'label'].map((key) => (v: unknown) => ({ ...definition('single'), groups: [{ ...group, [key]: v }] })),
    ...['label', 'optionCode'].map((key) => (v: unknown) => ({ ...definition('single'), aliases: [{ ...alias, [key]: v }] })),
    (v: unknown) => ({ ...definition('single'), groups: [{ ...group, optionCodes: [v] }] }),
  ]
  it.each(['', ' \t\r\n\u00a0\ufeff ', '\ud800', '\udfff', 42, false])('rejects nonblank/scalar violations %j everywhere', (bad) => {
    for (const target of stringTargets) expect(decodeEditorialDefinition(target(bad))).toBeNull()
  })

  it('checks trim without changing original strings, including non-trim zero-width space', () => {
    for (const value of [' \tcustom 🐾\ufeff ', '\u200b']) {
      for (const target of stringTargets) {
        const raw = target(value)
        expect(decodeEditorialDefinition(raw)).toEqual(raw)
      }
    }
  })

  it.each([null, '', ' \t ', 'unlisted magnitude 🐾'])('preserves scalar magnitude %j (null alone invalid)', (magnitude) => {
    const raw = { ...definition('number'), numericPolicy: { ...resolved, magnitude } }
    expect(decodeEditorialDefinition(raw)).toEqual(magnitude === null ? null : raw)
  })

  it.each([Number.NaN, Infinity, -Infinity, '1', false])('rejects invalid bounds %j', (bad) => {
    for (const key of ['lower', 'upper']) {
      expect(decodeEditorialDefinition({ ...definition('number'), numericPolicy: { ...resolved, [key]: bad } })).toBeNull()
    }
  })
  it.each(['integer', 'lowerInclusive', 'upperInclusive'])('requires boolean %s', (key) => {
    expect(decodeEditorialDefinition({ ...definition('number'), numericPolicy: { ...resolved, [key]: 1 } })).toBeNull()
  })
  it('requires an actual archived boolean', () => {
    expect(decodeEditorialDefinition({ ...definition('single'), options: [{ ...option, archived: 'true' }] })).toBeNull()
  })

  it.each([Number.MIN_SAFE_INTEGER, -1, 0, Number.MAX_SAFE_INTEGER])('preserves safe sortOrder %s', (sortOrder) => {
    for (const raw of [
      { ...definition('number'), units: [{ ...unit, sortOrder }] },
      { ...definition('single'), options: [{ ...option, sortOrder }] },
    ]) expect(decodeEditorialDefinition(raw)).toEqual(raw)
  })
  it.each([Number.MIN_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER + 1, 0.5, NaN, Infinity, '1', null])('rejects unsafe sortOrder %j', (sortOrder) => {
    expect(decodeEditorialDefinition({ ...definition('number'), units: [{ ...unit, sortOrder }] })).toBeNull()
    expect(decodeEditorialDefinition({ ...definition('single'), options: [{ ...option, sortOrder }] })).toBeNull()
  })

  it('preserves shape-valid content that later metadata admission must qualify', () => {
    const examples = [
      { ...definition('range'), units: [{ ...unit, code: null, label: null }] },
      { ...definition('number'), units: [{ ...unit, code: null }, { ...unit, label: null }] },
      { ...definition('number'), numericPolicy: { ...resolved, lower: 10, upper: -10 } },
      { ...definition('number'), numericPolicy: { ...resolved, lower: null, lowerInclusive: true } },
      { ...definition('single'), options: [option, option], groups: [{ ...group, optionCodes: ['missing', 'missing'] }], aliases: [alias, { ...alias, label: ' ALIAS ' }, { ...alias, optionCode: 'missing' }] },
      { ...definition('text'), code: 'measure.net_mass' },
    ]
    for (const raw of examples) expect(decodeEditorialDefinition(raw)).toEqual(raw)
  })

  it('preserves order, archived content and custom codes without mutating or sharing nested data', () => {
    const raw = {
      ...definition('multi'), options: [option, { ...option, code: 'first', sortOrder: -10 }],
      groups: [group, { ...group, code: 'first' }], aliases: [alias, { ...alias, label: 'First' }],
    }
    const before = structuredClone(raw)
    const decoded = decodeEditorialDefinition(raw)
    expect(decoded).toEqual(before)
    if (decoded?.type !== 'multi') throw new Error('Expected multi')
    decoded.options[0]!.label = 'changed'
    decoded.groups[0]!.optionCodes.push('changed')
    decoded.aliases[0]!.label = 'changed'
    expect(raw).toEqual(before)
    const numeric = definition('number')
    const numericBefore = structuredClone(numeric)
    const number = decodeEditorialDefinition(numeric)
    if (number?.type !== 'number') throw new Error('Expected number')
    number.units[0]!.label = 'changed'
    if (number.numericPolicy.status !== 'resolved') throw new Error('Expected resolved')
    number.numericPolicy.magnitude = 'changed'
    expect(numeric).toEqual(numericBefore)
  })

  it('preserves unit order and empty group references without defaults', () => {
    const raw = {
      ...definition('range'),
      units: [{ ...unit, sortOrder: 20 }, { code: null, label: null, sortOrder: -20 }],
    }
    expect(decodeEditorialDefinition(raw)).toEqual(raw)
    const choice = { ...definition('single'), groups: [{ ...group, optionCodes: [] }] }
    expect(decodeEditorialDefinition(choice)).toEqual(choice)
  })

  it('rejects null metadata arrays and nested containers rather than pruning', () => {
    for (const key of ['options', 'groups', 'aliases']) {
      expect(decodeEditorialDefinition({ ...definition('single'), [key]: null })).toBeNull()
      expect(decodeEditorialDefinition({ ...definition('single'), [key]: [null] })).toBeNull()
    }
    expect(decodeEditorialDefinition({ ...definition('number'), units: null })).toBeNull()
    expect(decodeEditorialDefinition({ ...definition('number'), numericPolicy: null })).toBeNull()
    expect(decodeEditorialDefinition({ ...definition('single'), groups: [{ ...group, optionCodes: null }] })).toBeNull()
  })

  it('rejects a malformed nested member atomically without executing getters', () => {
    let calls = 0
    const trapped = Object.defineProperty({ ...option }, 'label', {
      enumerable: true, get() { calls++; return 'unexpected' },
    })
    expect(decodeEditorialDefinition({ ...definition('single'), options: [option, trapped] })).toBeNull()
    expect(calls).toBe(0)
    expect(decodeEditorialDefinition({ ...definition('single'), aliases: [alias, null] })).toBeNull()
    expect(decodeEditorialDefinition({ ...definition('number'), units: [unit, null] })).toBeNull()
    expect(decodeEditorialDefinition({ ...definition('single'), groups: [{ ...group, optionCodes: ['ok', null] }] })).toBeNull()
    expect(decodeEditorialDefinition({ ...definition('number'), numericPolicy: { ...resolved, magnitude: '\ud800' } })).toBeNull()
  })
})
