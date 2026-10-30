import { describe, expect, it } from 'vitest'
import type { EditorialFactsEditingRow } from '../editorial-contract-facts-editing'
import { requiresEditorialFactsRemovalConfirmation as requiresConfirmation, requestEditorialFactsRowRemoval as remove } from '../editorial-contract-facts-removal'
function empty(id = 'row', variantId: string | null = null): EditorialFactsEditingRow {
  return { id, variantId, presentation: '', declarations: [], careReview: { state: 'omitted' },
    careRowIds: { requirements: [], warnings: [] } }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
const populated: { name: string; edit: Partial<EditorialFactsEditingRow> }[] = [
  { name: 'text', edit: { presentation: 'Etiqueta' } },
  { name: 'whitespace', edit: { presentation: ' \t\n' } },
  { name: 'omitted declaration', edit: { declarations: [{ id: 'd', declarationKey: 'consumable', input: { state: 'omitted' } }] } },
  { name: 'unknown declaration', edit: { declarations: [{ id: 'd', declarationKey: 'consumable', input: { key: 'consumable', state: 'unknown' } }] } },
  { name: 'incomplete declaration', edit: { declarations: [{ id: 'd', declarationKey: 'consumable', input: { key: 'consumable', state: 'known', value: null, evidence: null, basis: '' } }] } },
  { name: 'false declaration', edit: { declarations: [{ id: 'd', declarationKey: 'consumable', input: { key: 'consumable', state: 'known', value: false, evidence: { sourceRef: '', verifiedOn: '2026-' }, basis: '' } }] } },
  { name: 'unknown care', edit: { careReview: { state: 'unknown' } } },
  { name: 'empty prepared care', edit: { careReview: { state: 'prepared', jurisdiction: '', intendedUse: '', determination: null, basis: '', evidence: [], requirements: [], warnings: [] } } },
]
describe('raw facts removal confirmation', () => {
  it.each([null, 'variant'])('removes an empty subject %j without confirmation', variantId => {
    const row = freeze(empty('row', variantId)), state = freeze([row])
    expect(requiresConfirmation(row)).toBe(false)
    const result = remove(state, row.id)
    expect(result).toEqual({ status: 'removed', state: [] })
    expect(result.state).not.toBe(state)
    expect(state).toEqual([empty('row', variantId)])
  })
  it.each(populated)('protects $name, then removes it only after explicit confirmation', ({ edit }) => {
    const row = freeze({ ...empty(), ...edit }), survivor = freeze(empty('survivor')), state = freeze([row, survivor])
    const before = JSON.stringify(state)
    expect(requiresConfirmation(row)).toBe(true)
    for (const result of [remove(state, row.id), remove(state, row.id, false)]) {
      expect(result.status).toBe('confirmation_required')
      expect(result.state).toBe(state)
      expect(result.state[0]).toBe(row)
    }
    const confirmed = remove(state, row.id, true)
    expect(confirmed).toEqual({ status: 'removed', state: [survivor] })
    expect(confirmed.state[0]).toBe(survivor)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('targets only UI ID despite identical subjects, presentation and declaration keys', () => {
    const a = { ...empty('a'), ...populated[2]!.edit }, b = { ...empty('b'), ...populated[2]!.edit }
    const c = empty('c'), state = freeze([a, b, c]), before = JSON.stringify(state)
    const result = remove(state, 'b', true)
    expect(result.status).toBe('removed')
    expect(result.state).toEqual([a, c])
    expect(result.state[0]).toBe(a); expect(result.state[1]).toBe(c)
    expect(JSON.stringify(state)).toBe(before)
  })
  it.each([false, true])('rejects an unknown ID without changing input (confirmed=%s)', confirmed => {
    const state = freeze([empty()]), before = JSON.stringify(state)
    expect(() => remove(state, 'missing', confirmed)).toThrow(new RangeError('Facts row ID was not found'))
    expect(JSON.stringify(state)).toBe(before)
  })
  it('rejects removal from an empty collection rather than inventing a row', () => {
    const state = freeze([])
    expect(() => remove(state, 'missing')).toThrow(RangeError)
    expect(state).toEqual([])
  })
})
