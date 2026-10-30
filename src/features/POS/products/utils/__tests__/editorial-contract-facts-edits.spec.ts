import { describe, expect, it, vi } from 'vitest'
import type { EditorialFactsEditingRow as Row } from '../editorial-contract-facts-editing'
import type { EditorialDeclarationInput } from '../editorial-contract-declaration-input'
import type { PreparedEditorialCareInput } from '../editorial-contract-care-edits'
import { appendEditorialFactsDeclaration as addDeclaration, updateEditorialFactsDeclaration as updateDeclaration,
  removeEditorialFactsDeclaration as removeDeclaration, replaceEditorialFactsCare as replaceCare,
  appendEditorialFactsCareRow as addCare, removeEditorialFactsCareRow as removeCare } from '../editorial-contract-facts-edits'
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function ids() { let n = 0; return vi.fn(() => 'new-' + ++n) }
function row(): Row {
  return { id: 'fact', variantId: null, presentation: ' raw ', declarations: [
    { id: 'd1', declarationKey: 'consumable', input: { state: 'omitted' } },
    { id: 'd2', declarationKey: 'consumable', input: { key: 'consumable', state: 'known', value: false, evidence: { sourceRef: '', verifiedOn: '2026-' }, basis: '' } },
  ], careReview: { state: 'prepared', jurisdiction: ' ', intendedUse: '', determination: null, basis: '', evidence: [],
    requirements: [0, 1].map(() => ({ key: 'same', description: '', disposition: null, basis: '', evidence: [] })),
    warnings: [{ key: '', text: '', requirementKeys: ['same', '', 'same', 'missing'], disclosure: null, handlingBasis: '', evidence: [] }] },
    careRowIds: { requirements: ['r1', 'r2'], warnings: ['w1'] } }
}
function care(value: Row): PreparedEditorialCareInput {
  if (value.careReview.state !== 'prepared') throw Error('fixture')
  return value.careReview
}
describe('local facts editing operations', () => {
  it('appends only an explicit omitted declaration and one new identity without repairing duplicates', () => {
    const original = freeze(row()), nextId = ids(), result = addDeclaration(original, 'consumable', nextId)
    expect(result).toEqual({ ...original, declarations: [...original.declarations, { id: 'new-1', declarationKey: 'consumable', input: { state: 'omitted' } }] })
    expect(nextId).toHaveBeenCalledOnce(); expect(original).toEqual(row())
  })
  it.each<EditorialDeclarationInput>([{ state: 'omitted' }, { key: 'animalApplied', state: 'known', value: null, evidence: null, basis: ' ' }])('retains wrapper identity and exact raw update %j', input => {
    const original = freeze(row()), payload = freeze(input), result = updateDeclaration(original, 'd2', payload)
    expect(result).toEqual({ ...original, declarations: [original.declarations[0], { id: 'd2', declarationKey: 'consumable', input }] })
    expect(result.declarations[1]!.input).not.toBe(payload)
    expect(original).toEqual(row())
  })
  it('removes only the selected declaration UI ID and retains duplicate-key siblings', () => {
    const original = freeze(row())
    expect(removeDeclaration(original, 'd1')).toEqual({ ...original, declarations: [original.declarations[1]] })
    expect(original).toEqual(row())
  })
  it('rejects absent declaration IDs without mutating raw content', () => {
    const original = freeze(row())
    expect(() => updateDeclaration(original, 'missing', { state: 'omitted' })).toThrow(RangeError)
    expect(() => removeDeclaration(original, 'missing')).toThrow(RangeError)
    expect(original).toEqual(row())
  })
  it.each(['requirements', 'warnings'] as const)('appends blank %s and exactly one aligned ID', kind => {
    const original = freeze(row()), nextId = ids(), result = addCare(original, kind, nextId)
    const blank = kind === 'requirements' ? { key: '', description: '', disposition: null, basis: '', evidence: [] }
      : { key: '', text: '', requirementKeys: [], disclosure: null, handlingBasis: '', evidence: [] }
    expect(result).toEqual({ ...original, careReview: { ...care(original), [kind]: [...care(original)[kind], blank] },
      careRowIds: { ...original.careRowIds, [kind]: [...original.careRowIds[kind], 'new-1'] } })
    expect(nextId).toHaveBeenCalledOnce(); expect(original).toEqual(row())
  })
  it('deletes a duplicate-key requirement while preserving every warning/reference and survivor ID', () => {
    const original = freeze(row()), result = removeCare(original, 'requirements', 'r1')
    expect(result).toEqual({ ...original, careReview: { ...care(original), requirements: [care(original).requirements[1]] },
      careRowIds: { requirements: ['r2'], warnings: ['w1'] } })
    expect(care(result).warnings).toEqual(care(original).warnings); expect(original).toEqual(row())
  })
  it('deletes only the selected warning and preserves requirements', () => {
    const original = freeze(row())
    expect(removeCare(original, 'warnings', 'w1')).toEqual({ ...original,
      careReview: { ...care(original), warnings: [] }, careRowIds: { requirements: ['r1', 'r2'], warnings: [] } })
    expect(original).toEqual(row())
  })
  it('replaces same-position care edits without allocating or repairing raw content', () => {
    const original = freeze(row()), input = care(row()); input.requirements[0]!.key = ''
    input.evidence.push({ sourceRef: ' ', verifiedOn: '2026-' })
    const nextId = ids(), result = replaceCare(original, freeze(input), nextId)
    expect(result).toEqual({ ...original, careReview: input }); expect(nextId).not.toHaveBeenCalled()
    expect(result.careReview).not.toBe(input); expect(original).toEqual(row())
  })
  it.each(['unknown', 'omitted'] as const)('drops IDs after explicit %s discard and creates fresh IDs on reentry', state => {
    const original = freeze(row()), nextId = ids(), discarded = replaceCare(original, { state }, nextId)
    expect(discarded).toEqual({ ...original, careReview: { state }, careRowIds: { requirements: [], warnings: [] } })
    expect(nextId).not.toHaveBeenCalled()
    const input = freeze(care(row())), restored = replaceCare(freeze(discarded), input, nextId)
    expect(restored).toEqual({ ...original, careReview: input, careRowIds: { requirements: ['new-1', 'new-2'], warnings: ['new-3'] } })
    expect(nextId).toHaveBeenCalledTimes(3); expect(original).toEqual(row())
  })
  it.each(['requirements', 'warnings'] as const)('rejects changed %s length through replacement before allocation', kind => {
    const original = freeze(row()), input = care(row()); input[kind].pop()
    const nextId = ids()
    expect(() => replaceCare(original, input, nextId)).toThrow(RangeError)
    expect(nextId).not.toHaveBeenCalled(); expect(original).toEqual(row())
  })
  it.each(['requirements', 'warnings'] as const)('rejects absent %s ID and misaligned current IDs', kind => {
    const original = freeze(row()), bad = row(); bad.careRowIds[kind].pop()
    const before = JSON.stringify(bad), nextId = ids(); freeze(bad)
    expect(() => removeCare(original, kind, 'missing')).toThrow(RangeError)
    expect(() => addCare(bad, kind, nextId)).toThrow(RangeError)
    expect(() => removeCare(bad, kind, 'missing')).toThrow(RangeError)
    expect(() => replaceCare(bad, { state: 'omitted' }, nextId)).toThrow(RangeError)
    expect(nextId).not.toHaveBeenCalled(); expect(JSON.stringify(bad)).toBe(before); expect(original).toEqual(row())
  })
  it.each(['unknown', 'omitted'] as const)('rejects list operations in %s care without allocation', state => {
    const original = freeze({ ...row(), careReview: { state }, careRowIds: { requirements: [], warnings: [] } }), nextId = ids()
    const before = JSON.stringify(original)
    for (const kind of ['requirements', 'warnings'] as const) {
      expect(() => addCare(original, kind, nextId)).toThrow(RangeError)
      expect(() => removeCare(original, kind, 'missing')).toThrow(RangeError)
    }
    expect(nextId).not.toHaveBeenCalled(); expect(JSON.stringify(original)).toBe(before)
  })
  it('detaches unrelated nested raw data and rejects stale IDs on nonprepared care', () => {
    const original = freeze(row()), result = removeDeclaration(original, 'd1')
    care(result).warnings[0]!.requirementKeys.push('changed')
    expect(original).toEqual(row())
    const bad = freeze({ ...row(), careReview: { state: 'omitted' as const } }), nextId = ids()
    expect(() => replaceCare(bad, care(row()), nextId)).toThrow(RangeError)
    expect(nextId).not.toHaveBeenCalled()
  })
})
