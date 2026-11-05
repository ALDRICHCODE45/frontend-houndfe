/** T13: the save bar says how many fields changed: «3 cambios sin guardar». */
import { describe, expect, it } from 'vitest'
import { countEditorialDocumentChanges as count, isEditorialDocumentEditingEqual } from '../editorial-contract-document-dirty'
import type { EditorialDocumentEditingState as State } from '../editorial-contract-document-editing'

const text = (value: string) => ({ state: 'known' as const, payload: { type: 'text' as const, value }, evidence: null })
function saved(): State {
  return { schemaVersion: 2, commercialTitle: 'Croqueta', description: null, mediaRefs: [], familyCode: 'food',
    values: [{ id: 'a', target: { code: 'material', owner: 'product', variantId: null }, input: text('Nylon') },
      { id: 'b', target: { code: 'measure.net_mass', owner: 'sellable', variantId: 'v1' }, input: { state: 'unknown' } }],
    facts: [{ id: 'f', variantId: 'v1', presentation: 'Chico', careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] },
      declarations: [{ id: 'd', declarationKey: 'contentMagnitude', input: { key: 'contentMagnitude', state: 'known', value: 'mass', evidence: null, basis: '' } }] }] }
}

describe('countEditorialDocumentChanges', () => {
  it('is zero for the same content, whatever the wrapper ids', () => {
    const copy = saved()
    copy.values = copy.values.map((row, index) => ({ ...row, id: `x${index}` }))
    expect(count(copy, saved())).toBe(0)
  })

  it('counts the title, the description and the family as one field each', () => {
    expect(count({ ...saved(), commercialTitle: 'Croquetas', description: 'Rica', familyCode: 'toy' }, saved())).toBe(3)
  })

  it('counts one per datum and presentation that changed, was added or was removed', () => {
    const next = saved()
    next.values = [{ ...next.values[0]!, input: text('Lona') },
      { id: 'c', target: { code: 'measure.net_mass', owner: 'sellable', variantId: 'v2' }, input: { state: 'not_applicable' } }]
    expect(count(next, saved())).toBe(3)
  })

  it('counts one per presentation answer, per care review and per renamed presentation', () => {
    const next = saved()
    next.facts = [{ ...next.facts[0]!, presentation: 'Chico azul', careReview: { state: 'unknown' }, declarations: [
      { id: 'd', declarationKey: 'contentMagnitude', input: { key: 'contentMagnitude', state: 'unknown' } },
      { id: 'e', declarationKey: 'consumable', input: { key: 'consumable', state: 'known', value: true, evidence: null, basis: '' } }] }]
    expect(count(next, saved())).toBe(4)
  })

  it('counts every answer of a presentation that is new or gone', () => {
    const next = saved()
    next.facts = []
    expect(count(next, saved())).toBe(1)
    expect(count(saved(), next)).toBe(1)
  })

  it('never says zero while the document is not equal (a reorder is one change)', () => {
    const next = saved()
    next.values = [...next.values].reverse()
    expect(isEditorialDocumentEditingEqual(next, saved())).toBe(false)
    expect(count(next, saved())).toBe(1)
  })

  it('counts everything against no saved draft', () => {
    expect(count(saved(), null)).toBeGreaterThan(0)
  })
})
