import { describe, expect, it, vi } from 'vitest'
import { decodeEditorialValue } from '../editorial-contract-value'

const base = { code: 'custom:code', owner: 'product', variantId: null }
const payloads = [
  { type: 'text', value: '  café 😀\u0000  ' },
  { type: 'boolean', value: false },
  { type: 'number', value: -1.25, unit: null },
  { type: 'single', value: 'unlisted' },
  { type: 'multi', value: ['z', 'a', 'z'] },
  { type: 'range', min: 10, max: -2, unit: '' },
]
const known = (payload: unknown = payloads[0], evidence: unknown = null) => ({
  ...base, state: 'known', payload, evidence,
})
const without = (raw: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(raw).filter(([name]) => name !== key))

describe('target editorial primitive value decoding', () => {
  it.each(payloads)('reads known payload %j with null or supplied evidence', (payload) => {
    for (const evidence of [null, { sourceRef: '', verifiedOn: 'not a calendar date' }]) {
      const raw = known(payload, evidence)
      expect(decodeEditorialValue(raw)).toEqual(raw)
    }
  })

  it.each(['unknown', 'not_applicable'])('reads closed %s without a payload', (state) => {
    const raw = { ...base, state, evidence: null }
    expect(decodeEditorialValue(raw)).toEqual(raw)
    for (const invalid of [
      { ...raw, payload: null }, { ...raw, payload: payloads[0] },
      { ...raw, evidence: { sourceRef: 'ref', verifiedOn: '2026-01-01' } },
      without(raw, 'evidence'), { ...raw, evidence: undefined },
    ]) expect(decodeEditorialValue(invalid)).toBeNull()
  })

  it('requires every value, payload and evidence key and forbids extras', () => {
    const evidence = { sourceRef: 'ref', verifiedOn: 'date' }
    const raw = known(payloads[0], evidence)
    for (const key of Object.keys(raw)) expect(decodeEditorialValue(without(raw, key))).toBeNull()
    expect(decodeEditorialValue({ ...raw, extra: true })).toBeNull()
    for (const payload of payloads) {
      for (const key of Object.keys(payload)) {
        expect(decodeEditorialValue(known(without(payload, key)))).toBeNull()
      }
      expect(decodeEditorialValue(known({ ...payload, extra: true }))).toBeNull()
    }
    for (const key of Object.keys(evidence)) {
      expect(decodeEditorialValue(known(payloads[0], without(evidence, key)))).toBeNull()
    }
    expect(decodeEditorialValue(known(payloads[0], { ...evidence, extra: true }))).toBeNull()
  })

  it.each([
    null, undefined, [], 'value', 1, true, {},
    { ...base, type: 'text', value: 'old flat assignment' },
    { ...known(), code: 1 }, { ...known(), owner: 'variant' },
    { ...known(), variantId: 1 }, { ...known(), state: 'other' },
    { ...known(), payload: null }, { ...known(), evidence: false },
    known({ type: 'text', value: 1 }), known({ type: 'boolean', value: 'false' }),
    known({ type: 'number', value: '1', unit: null }),
    known({ type: 'number', value: 1, unit: 1 }),
    known({ type: 'single', value: [] }), known({ type: 'multi', value: 'x' }),
    known({ type: 'multi', value: ['x', 1] }),
    known({ type: 'range', min: '1', max: 2, unit: 'kg' }),
    known({ type: 'range', min: 1, max: null, unit: 'kg' }),
    known({ type: 'range', min: 1, max: 2, unit: null }),
    known({ type: 'other', value: 'x' }),
    known(payloads[0], { sourceRef: null, verifiedOn: 'date' }),
    known(payloads[0], { sourceRef: 'ref', verifiedOn: 1 }),
  ])('rejects invalid primitive shape %#', (raw) => {
    expect(decodeEditorialValue(raw)).toBeNull()
  })

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite number %s in all numeric slots', (value) => {
    for (const payload of [
      { type: 'number', value, unit: null },
      { type: 'range', min: value, max: 1, unit: 'kg' },
      { type: 'range', min: 0, max: value, unit: 'kg' },
    ]) expect(decodeEditorialValue(known(payload))).toBeNull()
  })

  it.each(['\ud800', '\udfff', 'a\ud800b', '\udc00\ud800'])('rejects lone UTF-16 surrogates %#', (value) => {
    for (const raw of [
      { ...known(), code: value }, { ...known(), variantId: value },
      known({ type: 'text', value }), known({ type: 'single', value }),
      known({ type: 'multi', value: [value] }),
      known({ type: 'number', value: 0, unit: value }),
      known({ type: 'range', min: 0, max: 1, unit: value }),
      known(payloads[0], { sourceRef: value, verifiedOn: '' }),
      known(payloads[0], { sourceRef: '', verifiedOn: value }),
    ]) expect(decodeEditorialValue(raw)).toBeNull()
  })

  it('does not apply fresh membership, bounds, evidence or owner qualification', () => {
    for (const raw of [
      { ...known(), code: '', variantId: 'product-can-retain-this' },
      { ...known(), owner: 'sellable', variantId: null },
      known({ type: 'number', value: Number.MAX_VALUE, unit: 'unknown unit' }),
      known({ type: 'number', value: -0, unit: '' }),
      known({ type: 'multi', value: [] }),
      known({ type: 'text', value: 'x'.repeat(30_000) }, {
        sourceRef: ' '.repeat(1000), verifiedOn: '2026-02-31',
      }),
    ]) expect(decodeEditorialValue(raw)).toEqual(raw)
  })

  it('returns deeply detached data, preserving strings, array order and the input', () => {
    const raw = known({ type: 'multi', value: ['b', 'a', 'b'] }, {
      sourceRef: '  ref  ', verifiedOn: 'date',
    })
    const before = JSON.stringify(raw)
    const decoded = decodeEditorialValue(raw)
    expect(decoded).toEqual(raw)
    expect(decoded).not.toBe(raw)
    if (decoded?.state !== 'known' || decoded.payload.type !== 'multi') throw new Error('expected multi')
    expect(decoded.payload).not.toBe(raw.payload)
    expect(decoded.evidence).not.toBe(raw.evidence)
    decoded.payload.value.push('new')
    if (decoded.evidence) decoded.evidence.sourceRef = 'changed'
    expect(JSON.stringify(raw)).toBe(before)
  })

  it('leaves rejected input unchanged and never reads array accessors', () => {
    const raw = { ...known(), extra: { retained: ['unchanged'] } }
    const before = JSON.stringify(raw)
    expect(decodeEditorialValue(raw)).toBeNull()
    expect(JSON.stringify(raw)).toBe(before)
    const getter = vi.fn(() => 'a')
    const values = Object.defineProperty(['a'], '0', { get: getter, enumerable: true })
    expect(decodeEditorialValue(known({ type: 'multi', value: values }))).toBeNull()
    expect(getter).not.toHaveBeenCalled()
  })

  it('returns independent results on repeated decoding', () => {
    const raw = known({ type: 'multi', value: ['same'] })
    const first = decodeEditorialValue(raw)
    const second = decodeEditorialValue(raw)
    expect(first).toEqual(second)
    if (first?.state !== 'known' || second?.state !== 'known') throw new Error('expected known')
    expect(first.payload).not.toBe(second.payload)
  })

  it('accepts frozen JSON data without changing it', () => {
    const raw = Object.freeze(known(Object.freeze({ type: 'multi', value: Object.freeze(['a']) })))
    expect(decodeEditorialValue(raw)).toEqual(raw)
  })

  it('rejects non-JSON data safely without executing getters or toJSON', () => {
    const getter = vi.fn(() => 'custom:code')
    const toJSON = vi.fn(() => known())
    const accessor = Object.defineProperty(known(), 'code', { get: getter, enumerable: true })
    const nestedAccessor = Object.defineProperty({}, 'type', { get: getter, enumerable: true })
    const cycle: Record<string, unknown> = known()
    cycle.payload = cycle
    const sparse = Array<string>(1)
    const extraArray = Object.assign(['a'], { extra: 'x' })
    for (const raw of [
      accessor, known(nestedAccessor), cycle, new Date(),
      Object.assign(Object.create({ inherited: true }), known()),
      { ...known(), toJSON }, { ...known(), [Symbol('extra')]: true },
      known({ type: 'multi', value: sparse }), known({ type: 'multi', value: extraArray }),
      known({ type: 'text', value: new String('x') }),
      known({ type: 'number', value: 1n, unit: null }),
      Object.defineProperty(known(), 'hidden', { value: true }),
    ]) expect(decodeEditorialValue(raw)).toBeNull()
    expect(getter).not.toHaveBeenCalled()
    expect(toJSON).not.toHaveBeenCalled()
  })
})
