import { describe, expect, it, vi } from 'vitest'
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import { toEditorialDocumentEditingState as initialize, resolveEditorialDocumentEditingState as resolve, requestEditorialFamilyChange as change, type EditorialDocumentEditingState as State } from '../editorial-contract-document-editing'
const evidence = () => ({ sourceRef: ' Etiqueta ', verifiedOn: '2026-01-01' })
const history = (): EditorialContractDocument => ({ schemaVersion: 2, commercialTitle: ' Título ', description: null, mediaRefs: ['m', 'm'], familyCode: 'care',
  values: [{ code: 'x', owner: 'product', variantId: null, state: 'known', payload: { type: 'number', value: 1.5, unit: null }, evidence: evidence() },
    { code: 'x', owner: 'product', variantId: null, state: 'known', payload: { type: 'boolean', value: false }, evidence: null }],
  facts: [{ variantId: null, presentation: ' ', declarations: [{ key: 'consumable', state: 'known', value: false, evidence: evidence(), basis: '' }],
    careReview: { state: 'prepared', jurisdiction: 'AR', intendedUse: '', determination: 'identified', basis: '', evidence: [evidence()],
      requirements: [{ key: 'r', description: '', disposition: 'satisfied', basis: '', evidence: [] }],
      warnings: [{ key: 'w', text: '', requirementKeys: ['r', '', 'r'], disclosure: 'private_only', handlingBasis: '', evidence: [] }] } }] })
const blank = (): State => ({ schemaVersion: 2, commercialTitle: ' Título ', description: null, mediaRefs: ['m', 'm'], familyCode: 'care', values: [], facts: [] })
function allocator() { let n = 0; return vi.fn(() => 'ui-' + ++n) }
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }; return value }
describe('document editing-state bridge', () => {
  it('initializes detached raw history allocating assignments then facts and nested rows in order', () => {
    const original = freeze(history()), nextId = allocator(), state = initialize(original, nextId)
    expect(state.values.map(row => row.id)).toEqual(['ui-1', 'ui-2'])
    expect(state.values[0]).toEqual({ id: 'ui-1', target: { code: 'x', owner: 'product', variantId: null }, input: { state: 'known', payload: { type: 'number', value: '1.5', unit: null }, evidence: evidence() } })
    expect(state.facts[0]!.id).toBe('ui-3'); expect(state.facts[0]!.declarations[0]!.id).toBe('ui-4')
    expect(state.facts[0]!.careRowIds).toEqual({ requirements: ['ui-5'], warnings: ['ui-6'] }); expect(nextId).toHaveBeenCalledTimes(6)
    state.mediaRefs.push('local'); state.values[0]!.target.code = 'local'; state.facts[0]!.presentation = 'local'
    if (state.values[0]!.input.state === 'known') state.values[0]!.input.evidence!.sourceRef = 'local'
    expect(original).toEqual(history())
  })
  it('keeps absence without inferring subjects or allocating IDs', () => {
    const nextId = allocator(), document: EditorialContractDocument = { ...blank(), values: [], facts: [] }
    expect(initialize(document, nextId)).toEqual(blank()); expect(nextId).not.toHaveBeenCalled()
  })
  it('resolves exactly seven detached wire fields preserving duplicates/order/false without admission', () => {
    const original = history(), nextId = allocator(), state = freeze(initialize(original, nextId)), result = resolve(state)
    expect(result).toEqual({ status: 'complete', document: original }); expect(nextId).toHaveBeenCalledTimes(6)
    if (result.status !== 'complete') throw Error('Expected complete encoding')
    expect(Object.keys(result.document)).toEqual(['schemaVersion', 'commercialTitle', 'description', 'mediaRefs', 'familyCode', 'values', 'facts'])
    expect(JSON.stringify(result.document)).not.toContain('ui-'); expect(JSON.stringify(result.document)).not.toContain('careRowIds')
    result.document.mediaRefs.push('output'); result.document.facts[0]!.presentation = 'output'
    expect(state.mediaRefs).toEqual(['m', 'm']); expect(state.facts[0]!.presentation).toBe(' ')
  })
  it('retains targets through explicit omission and only drops omitted payloads in derived output', () => {
    const state = initialize(history(), allocator()), target = state.values[0]!.target
    state.values[0]!.input = { state: 'omitted' }; state.values[1]!.input = { state: 'not_applicable' }
    state.facts[0]!.declarations[0]!.input = { state: 'omitted' }; state.facts[0]!.careReview = { state: 'omitted' }; state.facts[0]!.careRowIds = { requirements: [], warnings: [] }
    const before = JSON.stringify(state), result = resolve(freeze(state))
    expect(result).toEqual({ status: 'complete', document: { ...history(), values: [{ ...target, state: 'not_applicable', evidence: null }], facts: [{ variantId: null, presentation: ' ', declarations: [], careReview: null }] } })
    expect(state.values[0]!.target).toBe(target); expect(JSON.stringify(state)).toBe(before)
  })
  it.each(['assignment', 'facts', 'evidence', 'envelope'])('rejects the whole candidate for incomplete %s without prior-valid fallback', failure => {
    const state = initialize(history(), allocator()), complete = resolve(state)
    expect(complete.status).toBe('complete')
    if (failure === 'assignment') state.values[1]!.input = { state: 'known', payload: { type: 'number', value: '1e', unit: null }, evidence: null }
    if (failure === 'facts' && state.facts[0]!.careReview.state === 'prepared') state.facts[0]!.careReview.determination = null
    if (failure === 'evidence') state.values[1]!.input = { state: 'known', payload: { type: 'boolean', value: false }, evidence: { sourceRef: '', verifiedOn: '2026-' } }
    if (failure === 'envelope') state.description = '\ud800'
    const before = JSON.stringify(state)
    expect(resolve(freeze(state))).toEqual({ status: 'incomplete' }); expect(JSON.stringify(state)).toBe(before)
    expect(complete).toEqual({ status: 'complete', document: history() })
  })
  it('keeps unknown and absent evidence distinct without filtering unavailable historical content', () => {
    const state = initialize(history(), allocator()); state.values[0]!.input = { state: 'unknown' }; state.facts[0]!.careReview = { state: 'unknown' }; state.facts[0]!.careRowIds = { requirements: [], warnings: [] }
    const expected = history(); expected.values[0] = { code: 'x', owner: 'product', variantId: null, state: 'unknown', evidence: null }; expected.facts[0]!.careReview = { state: 'unknown' }
    expect(resolve(state)).toEqual({ status: 'complete', document: expected })
  })
})
describe('confirmed family clearing', () => {
  it.each(['care', null])('same family %s is an exact no-op even with content', family => {
    const state = blank(); state.familyCode = family; state.values = [{ id: 'a', target: { code: 'x', owner: 'product', variantId: null }, input: { state: 'omitted' } }]
    freeze(state)
    for (const confirmed of [false, true]) { const result = change(state, family, confirmed); expect(result).toEqual({ status: 'unchanged', state }); expect(result.state).toBe(state) }
  })
  it.each(['omitted assignment', 'empty facts', 'both incomplete'])('requires confirmation for %s and retains exact raw object on cancellation', kind => {
    const state = blank()
    if (kind !== 'empty facts') state.values = [{ id: 'a', target: { code: 'x', owner: 'product', variantId: null }, input: kind === 'both incomplete' ? { state: 'known', payload: { type: 'range', min: '-', max: '1e' }, evidence: { sourceRef: 'x', verifiedOn: '2026-' } } : { state: 'omitted' } }]
    if (kind !== 'omitted assignment') state.facts = [{ id: 'f', variantId: null, presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }]
    const before = JSON.stringify(state), result = change(freeze(state), 'other')
    expect(result.status).toBe('confirmation_required'); expect(result.state).toBe(state); expect(JSON.stringify(state)).toBe(before)
    const accepted = change(state, 'other', true)
    expect(accepted).toEqual({ status: 'changed', state: { ...blank(), familyCode: 'other' } }); expect(accepted.state).not.toBe(state)
    expect(accepted.state.mediaRefs).toBe(state.mediaRefs); expect(JSON.stringify(state)).toBe(before)
  })
  it.each(['other', null])('changes empty collections to %s without confirmation or hidden restoration', family => {
    const state = freeze(blank()), result = change(state, family)
    expect(result).toEqual({ status: 'changed', state: { ...blank(), familyCode: family } }); expect(result.state).not.toBe(state)
    expect(result.state.mediaRefs).toBe(state.mediaRefs); expect(state).toEqual(blank())
  })
  it('confirmed clearing removes all nested raw evidence/IDs but leaves history and Published untouched', () => {
    const published = freeze(history()), nextId = allocator(), state = freeze(initialize(published, nextId)), before = JSON.stringify(state)
    const changed = change(state, null, true)
    expect(changed).toEqual({ status: 'changed', state: { ...blank(), familyCode: null } })
    expect(change(changed.state, 'care').state).toEqual(blank())
    expect(nextId).toHaveBeenCalledTimes(6); expect(JSON.stringify(state)).toBe(before); expect(published).toEqual(history())
  })
})
