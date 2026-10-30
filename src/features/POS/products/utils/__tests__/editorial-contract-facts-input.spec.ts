import { describe, expect, it } from 'vitest'
import type { EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import { resolveEditorialFactsInput as resolve, toEditorialFactsInput as toInput, type EditorialFactsInput } from '../editorial-contract-facts-input'
const evidence = () => ({ sourceRef: ' Etiqueta ', verifiedOn: '2024-02-29' })
function facts(): EditorialSellableFacts[] {
  return [
    { variantId: null, presentation: ' Simple ', declarations: [
      { key: 'consumable', state: 'known', value: false, evidence: evidence(), basis: '' },
      { key: 'contentMagnitude', state: 'unknown', evidence: null },
    ], careReview: null },
    { variantId: 'variant-z', presentation: ' Variante ', declarations: [], careReview: {
      state: 'prepared', jurisdiction: ' AR ', intendedUse: '', determination: 'none_applicable',
      evidence: [evidence()], basis: ' Base ', requirements: [], warnings: [],
    } },
  ]
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}
describe('atomic facts input encoding', () => {
  it('never creates inferred rows for empty input', () => {
    expect(toInput([])).toEqual([])
    expect(resolve([])).toEqual({ status: 'complete', facts: [] })
  })
  it('roundtrips ordered nullable and variant subjects without admission or trimming', () => {
    const history = freeze(facts())
    const raw = toInput(history)
    expect(raw).toEqual([
      { ...history[0], declarations: [history[0]!.declarations[0], { key: 'contentMagnitude', state: 'unknown' }], careReview: { state: 'omitted' } },
      history[1],
    ])
    expect(resolve(freeze(raw))).toEqual({ status: 'complete', facts: history })
  })
  it('removes only explicit declaration omissions and distinguishes unknown care', () => {
    const raw: EditorialFactsInput = [{ variantId: null, presentation: '', declarations: [
      { state: 'omitted' }, { key: 'consumable', state: 'unknown' }, { state: 'omitted' },
    ], careReview: { state: 'unknown' } }]
    expect(resolve(raw)).toEqual({ status: 'complete', facts: [{ variantId: null, presentation: '',
      declarations: [{ key: 'consumable', state: 'unknown', evidence: null }], careReview: { state: 'unknown' } }] })
  })
  it('preserves duplicate row and declaration identities for downstream validation', () => {
    const history = facts(); history[0]!.declarations.push(history[0]!.declarations[0]!)
    history.push(history[0]!)
    expect(resolve(toInput(history))).toEqual({ status: 'complete', facts: history })
  })
  it.each(['value', 'evidence'] as const)('rejects the entire array for later declaration %s incompleteness', field => {
    const raw = toInput(facts())
    raw[1]!.declarations.push({ key: 'consumable', state: 'known', value: field === 'value' ? null : false,
      evidence: field === 'evidence' ? null : evidence(), basis: 'Base' })
    const before = JSON.stringify(raw)
    expect(resolve(freeze(raw))).toEqual({ status: 'incomplete' })
    expect(JSON.stringify(raw)).toBe(before)
  })
  it('rejects the entire array for later care incompleteness without dropping the review', () => {
    const raw = toInput(facts())
    const care = raw[1]!.careReview
    if (care.state !== 'prepared') throw new Error('fixture')
    care.determination = null
    expect(resolve(raw)).toEqual({ status: 'incomplete' })
  })
  it.each([
    { variantId: '\ud800' }, { presentation: '\ud800' }, { extra: true }, { variantId: 12 },
  ])('rejects primitive-invalid later rows atomically %#', edit => {
    const raw: EditorialFactsInput = [
      { variantId: null, presentation: '', declarations: [], careReview: { state: 'omitted' } },
      { variantId: 'v', presentation: '', declarations: [], careReview: { state: 'unknown' }, ...edit } as EditorialFactsInput[number],
    ]
    expect(resolve(raw)).toEqual({ status: 'incomplete' })
  })
  it('preserves historical invalid evidence until encoding, without old-value fallback', () => {
    const history = facts()
    const declaration = history[0]!.declarations[0]!
    if (declaration.state !== 'known') throw new Error('fixture')
    declaration.evidence.verifiedOn = '2024-'
    const raw = toInput(freeze(history))
    expect(raw[0]!.declarations[0]).toEqual(declaration)
    expect(resolve(JSON.parse(JSON.stringify(raw)))).toEqual({ status: 'incomplete' })
  })
  it('deeply detaches history and output while retaining raw serialized edits', () => {
    const history = freeze(facts()), raw = toInput(history)
    raw[0]!.presentation = 'Changed'
    const declaration = raw[0]!.declarations[0]!, care = raw[1]!.careReview
    if (declaration.state !== 'known' || !declaration.evidence || care.state !== 'prepared') throw new Error('fixture')
    declaration.evidence.sourceRef = 'Edited'; care.evidence[0]!.sourceRef = 'Edited care'
    expect(history).toEqual(facts())
    const before = JSON.stringify(raw), result = resolve(freeze(raw))
    if (result.status !== 'complete') throw new Error('Expected complete')
    result.facts.reverse()
    const outputCare = result.facts[0]!.careReview
    if (outputCare?.state !== 'prepared') throw new Error('fixture')
    outputCare.evidence[0]!.sourceRef = 'Output edit'
    result.facts[1]!.declarations.length = 0
    expect(JSON.stringify(raw)).toBe(before)
    const edited: EditorialFactsInput = JSON.parse(before)
    const changed = edited[1]!.careReview
    if (changed.state !== 'prepared') throw new Error('fixture')
    changed.evidence[0]!.verifiedOn = '2024-'
    expect(resolve(edited)).toEqual({ status: 'incomplete' })
  })
})
