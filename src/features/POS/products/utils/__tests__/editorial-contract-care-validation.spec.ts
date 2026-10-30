import { describe, expect, it } from 'vitest'
import type { EditorialRequirement, EditorialReviewWarning } from '../../interfaces/editorial-contract-care.types'
import { decodeEditorialCareReview } from '../editorial-contract-care'
import { isFreshEditorialCareCapture as fresh } from '../editorial-contract-care-validation'

const evidence = (sourceRef = ' source 🦴 ', verifiedOn = '2024-02-29') => ({ sourceRef, verifiedOn })
const requirement = (key = 'r'): EditorialRequirement => ({
  key, description: ' description ', disposition: 'unresolved', evidence: [], basis: ' basis ',
})
const warning = (key = 'w'): EditorialReviewWarning => ({
  key, requirementKeys: ['r'], text: ' warning ', disclosure: 'public_required',
  evidence: [], handlingBasis: ' handling ',
})
const prepared = () => ({
  state: 'prepared' as const, jurisdiction: ' jurisdiction ', intendedUse: ' intended use ',
  determination: 'identified' as const, evidence: [evidence()], basis: ' basis ',
  requirements: [requirement()], warnings: [warning()],
})
type Path = (string | number)[]
function at(input: unknown, path: Path): Record<string | number, unknown> {
  let target = input as Record<string | number, unknown>
  for (const key of path) target = target[key] as Record<string | number, unknown>
  return target
}
function replaced(path: Path, value: unknown) {
  const input = prepared()
  at(input, path.slice(0, -1))[path[path.length - 1]!] = value
  return input
}
const prose: [string, Path, number][] = [
  ['jurisdiction', ['jurisdiction'], 200], ['intendedUse', ['intendedUse'], 1000],
  ['review basis', ['basis'], 2000], ['requirement key', ['requirements', 0, 'key'], 80],
  ['description', ['requirements', 0, 'description'], 2000],
  ['requirement basis', ['requirements', 0, 'basis'], 2000],
  ['warning key', ['warnings', 0, 'key'], 80], ['warning text', ['warnings', 0, 'text'], 4000],
  ['handlingBasis', ['warnings', 0, 'handlingBasis'], 2000],
]
// Changing a requirement key also changes its local reference, to isolate prose limits.
function proseInput(path: Path, value: string) {
  const input = replaced(path, value)
  if (path.join('.') === 'requirements.0.key') input.warnings[0]!.requirementKeys = [value]
  return input
}
const evidencePaths: [string, Path][] = [
  ['review', ['evidence']], ['requirement', ['requirements', 0, 'evidence']],
  ['warning', ['warnings', 0, 'evidence']],
]
function freezeDeep(value: unknown): void {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
}

describe('isFreshEditorialCareCapture capture-only admission (S12/S20/S22)', () => {
  it('accepts unknown and a prepared draft, not nullable caller optionality', () => {
    expect(fresh({ state: 'unknown' })).toBe(true)
    expect(fresh(prepared())).toBe(true)
    for (const raw of [null, undefined, [], '', 0, false, {}, { state: 'Unknown' }]) {
      expect(fresh(raw)).toBe(false)
    }
  })

  it.each(prose)('%s counts scalar points at 1/max/max+1', (_name, path, max) => {
    for (const text of ['x', '🦴', 'x'.repeat(max), '🦴'.repeat(max)]) {
      expect(fresh(proseInput(path, text))).toBe(true)
    }
    for (const text of ['x'.repeat(max + 1), '🦴'.repeat(max + 1)]) {
      expect(fresh(proseInput(path, text))).toBe(false)
    }
  })

  it.each(prose)('%s rejects blank and lone surrogates, not prose controls', (_name, path) => {
    for (const text of ['', ' \t\r\n\u00a0\ufeff', '\ud800', 'x\udc00']) {
      expect(fresh(proseInput(path, text))).toBe(false)
    }
    for (let code = 0; code <= 127; code++) {
      if (code < 32 || code === 127) {
        expect(fresh(proseInput(path, ` x${String.fromCharCode(code)} `))).toBe(true)
      }
    }
  })

  it.each(evidencePaths)('%s evidence allows 0/16, rejects 17 and each invalid item', (_name, path) => {
    for (const count of [0, 1, 16, 17]) {
      const entries = Array.from({ length: count }, (_, i) => evidence(`source ${i}`))
      expect(fresh(replaced(path, entries))).toBe(count <= 16)
    }
    for (const invalid of [null, {}, evidence(' '), evidence('\u0000'), evidence('a\u007f'),
      evidence('\ud800'), evidence('a'.repeat(1001)), evidence('ok', '2023-02-29'),
      evidence('ok', '2024-02-29\n'), evidence('ok', '0000-01-01')]) {
      expect(fresh(replaced(path, [evidence(), invalid]))).toBe(false)
    }
    for (let code = 0; code < 32; code++) {
      expect(fresh(replaced(path, [evidence(`a${String.fromCharCode(code)}`)]))).toBe(false)
    }
    expect(fresh(replaced(path, [evidence('🦴'.repeat(1000), '9999-12-31')]))).toBe(true)
  })

  it.each(evidencePaths)('%s evidence uses exact pair identity, not source/date alone', (_name, path) => {
    expect(fresh(replaced(path, [evidence(), evidence()]))).toBe(false)
    expect(fresh(replaced(path, [evidence('a'), evidence('a', '2024-03-01')]))).toBe(true)
    expect(fresh(replaced(path, [evidence('a'), evidence('b')]))).toBe(true)
    expect(fresh(replaced(path, [evidence('a'), evidence(' a ')]))).toBe(true)
    // Separator-like content stays literal; dates cannot contain injected delimiters.
    expect(fresh(replaced(path, [evidence('a|2024-02-29'), evidence('a')]))).toBe(true)
  })

  it.each(['requirements', 'warnings'] as const)('%s permits 0/32 but not 33', (field) => {
    for (const count of [0, 32, 33]) {
      const input = prepared()
      if (field === 'requirements') {
        input.requirements = Array.from({ length: count }, (_, i) => requirement(`r${i}`))
        input.warnings[0]!.requirementKeys = []
      } else input.warnings = Array.from({ length: count }, (_, i) => warning(`w${i}`))
      expect(fresh(input)).toBe(count <= 32)
    }
  })

  it('requires unique keys separately, permits cross-namespace and exact whitespace distinctions', () => {
    const input = prepared()
    input.requirements.push(requirement())
    expect(fresh(input)).toBe(false)
    input.requirements[1]!.key = ' r '
    expect(fresh(input)).toBe(true)
    input.warnings.push(warning())
    expect(fresh(input)).toBe(false)
    input.warnings[1]!.key = ' w '
    input.warnings[0]!.key = 'r'
    expect(fresh(input)).toBe(true)
  })

  it('references allow 0/32, reject 33, duplicate, missing and other-review keys', () => {
    const input = prepared()
    input.requirements = Array.from({ length: 32 }, (_, i) => requirement(`r${i}`))
    for (const count of [0, 32]) {
      input.warnings[0]!.requirementKeys = input.requirements.slice(0, count).map(({ key }) => key)
      expect(fresh(input)).toBe(true)
    }
    input.warnings[0]!.requirementKeys.push('r0')
    expect(fresh(input)).toBe(false)
    for (const keys of [['r0', 'r0'], ['missing'], ['r0 '], ['w']]) {
      input.warnings[0]!.requirementKeys = keys
      expect(fresh(input)).toBe(false)
    }
    expect(fresh(prepared())).toBe(true) // prior reviews do not reserve global keys
    const other = prepared()
    other.requirements = [requirement('other')]
    expect(fresh(other)).toBe(false) // r exists only in another review
  })

  it('uses local sets for prototype names and separator-like keys, without global evidence identity', () => {
    const input = prepared()
    const keys = ['__proto__', 'constructor', 'toString', 'a|b', 'a', 'b|c', 'a|b|c', '["a","b"]']
    input.requirements = keys.map((key) => ({ ...requirement(key), evidence: [evidence()] }))
    input.warnings = keys.map((key) => ({ ...warning(key), requirementKeys: keys, evidence: [evidence()] }))
    expect(fresh(input)).toBe(true)
    input.warnings[0]!.requirementKeys.push('__proto__')
    expect(fresh(input)).toBe(false)
  })

  it('accepts every readiness state and contradictory none_applicable with nonempty rows', () => {
    for (const determination of ['identified', 'none_applicable'] as const) {
      for (const disposition of ['satisfied', 'not_applicable', 'unresolved', 'conflicting'] as const) {
        for (const disclosure of ['private_only', 'public_required', 'unresolved'] as const) {
          const input = { ...prepared(), determination }
          input.requirements[0]!.disposition = disposition
          input.warnings[0]!.disclosure = disclosure
          input.evidence = []
          expect(fresh(input)).toBe(true)
          expect(fresh({ ...input, requirements: [], warnings: [] })).toBe(true)
        }
      }
    }
  })

  it('retains strict primitive shapes at every nested object and rejects getters without calls', () => {
    const paths: Path[] = [[], ['requirements', 0], ['warnings', 0], ['evidence', 0]]
    for (const path of paths) {
      const input = prepared()
      at(input, path).extra = true
      expect(fresh(input)).toBe(false)
      const accessor = prepared()
      let calls = 0
      const key = Object.keys(at(accessor, path))[0]!
      Object.defineProperty(at(accessor, path), key, {
        enumerable: true, get() { calls++; throw new Error('must not execute') },
      })
      expect(fresh(accessor)).toBe(false)
      expect(calls).toBe(0)
    }
    expect(fresh({ state: 'unknown', basis: 'extra' })).toBe(false)
  })

  it('does not mutate valid frozen input or normalize exact strings and ordering', () => {
    const input = prepared()
    input.requirements.push(requirement(' r '))
    input.warnings[0]!.requirementKeys = [' r ', 'r']
    const before = structuredClone(input)
    freezeDeep(input)
    expect(fresh(input)).toBe(true)
    expect(input).toEqual(before)
    const invalid = replaced(['basis'], ' ')
    const invalidBefore = structuredClone(invalid)
    freezeDeep(invalid)
    expect(fresh(invalid)).toBe(false)
    expect(invalid).toEqual(invalidBefore)
  })

  it('does not tighten the stored reader for historical oversize or invalid fresh content', () => {
    const input = prepared()
    input.jurisdiction = 'x'.repeat(201)
    input.evidence = Array.from({ length: 17 }, () => evidence('bad\u0000', 'not a date'))
    input.requirements = Array.from({ length: 33 }, () => requirement('x'.repeat(81)))
    input.warnings = Array.from({ length: 33 }, () => warning())
    expect(decodeEditorialCareReview(input)).toEqual(input)
    expect(fresh(input)).toBe(false)
  })
})
