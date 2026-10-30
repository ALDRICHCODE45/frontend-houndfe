import { describe, expect, it } from 'vitest'
import type { EditorialContractDocument, EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import { decodeEditorialContractDocument as decode, decodeEditorialSellableFacts as decodeFacts } from '../editorial-contract-document'

const evidence = () => ({ sourceRef: ' source 🦴 ', verifiedOn: 'not a date' })
const facts = (): EditorialSellableFacts => ({
  variantId: null, presentation: '', declarations: [], careReview: null,
})
const clean = (): EditorialContractDocument => ({
  schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [],
  familyCode: null, values: [], facts: [],
})
const populated = (): EditorialContractDocument => ({
  ...clean(), commercialTitle: ' e\u0301 🦴 ', description: '', mediaRefs: ['z', 'a', 'z'],
  values: [
    { code: 'custom', owner: 'product', variantId: 'out-of-scope', state: 'known',
      payload: { type: 'multi', value: ['z', 'a', 'z'] }, evidence: evidence() },
    { code: 'custom', owner: 'product', variantId: 'out-of-scope', state: 'unknown', evidence: null },
    { code: 'custom', owner: 'product', variantId: 'out-of-scope', state: 'not_applicable', evidence: null },
  ],
  facts: [
    { ...facts(), variantId: 'out-of-scope', presentation: ' first ', declarations: [
      { key: 'consumable', state: 'known', value: false, evidence: evidence(), basis: '' },
      { key: 'consumable', state: 'unknown', evidence: null },
      { key: 'relevantDimensionCodes', state: 'known',
        value: { codes: [], toyTypes: ['z', 'a', 'z'] }, evidence: evidence(), basis: ' ' },
    ], careReview: { state: 'unknown' } },
    { ...facts(), variantId: 'out-of-scope', presentation: ' second ', careReview: {
      state: 'prepared', jurisdiction: '', intendedUse: ' ', determination: 'none_applicable',
      evidence: [evidence()], basis: '', requirements: [
        { key: 'same', description: '', disposition: 'conflicting', evidence: [], basis: '' },
        { key: 'same', description: '', disposition: 'unresolved', evidence: [], basis: '' },
      ], warnings: [{ key: '', requirementKeys: ['missing', 'missing'], text: ' private ',
        disclosure: 'public_required', evidence: [evidence()], handlingBasis: '' }],
    } },
    facts(),
  ],
})

type Path = (string | number)[]
function at(input: unknown, path: Path): Record<string | number, unknown> {
  let target = input as Record<string | number, unknown>
  for (const key of path) target = target[key] as Record<string | number, unknown>
  return target
}
function replaced(path: Path, value: unknown): EditorialContractDocument {
  const input = populated()
  at(input, path.slice(0, -1))[path[path.length - 1]!] = value
  return input
}

const documentTypes: [string, unknown[]][] = [
  ['schemaVersion', [null, '2', 1, 3, false]],
  ['commercialTitle', [0, false, [], {}]], ['description', [0, false, [], {}]],
  ['mediaRefs', [null, '', {}, [null], [0]]], ['familyCode', [0, false, [], {}]],
  ['values', [null, '', {}, [null], [0]]], ['facts', [null, '', {}, [null], [0]]],
]
const factsTypes: [string, unknown[]][] = [
  ['variantId', [0, false, [], {}]], ['presentation', [null, 0, false, [], {}]],
  ['declarations', [null, '', {}, [null], [0]]], ['careReview', [0, false, '', [], {}]],
]

describe('editorial document primitive composition', () => {
  it('accepts the exact clean noPublished document', () => {
    expect(decode(clean())).toEqual(clean())
  })

  it('accepts standalone facts with explicit null care and no minimum content', () => {
    expect(decodeFacts(facts())).toEqual(facts())
  })

  it('composes all assignment states, declarations and unknown/prepared/null care losslessly', () => {
    const input = populated()
    const before = structuredClone(input)
    expect(decode(input)).toEqual(before)
    for (const row of input.facts) expect(decodeFacts(row)).toEqual(row)
    expect(input).toEqual(before)
  })

  it('does not impose fresh numeric domains, family rules or tuple uniqueness', () => {
    const input = populated()
    input.values.push({ code: '', owner: 'sellable', variantId: null, state: 'known',
      payload: { type: 'range', min: 20, max: -1, unit: '' }, evidence: null })
    input.values.push(structuredClone(input.values[0]!))
    input.facts.push(structuredClone(input.facts[0]!))
    expect(decode(input)).toEqual(input)
    expect(decode({ ...input, familyCode: 'inactive-family' })).toEqual({ ...input, familyCode: 'inactive-family' })
  })

  it('requires every document and facts field and rejects extra fields', () => {
    for (const [base, reader] of [[clean(), decode], [facts(), decodeFacts]] as const) {
      for (const key of Object.keys(base)) {
        const input: Record<string, unknown> = { ...base }
        delete input[key]
        expect(reader(input), `missing ${key}`).toBeNull()
      }
      expect(reader({ ...base, extra: null })).toBeNull()
    }
  })

  it.each(documentTypes)('rejects wrong document types at %s', (key, values) => {
    for (const value of values) expect(decode({ ...clean(), [key]: value })).toBeNull()
  })

  it.each(factsTypes)('rejects wrong standalone and nested facts types at %s', (key, values) => {
    for (const value of values) {
      const row = { ...facts(), [key]: value }
      expect(decodeFacts(row)).toBeNull()
      expect(decode({ ...clean(), facts: [facts(), row, facts()] })).toBeNull()
    }
  })

  it('rejects invalid roots, old five-key documents and mode wrappers without conversion', () => {
    const { schemaVersion: _schema, facts: _facts, ...old } = clean()
    for (const input of [null, undefined, [], '', 0, false, old,
      { mode: 'draft', document: clean() }, { ...clean(), mode: 'draft' }]) {
      expect(decode(input)).toBeNull()
    }
    for (const input of [null, undefined, [], '', 0, false]) expect(decodeFacts(input)).toBeNull()
    expect(decode({ ...clean(), values: [{ code: 'custom', owner: 'product', variantId: null,
      type: 'text', value: 'old' }] })).toBeNull()
  })

  it('rejects the entire parent for one malformed nested atom, never pruning or substituting', () => {
    const cases: [Path, unknown][] = [
      [['values', 1, 'evidence'], evidence()],
      [['values', 0, 'payload', 'value'], [null]],
      [['values', 0, 'evidence', 'verifiedOn'], 42],
      [['facts', 0, 'extra'], true],
      [['facts', 0, 'declarations', 0, 'value'], 'false'],
      [['facts', 0, 'declarations', 1, 'basis'], 'extra'],
      [['facts', 0, 'declarations', 2, 'value', 'toyTypes'], [false]],
      [['facts', 0, 'careReview', 'basis'], 'extra'],
      [['facts', 1, 'careReview', 'warnings', 0, 'evidence', 0, 'sourceRef'], null],
      [['facts', 1, 'careReview', 'requirements', 1, 'disposition'], 'invalid'],
    ]
    for (const [path, value] of cases) {
      const input = replaced(path, value)
      expect(decode(input), path.join('.')).toBeNull()
      if (path[0] === 'facts') expect(decodeFacts(input.facts[path[1] as number])).toBeNull()
    }
  })

  it('requires scalar strings at composition fields without normalizing valid text', () => {
    const paths: Path[] = [
      ['commercialTitle'], ['description'], ['mediaRefs', 0], ['familyCode'],
      ['facts', 0, 'variantId'], ['facts', 0, 'presentation'],
    ]
    for (const path of paths) {
      for (const value of ['\uD800', '\uDC00', 'a\uD800b']) expect(decode(replaced(path, value))).toBeNull()
      for (const value of ['', ' ', ' e\u0301 🦴\u0000 ']) {
        const input = replaced(path, value)
        expect(decode(input)).toEqual(input)
      }
    }
  })

  it('detaches arrays and nested outputs while preserving distinguishable order and input', () => {
    const input = populated()
    const before = structuredClone(input)
    const result = decode(input)
    expect(result).toEqual(before)
    if (!result) throw new Error('Expected readable document')
    expect(result).not.toBe(input)
    result.mediaRefs.reverse()
    const value = result.values[0]!
    if (value.state !== 'known' || value.payload.type !== 'multi') throw new Error('Expected multi')
    value.payload.value.push('changed')
    value.evidence!.sourceRef = 'changed'
    result.values.reverse()
    const declaration = result.facts[0]!.declarations[2]!
    if (declaration.state !== 'known' || declaration.key !== 'relevantDimensionCodes') throw new Error('Expected dimensions')
    declaration.value.toyTypes.reverse()
    const care = result.facts[1]!.careReview
    if (care?.state !== 'prepared') throw new Error('Expected prepared care')
    care.warnings[0]!.requirementKeys.push('changed')
    care.requirements.reverse()
    result.facts.reverse()
    expect(input).toEqual(before)
    const row = decodeFacts(input.facts[0])!
    row.declarations.reverse()
    row.presentation = 'changed'
    expect(input).toEqual(before)
  })

  it('rejects a meaningful nested accessor without executing or replacing it', () => {
    const input = populated()
    const target = at(input, ['facts', 1, 'careReview', 'warnings', 0, 'evidence', 0])
    let calls = 0
    Object.defineProperty(target, 'sourceRef', {
      enumerable: true, get() { calls++; throw new Error('must not execute') },
    })
    expect(decode(input)).toBeNull()
    expect(decodeFacts(input.facts[1])).toBeNull()
    expect(calls).toBe(0)
    expect(Object.getOwnPropertyDescriptor(target, 'sourceRef')?.get).toBeTypeOf('function')
  })
})
