import { describe, expect, it } from 'vitest'
import type { EditorialKnownPayload, EditorialValue } from '../../interfaces/editorial-contract-value.types'
import { resolveEditorialAssignmentInput as resolve, toEditorialAssignmentInput as toInput,
  type EditorialAssignmentInput, type EditorialPayloadInput } from '../editorial-contract-assignment-input'

const target = { code: 'attribute', owner: 'sellable', variantId: 'v' } as const
const evidence = { sourceRef: ' Manufacturer ', verifiedOn: '2026-01-01' }
const known = (payload: EditorialPayloadInput): EditorialAssignmentInput => ({ state: 'known', payload, evidence: null })
const saved = (payload: EditorialKnownPayload): Extract<EditorialValue, { state: 'known' }> => ({ ...target, state: 'known', payload, evidence })
const complete = (assignment: EditorialValue | null) => ({ status: 'complete', assignment })

describe('S33 raw assignment inputs, not admission or a second editor store', () => {
  it('keeps omission, unknown and NA distinct', () => {
    expect(toInput(null)).toEqual({ state: 'omitted' })
    expect(resolve(target, { state: 'omitted' })).toEqual(complete(null))
    for (const state of ['unknown', 'not_applicable'] as const) {
      const value = { ...target, state, evidence: null }
      expect(toInput(value)).toEqual({ state })
      expect(resolve(target, { state })).toEqual(complete(value))
    }
  })
  it.each<EditorialKnownPayload>([
    { type: 'text', value: ' exact text ' }, { type: 'text', value: '' },
    { type: 'boolean', value: false }, { type: 'boolean', value: true },
    { type: 'single', value: 'exact.option' }, { type: 'single', value: '' },
    { type: 'multi', value: [] }, { type: 'multi', value: ['b', 'a'] },
    { type: 'number', value: -0.25, unit: null }, { type: 'number', value: 1e25, unit: 'u' },
    { type: 'range', min: -2, max: 3, unit: '°C' },
  ])('roundtrips decoded %j without normalizing text, order or evidence', payload => {
    const value = saved(payload); const input = toInput(value)
    expect(resolve(target, input)).toEqual(complete(value))
    expect(input).not.toBe(value)
  })
  it.each(['', ' ', '-', '.', '1e', '1e-', 'NaN', 'Infinity', '-Infinity', '0x10', '0b10', '1,2', '1x', '1e999'])(
    'keeps number input %j incomplete instead of zero/nonfinite/old-value fallback', value => {
      const input = known({ type: 'number', value, unit: null })
      expect(resolve(target, input)).toEqual({ status: 'incomplete' })
      expect(resolve(target, JSON.parse(JSON.stringify(input)))).toEqual({ status: 'incomplete' })
      expect(input).toEqual(known({ type: 'number', value, unit: null }))
    },
  )
  it.each([['0', 0], ['-0.5', -0.5], ['.5', 0.5], ['1.', 1], ['1e+2', 100], ['2E-2', 0.02]] as const)(
    'converts complete finite decimal %s', (value, expected) => {
      expect(resolve(target, known({ type: 'number', value, unit: null }))).toEqual(complete({
        ...target, state: 'known', payload: { type: 'number', value: expected, unit: null }, evidence: null,
      }))
    },
  )
  it('distinguishes unselected boolean/single/unit from false, empty text/multi and no-unit', () => {
    for (const payload of [{ type: 'boolean', value: null }, { type: 'single', value: null },
      { type: 'number', value: '2' }, { type: 'range', min: '1', max: '2' }, { type: 'range', min: '1', max: '2', unit: null }] satisfies EditorialPayloadInput[]) {
      expect(resolve(target, known(payload))).toEqual({ status: 'incomplete' })
    }
    expect(resolve(target, known({ type: 'boolean', value: false }))).toEqual(complete({
      ...target, state: 'known', payload: { type: 'boolean', value: false }, evidence: null,
    }))
  })
  it.each([['', '2'], ['1', ''], ['1e', '2'], ['1', 'Infinity']])('requires both finite range endpoints %j/%j', (min, max) => {
    expect(resolve(target, known({ type: 'range', min, max, unit: 'cm' }))).toEqual({ status: 'incomplete' })
  })
  it('does not confuse control completeness with numeric domain/order or option membership', () => {
    expect(resolve(target, known({ type: 'range', min: '9', max: '-2', unit: 'obsolete' }))).toEqual(complete({
      ...target, state: 'known', payload: { type: 'range', min: 9, max: -2, unit: 'obsolete' }, evidence: null,
    }))
    expect(resolve(target, known({ type: 'multi', value: ['missing', 'missing'] }))).toEqual(complete({
      ...target, state: 'known', payload: { type: 'multi', value: ['missing', 'missing'] }, evidence: null,
    }))
  })
  it.each([
    { sourceRef: '', verifiedOn: '' }, { sourceRef: 'Source', verifiedOn: '' },
    { sourceRef: '', verifiedOn: '2026-01-01' }, { sourceRef: 'Source', verifiedOn: '2025-02-29' },
  ])('retains partial/invalid evidence %j without silently dropping it', invalid => {
    const value = { ...saved({ type: 'text', value: '' }), evidence: invalid }
    const input = toInput(value)
    expect(input).toEqual({ state: 'known', payload: { type: 'text', value: '' }, evidence: invalid })
    expect(resolve(target, input)).toEqual({ status: 'incomplete' })
    expect(input).toEqual(toInput(value))
  })
  it('absent evidence remains draft-incomplete policy-wise but control-complete', () => {
    expect(resolve(target, known({ type: 'text', value: '' }))).toEqual(complete({
      ...target, state: 'known', payload: { type: 'text', value: '' }, evidence: null,
    }))
  })
  it('does not leak a prior valid numeric value after clearing and restoring raw input', () => {
    const input = toInput(saved({ type: 'number', value: 42, unit: 'kg' }))
    if (input.state !== 'known' || input.payload.type !== 'number') throw new Error('fixture')
    input.payload.value = ''
    const restored = JSON.parse(JSON.stringify(input)) as EditorialAssignmentInput
    expect(resolve(target, restored)).toEqual({ status: 'incomplete' })
    expect(restored).toEqual(input)
  })
  it('rejects primitive-invalid strings rather than coercing them into wire assignments', () => {
    expect(resolve(target, known({ type: 'text', value: '\uD800' }))).toEqual({ status: 'incomplete' })
  })
  it('detaches multi arrays/evidence in both directions and preserves frozen sources', () => {
    const value = saved({ type: 'multi', value: ['b', 'a'] })
    function freeze(raw: unknown): void {
      if (raw && typeof raw === 'object') { Object.values(raw).forEach(freeze); Object.freeze(raw) }
    }
    const before = JSON.stringify(value); freeze(value)
    const input = toInput(value)
    expect(input.state).toBe('known'); freeze(input)
    const result = resolve(target, input)
    expect(result.status).toBe('complete')
    if (result.status !== 'complete' || result.assignment?.state !== 'known' || result.assignment.payload.type !== 'multi') throw new Error('fixture')
    result.assignment.payload.value.push('new'); result.assignment.evidence!.sourceRef = 'Changed'
    expect(JSON.stringify(value)).toBe(before); expect(input).toEqual(toInput(value))
  })
})
