import { describe, expect, it } from 'vitest'
import { renameEditorialCareRequirement as rename, removeEditorialCareRequirement as remove,
  type PreparedEditorialCareInput } from '../editorial-contract-care-edits'
import { resolveEditorialCareReviewInput } from '../editorial-contract-care-input'
import { isFreshEditorialCareCapture } from '../editorial-contract-care-validation'
function review(): PreparedEditorialCareInput {
  return { state: 'prepared', jurisdiction: 'AR', intendedUse: 'Uso', determination: 'identified',
    evidence: [], basis: 'Base', requirements: ['a', 'b', 'c'].map(key => ({
      key, description: 'Description '+key, disposition: 'satisfied', evidence: [], basis: 'Basis '+key,
    })), warnings: [{ key: 'warning', requirementKeys: ['b', 'a'], text: 'Keep this warning',
      disclosure: 'private_only', evidence: [{ sourceRef: 'Document', verifiedOn: '2024-02-29' }], handlingBasis: 'Handling' }] }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
describe('explicit care requirement edits preserve warning references (S38)', () => {
  it.each(['renamed', '', ' a ', 'a'])('renames only the selected row to exact key %j', key => {
    const input = freeze(review()), expected = review()
    expected.requirements[1]!.key = key
    expect(rename(input, 1, key)).toEqual(expected)
    expect(input).toEqual(review())
  })
  it('uses row position rather than ambiguous duplicate keys', () => {
    const input = review(); input.requirements[2]!.key = 'b'
    const expected = structuredClone(input); expected.requirements[2]!.key = 'replacement'
    expect(rename(freeze(input), 2, 'replacement')).toEqual(expected)
    expect(input.requirements.map(row => row.key)).toEqual(['a', 'b', 'b'])
  })
  it.each([0, 1, 2])('removes only row %i and preserves all other content and order', index => {
    const input = freeze(review()), expected = review()
    expected.requirements.splice(index, 1)
    expect(remove(input, index)).toEqual(expected)
    expect(input).toEqual(review())
  })
  it.each([rename, remove])('preserves duplicate and dangling warning references verbatim', operation => {
    const input = review()
    input.warnings[0]!.requirementKeys = ['b', 'missing', 'b']
    input.warnings.push({ ...input.warnings[0]!, key: 'second' })
    const before = JSON.stringify(input)
    const result = operation(freeze(input), 1, 'changed')
    expect(result.warnings).toEqual(input.warnings)
    expect(JSON.stringify(input)).toBe(before)
  })
  it.each([rename, remove])('returns detached nested raw content including incomplete edits', operation => {
    const input = review()
    input.determination = null; input.requirements[0]!.disposition = null
    input.warnings[0]!.evidence[0]!.verifiedOn = '2024-'
    const before = JSON.stringify(input)
    const result = operation(freeze(input), 1, 'changed')
    expect(result.determination).toBeNull()
    expect(result.requirements[0]!.disposition).toBeNull()
    expect(result.warnings).toEqual(input.warnings)
    result.warnings[0]!.requirementKeys.push('local')
    result.warnings[0]!.evidence[0]!.sourceRef = 'Output edit'
    result.requirements[0]!.description = 'Output edit'
    expect(JSON.stringify(input)).toBe(before)
  })
  it.each([rename, remove])('does not turn dangling-reference editing into capture authority', operation => {
    const input = review()
    expect(isFreshEditorialCareCapture(input)).toBe(true)
    const result = operation(input, 1, 'changed')
    expect(resolveEditorialCareReviewInput(result).status).toBe('complete')
    expect(isFreshEditorialCareCapture(result)).toBe(false)
    expect(result.warnings[0]!.requirementKeys).toEqual(['b', 'a'])
  })
  for (const operation of [rename, remove]) it.each([-1, 3, 0.5, NaN, Infinity])(
    'rejects invalid index %s without any input mutation', index => {
      const input = freeze(review())
      expect(() => operation(input, index, 'changed')).toThrow(RangeError)
      expect(input).toEqual(review())
    })
})
