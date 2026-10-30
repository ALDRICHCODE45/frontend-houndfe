import { describe, expect, it } from 'vitest'
import type { EditorialCareReview } from '../../interfaces/editorial-contract-care.types'
import { decodeEditorialCareReview } from '../editorial-contract-care'
import { isFreshEditorialCareCapture } from '../editorial-contract-care-validation'
import {
  resolveEditorialCareReviewInput as resolve,
  toEditorialCareReviewInput as toInput,
  type EditorialCareReviewInput,
} from '../editorial-contract-care-input'

type Prepared = Extract<EditorialCareReview, { state: 'prepared' }>
type PreparedInput = Extract<EditorialCareReviewInput, { state: 'prepared' }>
const evidence = () => ({ sourceRef: ' etiqueta 🐾 ', verifiedOn: '2024-02-29' })
function review(): Prepared {
  return {
    state: 'prepared', jurisdiction: ' AR ', intendedUse: ' Uso\nprivado 🐾 ',
    determination: 'identified', evidence: [evidence()], basis: ' Base ',
    requirements: [{ key: ' r ', description: ' Descripción ', disposition: 'satisfied', evidence: [evidence()], basis: ' Motivo ' }],
    warnings: [{ key: ' w ', requirementKeys: [' r '], text: ' Aviso ', disclosure: 'private_only', evidence: [evidence()], handlingBasis: ' Manejo ' }],
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function complete(value: EditorialCareReviewInput) {
  return { status: 'complete', careReview: value }
}

describe('care raw input encoding (S36)', () => {
  it('distinguishes omission, unknown and prepared without invented fields', () => {
    expect(toInput(null)).toEqual({ state: 'omitted' })
    expect(resolve({ state: 'omitted' })).toEqual({ status: 'complete', careReview: null })
    expect(toInput({ state: 'unknown' })).toEqual({ state: 'unknown' })
    expect(resolve({ state: 'unknown' })).toEqual(complete({ state: 'unknown' }))
    expect(toInput(review())).toEqual(review())
    expect(resolve(review())).toEqual(complete(review()))
  })

  it.each(['identified', 'none_applicable'] as const)('encodes determination %s without readiness inference', (determination) => {
    const input = { ...review(), determination }
    expect(resolve(input)).toEqual(complete(input))
  })
  it.each(['satisfied', 'not_applicable', 'unresolved', 'conflicting'] as const)('encodes disposition %s', (disposition) => {
    const input = review()
    input.requirements[0]!.disposition = disposition
    expect(resolve(input)).toEqual(complete(input))
  })
  it.each(['private_only', 'public_required', 'unresolved'] as const)('encodes disclosure %s', (disclosure) => {
    const input = review()
    input.warnings[0]!.disclosure = disclosure
    expect(resolve(input)).toEqual(complete(input))
  })
  it.each(['determination', 'disposition', 'disclosure'] as const)('rejects unselected %s atomically', (field) => {
    const input: PreparedInput = review()
    if (field === 'determination') input.determination = null
    if (field === 'disposition') input.requirements[0]!.disposition = null
    if (field === 'disclosure') input.warnings[0]!.disclosure = null
    expect(resolve(input)).toEqual({ status: 'incomplete' })
  })
  it('allows explicit empty evidence and child arrays', () => {
    const input = review()
    input.evidence = []
    input.requirements[0]!.evidence = []
    input.warnings[0]!.evidence = []
    input.warnings[0]!.requirementKeys = []
    expect(resolve(input)).toEqual(complete(input))
    input.requirements = []
    input.warnings = []
    expect(resolve(input)).toEqual(complete(input))
  })

  for (const depth of ['review', 'requirement', 'warning'] as const) {
    it.each([
      { sourceRef: '', verifiedOn: '2024-02-29' },
      { sourceRef: 'source', verifiedOn: '' },
      { sourceRef: 'source', verifiedOn: '2023-02-29' },
      { sourceRef: 'source\u0000', verifiedOn: '2024-02-29' },
      { sourceRef: 'source', verifiedOn: '2024-02-29\n' },
    ])(`rejects invalid supplied evidence at ${depth} without pruning`, (invalid) => {
      const input = review()
      const entries = depth === 'review' ? input.evidence : depth === 'requirement'
        ? input.requirements[0]!.evidence : input.warnings[0]!.evidence
      entries.push(invalid, evidence())
      const before = JSON.stringify(input)
      expect(resolve(freeze(input))).toEqual({ status: 'incomplete' })
      expect(JSON.stringify(input)).toBe(before)
    })
  }
  it('preserves fresh-invalid historical evidence on initialization but not encoding', () => {
    const history = review()
    history.requirements[0]!.evidence[0]!.verifiedOn = 'historical date'
    const decoded = decodeEditorialCareReview(history)!
    expect(decoded).not.toBeNull()
    const input = toInput(freeze(decoded))
    expect(input).toEqual(history)
    expect(resolve(input)).toEqual({ status: 'incomplete' })
  })
  it('preserves exact prose, ordering, duplicate identities and dangling references downstream', () => {
    const input = review()
    input.jurisdiction = ''
    input.intendedUse = 'x'.repeat(1001)
    input.basis = '\t'
    input.requirements.push({ ...input.requirements[0]!, description: 'second' })
    input.warnings[0]!.requirementKeys = ['missing', ' r ', 'missing']
    input.warnings.push({ ...input.warnings[0]!, text: 'second' })
    input.evidence.push(evidence())
    expect(isFreshEditorialCareCapture(input)).toBe(false)
    expect(toInput(freeze(input))).toEqual(input)
    expect(resolve(input)).toEqual(complete(input))
  })
  it('leaves oversized lists encoding-complete', () => {
    const input = review()
    input.evidence = Array.from({ length: 17 }, evidence)
    input.requirements = Array.from({ length: 33 }, () => ({ ...review().requirements[0]! }))
    input.warnings = Array.from({ length: 33 }, () => ({ ...review().warnings[0]! }))
    expect(resolve(input)).toEqual(complete(input))
  })
  it('deeply detaches history and output at every nested container', () => {
    const history = freeze(review())
    const raw = toInput(history) as PreparedInput
    raw.evidence[0]!.sourceRef = 'changed'
    raw.requirements[0]!.evidence[0]!.sourceRef = 'changed requirement'
    raw.warnings[0]!.evidence[0]!.sourceRef = 'changed warning'
    raw.warnings[0]!.requirementKeys.push('dangling')
    expect(history).toEqual(review())
    const result = resolve(freeze(raw))
    expect(result.status).toBe('complete')
    if (result.status !== 'complete' || result.careReview?.state !== 'prepared') throw new Error('Expected prepared')
    result.careReview.evidence[0]!.sourceRef = 'output edit'
    result.careReview.requirements[0]!.evidence[0]!.sourceRef = 'output edit'
    result.careReview.warnings[0]!.evidence[0]!.sourceRef = 'output edit'
    result.careReview.warnings[0]!.requirementKeys.push('output edit')
    expect(raw.evidence[0]!.sourceRef).toBe('changed')
    expect(raw.requirements[0]!.evidence[0]!.sourceRef).toBe('changed requirement')
    expect(raw.warnings[0]!.evidence[0]!.sourceRef).toBe('changed warning')
    expect(raw.warnings[0]!.requirementKeys).toEqual([' r ', 'dangling'])
  })
  it('never restores an old known value after raw serialization and incomplete edits', () => {
    const raw = toInput(review()) as PreparedInput
    expect(resolve(raw).status).toBe('complete')
    raw.warnings[0]!.evidence[0]!.verifiedOn = '2024-'
    expect(resolve(JSON.parse(JSON.stringify(raw)))).toEqual({ status: 'incomplete' })
  })
  it('rejects later unselected rows and does not execute nested evidence getters', () => {
    const input: PreparedInput = review()
    input.requirements.push({ ...review().requirements[0]!, disposition: null })
    expect(resolve(input)).toEqual({ status: 'incomplete' })
    input.requirements.pop()
    input.warnings.push({ ...review().warnings[0]!, disclosure: null })
    expect(resolve(input)).toEqual({ status: 'incomplete' })
    input.warnings.pop()
    let calls = 0
    Object.defineProperty(input.warnings[0]!.evidence[0]!, 'sourceRef', {
      enumerable: true, get: () => { calls++; return 'must not read' },
    })
    expect(resolve(input)).toEqual({ status: 'incomplete' })
    expect(calls).toBe(0)
  })
  it.each([
    { ...review(), determination: 'invented' },
    { ...review(), jurisdiction: '\ud800' },
    { ...review(), revision: 1 },
  ])('rejects primitive-invalid input atomically', (input) => {
    expect(resolve(input as EditorialCareReviewInput)).toEqual({ status: 'incomplete' })
  })
})
