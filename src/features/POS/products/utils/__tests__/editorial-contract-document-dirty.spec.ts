import { describe, expect, it } from 'vitest'
import { isEditorialDocumentEditingEqual as equal } from '../editorial-contract-document-dirty'
import { resolveEditorialDocumentEditingState, type EditorialDocumentEditingState as State } from '../editorial-contract-document-editing'
import type { EditorialAssignmentInput } from '../editorial-contract-assignment-input'
import type { EditorialDeclarationInput } from '../editorial-contract-declaration-input'
import type { EditorialCareReviewInput } from '../editorial-contract-care-input'

type Prepared = Extract<EditorialCareReviewInput, { state: 'prepared' }>
const evidence = () => ({ sourceRef: 'id', verifiedOn: '2026-' })
function fixture(): State {
  return {
    schemaVersion: 2, commercialTitle: null, description: '', familyCode: 'care', mediaRefs: ['id', 'asset'],
    values: [
      { id: 'a', target: { code: 'mass', owner: 'product', variantId: null },
        input: { state: 'known', payload: { type: 'number', value: '1e-', unit: undefined }, evidence: evidence() } },
      { id: 'b', target: { code: 'id', owner: 'sellable', variantId: 'v' }, input: { state: 'omitted' } },
    ],
    facts: [{ id: 'f', variantId: null, presentation: ' id ', declarations: [
      { id: 'd', declarationKey: 'consumable', input: { key: 'consumable', state: 'known', value: false, evidence: null, basis: '' } },
      { id: 'e', declarationKey: 'relevantDimensionCodes', input: { key: 'relevantDimensionCodes', state: 'known',
        value: { codes: ['measure.dimensions.external_width', 'measure.dimensions.external_length'], toyTypes: ['id', 'ball', 'id'] }, evidence: evidence(), basis: ' id ' } },
    ], careRowIds: { requirements: ['r1', 'r2'], warnings: ['w1', 'w2'] }, careReview: {
      state: 'prepared', jurisdiction: 'id', intendedUse: '', determination: null, basis: '', evidence: [evidence(), { sourceRef: 'other', verifiedOn: '' }],
      requirements: [
        { key: 'id', description: '', disposition: null, basis: '', evidence: [evidence()] },
        { key: 'other', description: ' ', disposition: 'unresolved', basis: 'id', evidence: [] },
      ], warnings: [
        { key: 'id', text: '', disclosure: null, handlingBasis: '', requirementKeys: ['id', 'other', 'id'], evidence: [evidence()] },
        { key: 'other', text: ' ', disclosure: 'unresolved', handlingBasis: 'id', requirementKeys: [], evidence: [] },
      ],
    } }],
  }
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function care(state: State): Prepared {
  const input = state.facts[0]!.careReview
  if (input.state !== 'prepared') throw new Error('Fixture requires prepared care')
  return input
}
function assignment(state: State): Extract<EditorialAssignmentInput, { state: 'known' }> {
  const input = state.values[0]!.input
  if (input.state !== 'known') throw new Error('Fixture requires known assignment')
  return input
}
function dimensions(state: State) {
  const input = state.facts[0]!.declarations[1]!.input
  if (input.state !== 'known' || input.key !== 'relevantDimensionCodes') throw new Error('Fixture requires dimensions')
  return input.value
}
// Reverse every object's insertion order without changing arrays or undefined.
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]))
  }
  return value
}
const edits: [string, (state: State) => void][] = [
  ['title null versus empty', s => { s.commercialTitle = '' }],
  ['title whitespace', s => { s.commercialTitle = ' ' }],
  ['description empty versus null', s => { s.description = null }],
  ['description whitespace', s => { s.description = ' ' }],
  ['family exact spelling', s => { s.familyCode = 'care ' }],
  ['family null', s => { s.familyCode = null }],
  ['media content named id', s => { s.mediaRefs[0] = 'changed' }],
  ['media order', s => { s.mediaRefs.reverse() }],
  ['media duplicates', s => { s.mediaRefs.push('id') }],
  ['assignment order', s => { s.values.reverse() }],
  ['assignment duplicate', s => { s.values.push(structuredClone(s.values[0]!)) }],
  ['omitted assignment versus absent', s => { s.values.pop() }],
  ['omitted target code', s => { s.values[1]!.target.code = 'changed' }],
  ['omitted target owner', s => { s.values[1]!.target.owner = 'product' }],
  ['omitted target subject', s => { s.values[1]!.target.variantId = null }],
  ['partial number spelling', s => { assignment(s).payload = { type: 'number', value: '1e' } }],
  ['supplied incomplete evidence versus absence', s => { assignment(s).evidence = null }],
  ['assignment evidence source whitespace', s => { assignment(s).evidence!.sourceRef += ' ' }],
  ['assignment partial date', s => { assignment(s).evidence!.verifiedOn += '0' }],
  ['fact subject', s => { s.facts[0]!.variantId = 'id' }],
  ['fact presentation whitespace', s => { s.facts[0]!.presentation = 'id' }],
  ['empty facts wrapper versus absent', s => { s.facts.push({ id: 'new', variantId: null, presentation: '', declarations: [], careReview: { state: 'omitted' }, careRowIds: { requirements: [], warnings: [] } }) }],
  ['fact order', s => { s.facts.push({ ...structuredClone(s.facts[0]!), presentation: 'second' }); s.facts.reverse() }],
  ['declaration wrapper key even if mismatched', s => { s.facts[0]!.declarations[0]!.declarationKey = 'animalApplied' }],
  ['declaration order', s => { s.facts[0]!.declarations.reverse() }],
  ['declaration duplicates', s => { s.facts[0]!.declarations.push(structuredClone(s.facts[0]!.declarations[0]!)) }],
  ['dimension code order', s => { dimensions(s).codes.reverse() }],
  ['toy type order', s => { dimensions(s).toyTypes = ['ball', 'id', 'id'] }],
  ['toy type duplicates', s => { dimensions(s).toyTypes.pop() }],
  ['care unselected determination', s => { care(s).determination = 'none_applicable' }],
  ['care raw jurisdiction', s => { care(s).jurisdiction += ' ' }],
  ['care raw intended use', s => { care(s).intendedUse = ' ' }],
  ['care raw basis', s => { care(s).basis = 'id' }],
  ['care evidence order', s => { care(s).evidence.reverse() }],
  ['requirement order', s => { care(s).requirements.reverse() }],
  ['requirement domain key', s => { care(s).requirements[0]!.key = 'changed' }],
  ['requirement raw prose', s => { care(s).requirements[0]!.description = ' ' }],
  ['requirement raw basis', s => { care(s).requirements[0]!.basis = ' ' }],
  ['requirement unselected disposition', s => { care(s).requirements[0]!.disposition = 'satisfied' }],
  ['requirement partial evidence', s => { care(s).requirements[0]!.evidence[0]!.verifiedOn = '' }],
  ['warning order', s => { care(s).warnings.reverse() }],
  ['warning domain key', s => { care(s).warnings[0]!.key = 'changed' }],
  ['warning raw prose', s => { care(s).warnings[0]!.text = ' ' }],
  ['warning handling basis', s => { care(s).warnings[0]!.handlingBasis = ' ' }],
  ['warning unselected disclosure', s => { care(s).warnings[0]!.disclosure = 'private_only' }],
  ['warning reference strings', s => { care(s).warnings[0]!.requirementKeys[0] = 'changed' }],
  ['warning reference order', s => { care(s).warnings[0]!.requirementKeys = ['other', 'id', 'id'] }],
  ['warning duplicate references', s => { care(s).warnings[0]!.requirementKeys.pop() }],
  ['warning partial evidence', s => { care(s).warnings[0]!.evidence[0]!.sourceRef = '' }],
]

describe('isEditorialDocumentEditingEqual: raw content, not encoding or admission', () => {
  it('is reflexive, symmetric and insertion-order independent for frozen detached raw states', () => {
    const left = freeze(fixture())
    // SAFETY: reverseKeys changes insertion order only, preserving the typed fixture.
    const right = freeze(reverseKeys(structuredClone(left)) as State)
    expect(equal(left, left)).toBe(true)
    expect(equal(left, right)).toBe(true)
    expect(equal(right, left)).toBe(true)
    expect(left).toStrictEqual(fixture())
  })
  it.each<[string, (s: State) => void]>([
    ['values[].id', s => { s.values.forEach(row => { row.id += '-new' }) }],
    ['facts[].id', s => { s.facts[0]!.id = 'new' }],
    ['facts[].declarations[].id', s => { s.facts[0]!.declarations.forEach(row => { row.id += '-new' }) }],
    ['facts[].careRowIds', s => { s.facts[0]!.careRowIds = { requirements: ['regenerated'], warnings: [] } }],
  ])('ignores only wrapper metadata: %s', (_, edit) => {
    const left = freeze(fixture()), right = fixture()
    edit(right)
    freeze(right)
    expect(equal(left, right)).toBe(true)
    expect(equal(right, left)).toBe(true)
    expect(left).toStrictEqual(fixture())
  })
  it.each(edits)('retains %s', (_, edit) => {
    const left = freeze(fixture()), right = fixture()
    expect(equal(left, freeze(structuredClone(left)))).toBe(true)
    edit(right)
    const before = structuredClone(right)
    freeze(right)
    expect(equal(left, right)).toBe(false)
    expect(equal(right, left)).toBe(false)
    expect(left).toStrictEqual(fixture())
    expect(right).toStrictEqual(before)
  })
  it.each(['number', 'range'] as const)('equates absent/undefined %s unit, never null', type => {
    const left = fixture(), right = fixture()
    const payload = type === 'number' ? { type, value: '' } : { type, min: '-', max: '' }
    assignment(left).payload = payload
    assignment(right).payload = { ...payload, unit: undefined }
    expect(equal(freeze(left), freeze(right))).toBe(true)
    const selected = structuredClone(right)
    assignment(selected).payload = { ...payload, unit: null }
    expect(equal(left, freeze(selected))).toBe(false)
    expect(equal(selected, left)).toBe(false)
  })
  it.each<EditorialAssignmentInput>([
    { state: 'unknown' }, { state: 'not_applicable' },
    { state: 'known', payload: { type: 'boolean', value: false }, evidence: null },
    { state: 'known', payload: { type: 'boolean', value: null }, evidence: null },
    { state: 'known', payload: { type: 'single', value: null }, evidence: null },
    { state: 'known', payload: { type: 'single', value: '' }, evidence: null },
    { state: 'known', payload: { type: 'text', value: '' }, evidence: null },
    { state: 'known', payload: { type: 'multi', value: [] }, evidence: null },
    { state: 'known', payload: { type: 'multi', value: ['id', 'id'] }, evidence: null },
  ])('keeps assignment states and payloads distinct: %j', input => {
    const left = fixture(), right = fixture()
    left.values[0]!.input = { state: 'omitted' }
    right.values[0]!.input = input
    expect(equal(freeze(left), freeze(structuredClone(left)))).toBe(true)
    expect(equal(left, freeze(right))).toBe(false)
    expect(equal(right, left)).toBe(false)
    const alternate = structuredClone(right)
    if (input.state === 'known') {
      if (input.payload.type === 'boolean') alternate.values[0]!.input = { ...input, payload: { type: 'boolean', value: input.payload.value === null ? false : null } }
      else if (input.payload.type === 'single') alternate.values[0]!.input = { ...input, payload: { type: 'single', value: input.payload.value === null ? '' : null } }
      else alternate.values[0]!.input = { state: 'unknown' }
    } else alternate.values[0]!.input = { state: input.state === 'unknown' ? 'not_applicable' : 'unknown' }
    expect(equal(right, freeze(alternate))).toBe(false)
  })
  it.each<EditorialDeclarationInput>([
    { state: 'omitted' }, { key: 'consumable', state: 'unknown' },
    { key: 'consumable', state: 'known', value: null, evidence: null, basis: '' },
    { key: 'consumable', state: 'known', value: false, evidence: evidence(), basis: '' },
    { key: 'consumable', state: 'known', value: false, evidence: null, basis: ' ' },
    { key: 'optionalNonpertinenceCodes', state: 'known', value: [], evidence: null, basis: '' },
  ])('retains incomplete or omitted declaration input: %j', input => {
    const left = freeze(fixture()), right = fixture()
    expect(equal(left, freeze(structuredClone(left)))).toBe(true)
    right.facts[0]!.declarations[0]!.input = input
    expect(equal(left, freeze(right))).toBe(false)
    expect(equal(right, left)).toBe(false)
  })
  it('retains omitted declaration wrappers and their stable declaration keys', () => {
    const left = fixture()
    left.facts[0]!.declarations[0]!.input = { state: 'omitted' }
    const right = structuredClone(left)
    expect(equal(freeze(left), freeze(structuredClone(left)))).toBe(true)
    right.facts[0]!.declarations[0]!.declarationKey = 'animalApplied'
    expect(equal(left, freeze(right))).toBe(false)
    const absent = structuredClone(left)
    absent.facts[0]!.declarations.shift()
    expect(equal(left, freeze(absent))).toBe(false)
  })
  it.each<EditorialCareReviewInput>([{ state: 'omitted' }, { state: 'unknown' }])('retains care state %j', input => {
    const left = freeze(fixture()), right = fixture()
    expect(equal(left, freeze(structuredClone(left)))).toBe(true)
    right.facts[0]!.careReview = input
    expect(equal(left, freeze(right))).toBe(false)
    expect(equal(right, left)).toBe(false)
  })
  it('compares fact and multi-choice order without relying on length differences', () => {
    const left = fixture()
    left.facts.push({ ...structuredClone(left.facts[0]!), id: 'second', variantId: 'v' })
    assignment(left).payload = { type: 'multi', value: ['id', 'ball', 'id'] }
    const reorderedFacts = structuredClone(left)
    reorderedFacts.facts.reverse()
    expect(equal(freeze(left), freeze(reorderedFacts))).toBe(false)
    expect(equal(reorderedFacts, left)).toBe(false)
    const reorderedChoices = structuredClone(left)
    assignment(reorderedChoices).payload = { type: 'multi', value: ['ball', 'id', 'id'] }
    expect(equal(left, freeze(reorderedChoices))).toBe(false)
    expect(equal(reorderedChoices, left)).toBe(false)
  })
  it('does not infer raw equality from equal complete wire candidates', () => {
    const left: State = { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [], familyCode: null, values: [], facts: [] }
    const right = structuredClone(left)
    right.values.push({ id: 'omitted', target: { code: 'id', owner: 'product', variantId: null }, input: { state: 'omitted' } })
    const candidate = resolveEditorialDocumentEditingState(freeze(left))
    expect(candidate.status).toBe('complete')
    expect(resolveEditorialDocumentEditingState(freeze(right))).toStrictEqual(candidate)
    expect(equal(left, freeze(structuredClone(left)))).toBe(true)
    expect(equal(left, right)).toBe(false)
    expect(equal(right, left)).toBe(false)
  })
})
