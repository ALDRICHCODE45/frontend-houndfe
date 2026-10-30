import { describe, expect, it } from 'vitest'
import type { EditorialDeclaration, EditorialDeclarationValues } from '../../interfaces/editorial-contract-declaration.types'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES as productionCodes } from '../../interfaces/editorial-production-codes'
import { decodeEditorialDeclaration as decode } from '../editorial-contract-declaration'

const dimensions = [
  'measure.dimensions.external_length', 'measure.dimensions.external_width',
  'measure.dimensions.external_height', 'measure.dimensions.external_diameter',
  'measure.dimensions.internal_length', 'measure.dimensions.internal_width',
  'measure.dimensions.internal_height', 'measure.dimensions.internal_diameter',
] as const
const fits = ['measure.fit.neck', 'measure.fit.chest', 'measure.fit.back_length'] as const
const capacities = ['measure.capacity.container', 'measure.capacity.habitat_usable_volume'] as const
const equipment = [
  'measure.equipment.power', 'measure.equipment.voltage', 'measure.equipment.frequency',
  'measure.equipment.flow', 'measure.equipment.temperature',
] as const
const values = {
  contentMagnitude: 'mass', consumable: false, animalApplied: false,
  fitDeterminesChoice: false, capacityDeterminesChoice: false, electricalApplies: false,
  relevantDimensionCodes: { codes: [...dimensions], toyTypes: [' custom ', '', '🦴', ' custom '] },
  relevantFitCodes: [...fits], relevantCapacityCodes: [...capacities],
  relevantEquipmentCodes: [...equipment], presentationKind: 'formulation',
  optionalNonpertinenceCodes: [...productionCodes],
} satisfies EditorialDeclarationValues
const keys = Object.keys(values) as (keyof EditorialDeclarationValues)[]
const known = (key: keyof EditorialDeclarationValues = 'consumable', value: unknown = values[key]) => ({
  key, state: 'known', value, evidence: { sourceRef: ' ', verifiedOn: 'not a date' }, basis: '',
})
const unknown = (key: keyof EditorialDeclarationValues = 'consumable') => ({
  key, state: 'unknown', evidence: null,
})

// Compile-time correlation: narrowing the key must also narrow its value.
function booleanValue(declaration: EditorialDeclaration): boolean | undefined {
  if (declaration.key === 'consumable' && declaration.state === 'known') return declaration.value
}
void booleanValue
// @ts-expect-error known declarations require evidence and basis
const missingKnown: EditorialDeclaration = { key: 'consumable', state: 'known', value: false }
// @ts-expect-error values are correlated with their exact key
const wrongValue: EditorialDeclaration = { key: 'consumable', state: 'known', value: 'mass', evidence: { sourceRef: '', verifiedOn: '' }, basis: '' }
// @ts-expect-error unknown has neither value nor basis
const unknownValue: EditorialDeclaration = { key: 'consumable', state: 'unknown', evidence: null, value: false }
void [missingKnown, wrongValue, unknownValue]

describe('decodeEditorialDeclaration primitive shape', () => {
  it.each(keys)('preserves known and unknown %s without mutation', (key) => {
    for (const input of [known(key), unknown(key)]) {
      const before = structuredClone(input)
      expect(decode(input)).toEqual(input)
      expect(input).toEqual(before)
    }
  })

  it.each(keys)('requires and closes every branch field for %s', (key) => {
    for (const input of [known(key), unknown(key)]) {
      for (const field of Object.keys(input)) {
        const incomplete: Record<string, unknown> = { ...input }
        delete incomplete[field]
        expect(decode(incomplete)).toBeNull()
      }
      expect(decode({ ...input, extra: true })).toBeNull()
      expect(decode({ ...input, state: 'not_applicable' })).toBeNull()
    }
    expect(decode({ ...unknown(key), value: values[key] })).toBeNull()
    expect(decode({ ...unknown(key), basis: '' })).toBeNull()
    expect(decode({ ...unknown(key), evidence: { sourceRef: '', verifiedOn: '' } })).toBeNull()
    expect(decode({ ...known(key), evidence: null })).toBeNull()
  })

  it.each(['mass', 'volume', 'count', 'length', 'area'])('accepts magnitude %s', (value) => {
    expect(decode(known('contentMagnitude', value))).toEqual(known('contentMagnitude', value))
  })
  it.each(['formulation', 'device', 'packaging'])('accepts presentation %s', (value) => {
    expect(decode(known('presentationKind', value))).toEqual(known('presentationKind', value))
  })
  it.each(keys.filter((key) => typeof values[key] === 'boolean'))('accepts true %s', (key) => {
    expect(decode(known(key, true))).toEqual(known(key, true))
    for (const value of [0, 1, 'false', null, [], {}]) expect(decode(known(key, value))).toBeNull()
  })

  const subsets = [
    ['relevantFitCodes', fits], ['relevantCapacityCodes', capacities],
    ['relevantEquipmentCodes', equipment], ['optionalNonpertinenceCodes', productionCodes],
  ] as const
  it.each(subsets)('preserves empty, duplicated and ordered %s', (key, codes) => {
    for (const value of [[], [...codes].reverse(), [codes[0], codes[0]]]) {
      expect(decode(known(key, value))).toEqual(known(key, value))
    }
    for (const value of [codes[0], [null], [12], [[]], ['custom.code'], [' ' + codes[0]]]) {
      expect(decode(known(key, value))).toBeNull()
    }
    for (const code of productionCodes) {
      expect(decode(known(key, [code])) !== null).toBe((codes as readonly string[]).includes(code))
    }
  })

  it('closes dimension objects and admits only the eight exact dimension codes', () => {
    for (const code of productionCodes) {
      expect(decode(known('relevantDimensionCodes', { codes: [code], toyTypes: [] })) !== null)
        .toBe((dimensions as readonly string[]).includes(code))
    }
    for (const value of [
      {}, { codes: [] }, { toyTypes: [] }, { codes: [], toyTypes: [], extra: 1 },
      { codes: 'measure.dimensions.external_length', toyTypes: [] },
      { codes: [], toyTypes: '' }, { codes: [[]], toyTypes: [] },
      { codes: ['custom.code'], toyTypes: [] }, { codes: [], toyTypes: [false] },
    ]) expect(decode(known('relevantDimensionCodes', value))).toBeNull()
    const value = { codes: [dimensions[1], dimensions[0], dimensions[1]], toyTypes: [] }
    expect(decode(known('relevantDimensionCodes', value))).toEqual(known('relevantDimensionCodes', value))
    expect(decode(known('relevantDimensionCodes', { codes: [], toyTypes: [] })))
      .toEqual(known('relevantDimensionCodes', { codes: [], toyTypes: [] }))
  })

  it('rejects invalid identities, scalar values and evidence shapes without fresh admission', () => {
    for (const key of ['', 'Consumable', 'custom', '__proto__', 12, null, [], {}]) {
      expect(decode({ ...known(), key })).toBeNull()
      expect(decode({ ...unknown(), key })).toBeNull()
    }
    for (const state of ['', 'KNOWN', null, false, [], {}]) expect(decode({ ...known(), state })).toBeNull()
    for (const key of ['contentMagnitude', 'presentationKind'] as const) {
      for (const value of ['', 'MASS', 'custom', 1, null, [], {}]) expect(decode(known(key, value))).toBeNull()
    }
    for (const evidence of [null, {}, { sourceRef: '' }, { verifiedOn: '' },
      { sourceRef: '', verifiedOn: '', extra: '' }, { sourceRef: 1, verifiedOn: '' },
      { sourceRef: '', verifiedOn: false }]) expect(decode({ ...known(), evidence })).toBeNull()
    for (const bad of [12, null, false, [], {}, '\uD800', '\uDFFF']) {
      expect(decode({ ...known(), basis: bad })).toBeNull()
      expect(decode({ ...known(), evidence: { sourceRef: bad, verifiedOn: '' } })).toBeNull()
      expect(decode({ ...known(), evidence: { sourceRef: '', verifiedOn: bad } })).toBeNull()
      expect(decode(known('relevantDimensionCodes', { codes: [], toyTypes: [bad] }))).toBeNull()
    }
    const input = { ...known(), basis: ' \n🦴', evidence: { sourceRef: '', verifiedOn: '2025-99-99' } }
    expect(decode(input)).toEqual(input)
    const long = 'x'.repeat(10000)
    const unqualified = {
      ...known('relevantDimensionCodes', { codes: [], toyTypes: Array(300).fill(long) }),
      evidence: { sourceRef: long, verifiedOn: long }, basis: long,
    }
    expect(decode(unqualified)).toEqual(unqualified)
  })

  it('detaches every nested array, object and evidence', () => {
    for (const key of keys) {
      const input = known(key)
      const before = structuredClone(input)
      const output = decode(input)
      expect(output).toEqual(input)
      expect(output).not.toBe(input)
      if (output?.state !== 'known') throw new Error('expected known')
      expect(output.evidence).not.toBe(input.evidence)
      output.evidence.sourceRef = 'changed'
      expect(input.evidence.sourceRef).toBe(' ')
      if (typeof input.value === 'object' && input.value !== null) {
        expect(output.value).not.toBe(input.value)
        if (Array.isArray(output.value)) output.value.reverse()
        else if (typeof output.value === 'object') {
          expect(output.value.codes).not.toBe(values.relevantDimensionCodes.codes)
          expect(output.value.toyTypes).not.toBe(values.relevantDimensionCodes.toyTypes)
          output.value.codes.push(dimensions[0])
          output.value.toyTypes.push('changed')
        }
        expect(input).toEqual(before)
      }
    }
  })

  it('rejects unreadable inputs without mutation or executing accessors/hooks', () => {
    let calls = 0
    const accessor = () => { calls++; return false }
    const root = Object.defineProperty(known(), 'value', { enumerable: true, get: accessor })
    const evidence = Object.defineProperty({}, 'sourceRef', { enumerable: true, get: accessor })
    const array = Object.defineProperty([], '0', { enumerable: true, get: accessor })
    const dimensionValue = Object.defineProperty({ toyTypes: [] }, 'codes', { enumerable: true, get: accessor })
    const cycle: Record<string, unknown> = known()
    cycle.extra = cycle
    const sparse = new Array(1)
    const decorated = Object.assign([], { extra: true })
    const symbol = { ...known(), [Symbol('extra')]: true }
    const hidden = Object.defineProperty(known(), 'extra', { value: true })
    const hook = { ...known(), toJSON() { calls++; return known() } }
    for (const input of [
      undefined, null, 0, false, '', [], new Date(0), Object.create(known()),
      root, { ...known(), evidence }, known('relevantFitCodes', array), cycle, symbol, hidden, hook,
      known('relevantDimensionCodes', dimensionValue),
      known('relevantFitCodes', sparse), known('relevantFitCodes', decorated),
      known('relevantDimensionCodes', { codes: [], toyTypes: array }),
    ]) {
      const before = input && typeof input === 'object' ? Object.getOwnPropertyDescriptors(input) : null
      expect(decode(input)).toBeNull()
      if (before) expect(Object.getOwnPropertyDescriptors(input)).toEqual(before)
    }
    const invalid = known('relevantDimensionCodes', { codes: [dimensions[0]], toyTypes: [12] })
    const before = structuredClone(invalid)
    Object.freeze(invalid.evidence)
    Object.freeze(invalid)
    expect(decode(invalid)).toBeNull()
    expect(invalid).toEqual(before)
    expect(calls).toBe(0)
    expect(Object.getOwnPropertyDescriptor(root, 'value')?.get).toBe(accessor)
    expect(Object.getOwnPropertyDescriptor(array, '0')?.get).toBe(accessor)
    const plainNullPrototype = Object.assign(Object.create(null), known())
    expect(decode(Object.freeze(plainNullPrototype))).toEqual(known())
  })
})
