import { describe, expect, it } from 'vitest'
import type { EditorialDeclaration, EditorialDeclarationValues } from '../../interfaces/editorial-contract-declaration.types'
import { decodeEditorialDeclaration } from '../editorial-contract-declaration'
import { resolveEditorialDeclarationInput as resolve, toEditorialDeclarationInput as toInput,
  type EditorialDeclarationInput } from '../editorial-contract-declaration-input'

const evidence = { sourceRef: '  ficha 🐕  ', verifiedOn: '2024-02-29' }
const values = {
  contentMagnitude: 'mass', consumable: false, animalApplied: true,
  fitDeterminesChoice: false, capacityDeterminesChoice: true, electricalApplies: false,
  relevantDimensionCodes: { codes: ['measure.dimensions.internal_width', 'measure.dimensions.external_length'], toyTypes: ['z', 'a'] },
  relevantFitCodes: ['measure.fit.chest', 'measure.fit.neck'],
  relevantCapacityCodes: ['measure.capacity.habitat_usable_volume', 'measure.capacity.container'],
  relevantEquipmentCodes: ['measure.equipment.flow', 'measure.equipment.power'],
  presentationKind: 'packaging', optionalNonpertinenceCodes: ['color.base', 'material'],
} satisfies EditorialDeclarationValues
const keys = Object.keys(values) as (keyof EditorialDeclarationValues)[]
function known(key: keyof EditorialDeclarationValues = 'consumable'): EditorialDeclaration {
  // The primitive reader establishes the key/value correlation for these fixtures.
  return decodeEditorialDeclaration({ key, state: 'known', value: values[key], evidence, basis: '  base\n🐕  ' })!
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function raw(edit: Record<string, unknown> = {}): EditorialDeclarationInput {
  return { ...known(), ...edit } as EditorialDeclarationInput
}

describe('declaration control encoding (not admission)', () => {
  it('distinguishes omission from unknown', () => {
    expect(toInput(null)).toEqual({ state: 'omitted' })
    expect(resolve({ state: 'omitted' })).toEqual({ status: 'complete', declaration: null })
  })
  it.each(keys)('roundtrips the correlated known value for %s', (key) => {
    const declaration = freeze(known(key))
    const input = toInput(declaration)
    expect(input).toEqual(declaration)
    expect(input).not.toBe(declaration)
    expect(resolve(freeze(input))).toEqual({ status: 'complete', declaration })
  })
  it.each(keys)('encodes exact unknown %s without value/basis', (key) => {
    const declaration: EditorialDeclaration = { key, state: 'unknown', evidence: null }
    const input = toInput(freeze(declaration))
    expect(input).toEqual({ key, state: 'unknown' })
    expect(resolve(input)).toEqual({ status: 'complete', declaration })
  })
  it.each(['contentMagnitude', 'consumable', 'animalApplied', 'fitDeterminesChoice',
    'capacityDeterminesChoice', 'electricalApplies', 'presentationKind'] as const)(
    '%s null is unselected, not a known negative', (key) => {
      const input: EditorialDeclarationInput = { key, state: 'known', value: null, evidence, basis: '' }
      expect(resolve(input)).toEqual({ status: 'incomplete' })
    })
  it.each(['relevantFitCodes', 'relevantCapacityCodes', 'relevantEquipmentCodes', 'optionalNonpertinenceCodes'] as const)(
    'retains explicit known empty %s', (key) => {
      const input: EditorialDeclarationInput = { key, state: 'known', value: [], evidence, basis: '' }
      expect(resolve(input)).toEqual({ status: 'complete', declaration: input })
    })
  it('retains known false and independently empty dimension arrays', () => {
    expect(resolve(raw())).toEqual({ status: 'complete', declaration: known() })
    const input: EditorialDeclarationInput = { key: 'relevantDimensionCodes', state: 'known',
      value: { codes: [], toyTypes: [] }, evidence, basis: '' }
    expect(resolve(input)).toEqual({ status: 'complete', declaration: input })
  })
  it.each([null, { sourceRef: '', verifiedOn: '' }, { sourceRef: 'x', verifiedOn: '2023-02-29' },
    { sourceRef: 'x', verifiedOn: '2024-02-29\n' }, { sourceRef: 'x\u0000', verifiedOn: '2024-01-01' },
    { sourceRef: 'x' }, { sourceRef: ' ', verifiedOn: '2024-01-01' },
  ])('rejects unselected or invalid supplied evidence %# atomically', (candidate) => {
    expect(resolve(raw({ evidence: candidate }))).toEqual({ status: 'incomplete' })
  })
  it('preserves future valid evidence and exact basis without trimming', () => {
    const input = raw({ evidence: { sourceRef: '  futuro  ', verifiedOn: '9999-12-31' } })
    expect(resolve(input)).toEqual({ status: 'complete', declaration: input })
  })
  it.each(['', ' ', 'x'.repeat(2001), '\u0000\n'])('leaves fresh-invalid basis downstream %#', (basis) => {
    const input = raw({ basis })
    expect(resolve(input)).toEqual({ status: 'complete', declaration: input })
  })
  it('preserves fresh-invalid history on initialization, but validates evidence on encoding', () => {
    const history = decodeEditorialDeclaration({ ...known('relevantDimensionCodes'), basis: '',
      evidence: { sourceRef: '', verifiedOn: 'not a date' } })!
    expect(history).not.toBeNull()
    const input = toInput(freeze(history))
    expect(input).toEqual(history)
    expect(resolve(input)).toEqual({ status: 'incomplete' })
  })
  it('keeps duplicate/oversized lists and unresolved references for downstream admission', () => {
    const input = raw({ key: 'relevantDimensionCodes', value: {
      codes: Array(9).fill('measure.dimensions.external_length'), toyTypes: ['missing', 'missing', '  exact  '],
    } })
    expect(resolve(input)).toEqual({ status: 'complete', declaration: input })
  })
  it('detaches nested value arrays and evidence in both directions', () => {
    const history = known('relevantDimensionCodes')
    const input = toInput(history)
    if (history.state !== 'known' || history.key !== 'relevantDimensionCodes' ||
      input.state !== 'known' || input.key !== 'relevantDimensionCodes') throw new Error('fixture')
    input.value.codes.reverse()
    input.value.toyTypes.push('new')
    input.evidence!.sourceRef = 'edited'
    expect(history).toEqual(known('relevantDimensionCodes'))
    const before = JSON.parse(JSON.stringify(input))
    const result = resolve(freeze(input))
    if (result.status !== 'complete' || result.declaration?.state !== 'known' ||
      result.declaration.key !== 'relevantDimensionCodes') throw new Error('encoding')
    result.declaration.value.codes.reverse()
    result.declaration.value.toyTypes.push('other')
    result.declaration.evidence.sourceRef = 'output'
    expect(input).toEqual(before)
  })
  it.each([
    { key: 'consumable', value: 'false' }, { key: 'contentMagnitude', value: 'invented' },
    { key: 'presentationKind', value: 'invented' }, { value: 1 }, { basis: '\ud800' },
    { key: 'relevantFitCodes', value: ['missing'] },
    { key: 'relevantDimensionCodes', value: { codes: [], toyTypes: [], extra: true } },
    { extra: true }, { state: 'not_applicable' },
  ])('rejects primitive-invalid raw edits %# without pruning', (edit) => {
    expect(resolve(raw(edit))).toEqual({ status: 'incomplete' })
  })
  it('never restores old valid data after serialized incomplete edits', () => {
    const input = toInput(known())
    expect(resolve(input).status).toBe('complete')
    const edited = JSON.parse(JSON.stringify({ ...input, evidence: null })) as EditorialDeclarationInput
    expect(resolve(edited)).toEqual({ status: 'incomplete' })
    expect(edited).toMatchObject({ state: 'known', value: false, evidence: null })
  })
  it('does not execute submitted getters', () => {
    let calls = 0
    const input = raw()
    Object.defineProperty(input, 'value', { enumerable: true, get() { calls++; return false } })
    expect(resolve(input)).toEqual({ status: 'incomplete' })
    expect(calls).toBe(0)
  })
})

// Compile-time correlation remains finite; this is not a permissive wire schema.
// @ts-expect-error Boolean keys cannot carry a finite enum value.
const wrongBoolean: EditorialDeclarationInput = { key: 'consumable', state: 'known', value: 'mass', evidence, basis: '' }
// @ts-expect-error Enum identities cannot be invented.
const wrongEnum: EditorialDeclarationInput = { key: 'contentMagnitude', state: 'known', value: 'custom', evidence, basis: '' }
void wrongBoolean
void wrongEnum
