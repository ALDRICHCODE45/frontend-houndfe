import { describe, expect, it, vi } from 'vitest'
import type { EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import { toEditorialFactsInput, resolveEditorialFactsInput } from '../editorial-contract-facts-input'
import { toEditorialFactsEditingState as initialize, projectEditorialFactsEditingState as project, type EditorialFactsEditingState } from '../editorial-contract-facts-editing'
const evidence = () => ({ sourceRef: ' fuente ', verifiedOn: '2026-01-01' })
const fixture = (): EditorialSellableFacts[] => [{ variantId: null, presentation: ' Presentación ', declarations: [
  { key: 'consumable', state: 'known', value: false, evidence: evidence(), basis: ' Base ' },
  { key: 'consumable', state: 'unknown', evidence: null },
  { key: 'relevantDimensionCodes', state: 'known', value: { codes: ['measure.dimensions.external_width'], toyTypes: ['rope'] }, evidence: evidence(), basis: '' },
], careReview: { state: 'prepared', jurisdiction: ' AR ', intendedUse: '', determination: 'identified', evidence: [evidence()], basis: '',
  requirements: [0, 1].map(() => ({ key: 'same', description: '', disposition: 'satisfied', basis: '', evidence: [evidence()] })),
  warnings: [{ key: 'w', requirementKeys: ['same', 'dangling', 'same'], text: '', disclosure: 'private_only', handlingBasis: '', evidence: [evidence()] }],
} }]
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
function allocator() { let n = 0; return vi.fn(() => 'ui-' + ++n) }
function editing(): EditorialFactsEditingState {
  const input = toEditorialFactsInput(fixture())[0]!
  return [{ id: 'row', variantId: input.variantId, presentation: input.presentation,
    declarations: input.declarations.map((value, i) => ({ id: 'd-' + i, declarationKey: fixture()[0]!.declarations[i]!.key, input: value })),
    careReview: input.careReview, careRowIds: { requirements: ['r-a', 'r-b'], warnings: ['w-a'] } }]
}
describe('facts editing-state bridge', () => {
  it('does not infer rows or allocate IDs for empty history', () => {
    const nextId = allocator()
    expect(initialize([], nextId)).toEqual([])
    expect(nextId).not.toHaveBeenCalled()
    expect(project([])).toEqual([])
  })
  it('initializes exact raw content with deterministic owner-supplied identities', () => {
    const history = freeze(fixture()), nextId = allocator(), raw = toEditorialFactsInput(history)[0]!
    expect(initialize(history, nextId)).toEqual([{ id: 'ui-1', variantId: null, presentation: ' Presentación ',
      declarations: raw.declarations.map((input, i) => ({ id: 'ui-' + (i + 2), declarationKey: history[0]!.declarations[i]!.key, input })),
      careReview: raw.careReview, careRowIds: { requirements: ['ui-5', 'ui-6'], warnings: ['ui-7'] } }])
    expect(nextId).toHaveBeenCalledTimes(7)
    expect(history).toEqual(fixture())
  })
  it('assigns distinct identities to duplicate domain rows without reordering them', () => {
    const history = fixture(); history.push(history[0]!)
    const nextId = allocator(), state = initialize(freeze(history), nextId)
    expect(state.map(row => row.id)).toEqual(['ui-1', 'ui-8'])
    expect(nextId).toHaveBeenCalledTimes(14)
    expect(project(state)).toEqual(toEditorialFactsInput(history))
  })
  it.each([null, { state: 'unknown' as const }])('allocates no care IDs for nonprepared care %j', careReview => {
    const history: EditorialSellableFacts[] = [{ variantId: 'variant', presentation: '', declarations: [], careReview }]
    const nextId = allocator(), state = initialize(freeze(history), nextId)
    expect(state).toEqual([{ id: 'ui-1', variantId: 'variant', presentation: '', declarations: [],
      careReview: careReview ?? { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }])
    expect(nextId).toHaveBeenCalledOnce()
  })
  it('projects only raw mapper fields and roundtrips through the closed atomic decoder', () => {
    const state = freeze(editing()), before = JSON.stringify(state), raw = project(state)
    expect(raw).toEqual(toEditorialFactsInput(fixture()))
    expect(Object.keys(raw[0]!)).toEqual(['variantId', 'presentation', 'declarations', 'careReview'])
    expect(resolveEditorialFactsInput(raw)).toEqual({ status: 'complete', facts: fixture() })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('retains omitted wrapper identity without leaking it into projection', () => {
    const state = editing(); state[0]!.declarations[0]!.input = { state: 'omitted' }
    const expected = toEditorialFactsInput(fixture()); expected[0]!.declarations[0] = { state: 'omitted' }
    expect(project(freeze(state))).toEqual(expected)
    expect(state[0]!.declarations[0]).toEqual({ id: 'd-0', declarationKey: 'consumable', input: { state: 'omitted' } })
  })
  it('does not repair mismatched keys or incomplete values/evidence/care', () => {
    const state = editing(), row = state[0]!
    row.declarations[0]!.input = { key: 'animalApplied', state: 'known', value: null, evidence: { sourceRef: ' raw ', verifiedOn: '2026-' }, basis: ' ' }
    if (row.careReview.state !== 'prepared') throw Error('fixture')
    row.careReview.determination = null; row.careReview.warnings[0]!.disclosure = null
    const before = JSON.stringify(state), raw = project(freeze(state))
    expect(raw[0]!.declarations[0]).toEqual(row.declarations[0]!.input)
    expect(raw[0]!.careReview).toEqual(row.careReview)
    expect(resolveEditorialFactsInput(raw)).toEqual({ status: 'incomplete' })
    expect(JSON.stringify(state)).toBe(before)
  })
  it('preserves primitive-readable historical invalid evidence on initialization', () => {
    const history = fixture(), declaration = history[0]!.declarations[0]!
    if (declaration.state !== 'known') throw Error('fixture')
    declaration.evidence.verifiedOn = '2026-'
    const state = initialize(freeze(history), allocator())
    expect(state[0]!.declarations[0]!.input).toEqual(declaration)
    expect(resolveEditorialFactsInput(project(state))).toEqual({ status: 'incomplete' })
  })
  it('rejects the entire derived candidate when a later row is incomplete', () => {
    const state = editing(); state.push({ ...editing()[0]!, id: 'later', variantId: 'other', careReview: { state: 'prepared',
      jurisdiction: '', intendedUse: '', determination: null, evidence: [], basis: '', requirements: [], warnings: [] } })
    expect(project(freeze(state))).toHaveLength(2)
    expect(resolveEditorialFactsInput(project(state))).toEqual({ status: 'incomplete' })
  })
  it('deeply detaches history and projection without changing owner identities', () => {
    const history = freeze(fixture()), state = initialize(history, allocator()), row = state[0]!
    if (row.careReview.state !== 'prepared') throw Error('fixture')
    row.careReview.warnings[0]!.requirementKeys.push(' raw ')
    expect(history).toEqual(fixture())
    const before = JSON.stringify(state), raw = project(freeze(state)), care = raw[0]!.careReview
    if (care.state !== 'prepared') throw Error('fixture')
    care.evidence[0]!.sourceRef = 'Changed'; care.requirements[0]!.evidence[0]!.sourceRef = 'Changed'
    care.warnings[0]!.requirementKeys.length = 0
    const declaration = raw[0]!.declarations[2]!
    if (declaration.state !== 'known' || declaration.key !== 'relevantDimensionCodes') throw Error('fixture')
    declaration.value.codes.length = 0; declaration.value.toyTypes.push('ball')
    expect(JSON.stringify(state)).toBe(before)
  })
  it('does not regenerate surviving identities when projecting after sibling deletion', () => {
    const state = editing(), survivor = state[0]!.declarations[1]!
    state[0]!.declarations.splice(0, 1)
    project(freeze(state))
    expect(state[0]!.declarations[0]).toBe(survivor)
    expect(survivor.id).toBe('d-1')
  })
})
