import { describe, expect, it } from 'vitest'
import { isFreshEditorialEvidence as valid } from '../editorial-contract-evidence-validation'
import { decodeEditorialValue } from '../editorial-contract-value'

const evidence = (sourceRef = 'Manufacturer record', verifiedOn = '2024-02-29') => ({ sourceRef, verifiedOn })
function check(raw: unknown, expected: boolean) {
  const before = structuredClone(raw)
  if (raw && typeof raw === 'object') Object.freeze(raw)
  expect(valid(raw)).toBe(expected)
  expect(raw).toEqual(before)
}

describe('S20 supplied evidence fresh admission', () => {
  it.each(['x', ' x ', 'x'.repeat(1000), '😀'.repeat(1000), '\u00a0x\u00a0',
    'not a URL', 'e\u0301', '\u0085', '\u200b'])('accepts exact scalar source %j', source => {
    check(evidence(source), true)
  })
  it.each(['', ' ', '\u00a0\ufeff', 'x'.repeat(1001), '😀'.repeat(1001),
    `${'😀'.repeat(999)}ab`, '\ud800', '\udfff', 'x\ud800y'])('rejects source %j', source => {
    check(evidence(source), false)
  })
  it.each([...Array.from({ length: 32 }, (_, i) => i), 127])('rejects source control U+%i anywhere', code => {
    check(evidence(`before${String.fromCharCode(code)}after`), false)
  })
  it.each(['0001-01-01', '0004-02-29', '0099-12-31', '0400-02-29', '1600-02-29',
    '2000-02-29', '2024-02-29', '1900-02-28', '2023-04-30', '2023-01-31', '9999-12-31'])
    ('accepts real Gregorian date without expiry or future rule: %s', date => check(evidence('x', date), true))
  it.each(['0000-01-01', '10000-01-01', '0100-02-29', '1900-02-29', '2100-02-29',
    '2023-02-29', '2024-02-30', '2024-04-31', '2024-06-31', '2024-09-31', '2024-11-31',
    '2024-01-32', '2024-00-01', '2024-13-01', '2024-01-00', '2024-1-01', '24-01-01',
    ' 2024-01-01', '2024-01-01 ', '2024-01-01\n', '2024-01-01\r\n', '2024-01-01T00:00:00Z',
    '２０２４-01-01', '2024/01/01', '+024-01-01', '', '\ud800'])
    ('rejects non-exact or impossible date: %j', date => check(evidence('x', date), false))
  it.each([null, undefined, [], {}, { sourceRef: 'x' }, { verifiedOn: '2024-01-01' },
    { ...evidence(), extra: true }, { ...evidence(), sourceRef: 1 }, { ...evidence(), verifiedOn: null }])
    ('requires complete closed primitive evidence: %j', raw => check(raw, false))
  it('does not execute a source getter or conversion hooks', () => {
    let calls = 0
    const getter = { get sourceRef() { calls++; return 'x' }, verifiedOn: '2024-01-01' }
    expect(valid(getter)).toBe(false)
    expect(valid({ ...evidence(), sourceRef: { toString() { calls++; return 'x' } } })).toBe(false)
    expect(calls).toBe(0)
  })
  it('does not turn stored evidence reading into fresh admission', () => {
    const historical = evidence('bad\nsource', '1900-02-29')
    const assignment = { code: 'x', owner: 'product', variantId: null, state: 'known',
      payload: { type: 'text', value: 'unchanged' }, evidence: historical }
    expect(valid(historical)).toBe(false)
    expect(decodeEditorialValue(assignment)).toEqual(assignment)
  })
})
