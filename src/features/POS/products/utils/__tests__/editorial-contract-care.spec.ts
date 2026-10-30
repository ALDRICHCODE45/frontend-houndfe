import { describe, expect, it } from 'vitest'
import type {
  EditorialCareReview, EditorialRequirement, EditorialReviewWarning,
} from '../../interfaces/editorial-contract-care.types'
import { decodeEditorialCareReview as decode } from '../editorial-contract-care'

const evidence = () => ({ sourceRef: ' source 🦴 ', verifiedOn: 'not a date' })
const requirement = (): EditorialRequirement => ({
  key: ' duplicate ', description: '', disposition: 'unresolved', evidence: [evidence()], basis: ' ',
})
const warning = (): EditorialReviewWarning => ({
  key: '', requirementKeys: ['unbound', 'unbound', ' duplicate '], text: ' private text ',
  disclosure: 'public_required', evidence: [evidence()], handlingBasis: '',
})
const prepared = () => ({
  state: 'prepared' as const, jurisdiction: '', intendedUse: ' unspecified ',
  determination: 'identified' as const, evidence: [evidence()], basis: '',
  requirements: [requirement(), requirement()], warnings: [warning(), warning()],
})

// Type-level branch narrowing and required private capture fields.
function requirements(review: EditorialCareReview): EditorialRequirement[] | undefined {
  if (review.state === 'prepared') return review.requirements
}
void requirements
// @ts-expect-error unknown has no prepared fields
const unknownWithBasis: EditorialCareReview = { state: 'unknown', basis: '' }
// @ts-expect-error all requirement fields are required
const incomplete: EditorialRequirement = { key: '' }
// @ts-expect-error disclosure is a closed enum
const invalidDisclosure: EditorialReviewWarning = { ...warning(), disclosure: 'public' }
void [unknownWithBasis, incomplete, invalidDisclosure]

type Path = (string | number)[]
function at(input: unknown, path: Path): Record<string | number, unknown> {
  let target = input as Record<string | number, unknown>
  for (const key of path) target = target[key] as Record<string | number, unknown>
  return target
}
function replaced(path: Path, value: unknown): unknown {
  const input = prepared()
  at(input, path.slice(0, -1))[path[path.length - 1]!] = value
  return input
}

const objectPaths: [string, Path][] = [
  ['prepared', []], ['requirement', ['requirements', 0]], ['warning', ['warnings', 0]],
  ['review evidence', ['evidence', 0]], ['requirement evidence', ['requirements', 0, 'evidence', 0]],
  ['warning evidence', ['warnings', 0, 'evidence', 0]],
]
const stringPaths: Path[] = [
  ['jurisdiction'], ['intendedUse'], ['basis'], ['evidence', 0, 'sourceRef'], ['evidence', 0, 'verifiedOn'],
  ['requirements', 0, 'key'], ['requirements', 0, 'description'], ['requirements', 0, 'basis'],
  ['requirements', 0, 'evidence', 0, 'sourceRef'], ['requirements', 0, 'evidence', 0, 'verifiedOn'],
  ['warnings', 0, 'key'], ['warnings', 0, 'text'], ['warnings', 0, 'handlingBasis'],
  ['warnings', 0, 'requirementKeys', 0], ['warnings', 0, 'evidence', 0, 'sourceRef'],
  ['warnings', 0, 'evidence', 0, 'verifiedOn'],
]
const arrayPaths: Path[] = [
  ['evidence'], ['requirements'], ['warnings'], ['requirements', 0, 'evidence'],
  ['warnings', 0, 'evidence'], ['warnings', 0, 'requirementKeys'],
]

describe('decodeEditorialCareReview primitive shape', () => {
  it('accepts the exact unknown branch only', () => {
    expect(decode({ state: 'unknown' })).toEqual({ state: 'unknown' })
    for (const input of [{}, { state: 'known' }, { state: 'Unknown' }, { state: null }]) {
      expect(decode(input)).toBeNull()
    }
    for (const key of Object.keys(prepared()).filter((key) => key !== 'state')) {
      expect(decode({ state: 'unknown', [key]: null })).toBeNull()
    }
    expect(decode({ state: 'unknown', extra: true })).toBeNull()
  })

  it('preserves incomplete, duplicate, unresolved and unbound private content without mutation', () => {
    const input = prepared()
    const before = structuredClone(input)
    expect(decode(input)).toEqual(before)
    expect(input).toEqual(before)
  })

  it.each(['satisfied', 'not_applicable', 'unresolved', 'conflicting'] as const)(
    'preserves disposition %s', (disposition) => {
      const input = prepared()
      input.requirements[0]!.disposition = disposition
      expect(decode(input)).toEqual(input)
    },
  )
  it.each(['private_only', 'public_required', 'unresolved'] as const)(
    'preserves disclosure %s', (disclosure) => {
      const input = prepared()
      input.warnings[0]!.disclosure = disclosure
      expect(decode(input)).toEqual(input)
    },
  )
  it.each(['identified', 'none_applicable'] as const)('preserves determination %s', (determination) => {
    const input = { ...prepared(), determination }
    // Nonempty contradictory capture is readable, not publication approval.
    expect(decode(input)).toEqual(input)
    expect(decode({ ...input, requirements: [], warnings: [], evidence: [] })).toEqual({
      ...input, requirements: [], warnings: [], evidence: [],
    })
  })

  it.each(objectPaths)('requires and closes every field in %s', (_name, path) => {
    for (const field of Object.keys(at(prepared(), path))) {
      const input = prepared()
      delete at(input, path)[field]
      expect(decode(input), `missing ${path.join('.')}.${field}`).toBeNull()
    }
    const input = prepared()
    at(input, path).extra = true
    expect(decode(input)).toBeNull()
    if (path.length) {
      for (const value of [null, [], '', 0, false]) expect(decode(replaced(path, value))).toBeNull()
    }
  })

  it.each(stringPaths.map((path) => [path] as const))('requires scalar string at %j', (path) => {
    for (const value of [undefined, null, false, 0, NaN, Infinity, [], {}, '\uD800', '\uDC00', 'a\uD800b']) {
      expect(decode(replaced(path, value))).toBeNull()
    }
    for (const value of ['', ' ', 'e\u0301 🦴\u0000']) {
      expect(decode(replaced(path, value))).toEqual(replaced(path, value))
    }
  })

  it.each(arrayPaths.map((path) => [path] as const))('requires an array at %j without adding minimum counts', (path) => {
    for (const value of [null, {}, '', 0, false, [null], [0], ['text']]) {
      // String items are valid only for requirementKeys.
      if (path[path.length - 1] === 'requirementKeys' && Array.isArray(value) && value[0] === 'text') continue
      expect(decode(replaced(path, value))).toBeNull()
    }
    expect(decode(replaced(path, []))).toEqual(replaced(path, []))
  })

  it('rejects nonexact enum values and wrong primitive states', () => {
    const paths: Path[] = [
      ['state'], ['determination'], ['requirements', 0, 'disposition'], ['warnings', 0, 'disclosure'],
    ]
    for (const path of paths) {
      for (const value of [null, false, 0, [], {}, '', 'UNKNOWN', ' identified ', 'published']) {
        expect(decode(replaced(path, value))).toBeNull()
      }
    }
  })

  it('rejects invalid roots including null rather than treating them as unknown', () => {
    for (const input of [null, undefined, [], '', 0, false, NaN, Infinity, () => ({ state: 'unknown' })]) {
      expect(decode(input)).toBeNull()
    }
  })

  it('detaches nested evidence, requirements, warnings and reference arrays', () => {
    const input = prepared()
    const before = structuredClone(input)
    const result = decode(input)
    expect(result).toEqual(before)
    if (result?.state !== 'prepared') throw new Error('Expected prepared capture')
    expect(result).not.toBe(input)
    result.evidence[0]!.sourceRef = 'changed'
    result.requirements[0]!.evidence[0]!.verifiedOn = 'changed'
    result.requirements.reverse()
    result.warnings[0]!.requirementKeys.push('changed')
    result.warnings[0]!.evidence[0]!.sourceRef = 'changed'
    result.warnings[0]!.handlingBasis = 'changed'
    expect(input).toEqual(before)
    input.requirements[0]!.description = 'input changed'
    expect(result.requirements[1]!.description).toBe('')
  })

  it('preserves distinguishable capture and evidence order without normalization', () => {
    const input = prepared()
    input.requirements[0]!.description = 'first'
    input.requirements[1]!.description = 'second'
    input.warnings[0]!.text = 'first warning'
    input.warnings[1]!.text = 'second warning'
    for (const entries of [input.evidence, input.requirements[0]!.evidence, input.warnings[0]!.evidence]) {
      entries.push({ sourceRef: ' second source ', verifiedOn: '' }, evidence())
    }
    expect(decode(input)).toEqual(input)
  })

  it('rejects a nested submitted accessor without executing it', () => {
    const input = prepared()
    let calls = 0
    Object.defineProperty(input.warnings[0]!.evidence[0]!, 'sourceRef', {
      enumerable: true,
      get() { calls++; throw new Error('must not execute') },
    })
    expect(decode(input)).toBeNull()
    expect(calls).toBe(0)
    expect(Object.getOwnPropertyDescriptor(input.warnings[0]!.evidence[0]!, 'sourceRef')?.get)
      .toBeTypeOf('function')
  })
})
