import { describe, expect, it } from 'vitest'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES as productionCodes } from '../../interfaces/editorial-production-codes'
import { decodeEditorialSellableFacts } from '../editorial-contract-document'
import { isFreshEditorialFactsCapture as capture } from '../editorial-contract-facts-validation'

const evidence = () => ({ sourceRef: ' manufacturer ', verifiedOn: '2024-02-29' })
const known = (key: string, value: unknown, basis = ' manufacturer basis ') =>
  ({ key, state: 'known', value, evidence: evidence(), basis })
const unknown = (key = 'consumable') => ({ key, state: 'unknown', evidence: null })
const row = (overrides: Record<string, unknown> = {}) => ({
  variantId: null, presentation: ' presentation ', declarations: [], careReview: null, ...overrides,
})
const withDeclaration = (declaration: unknown) => [row({ declarations: [declaration] })]
const prepared = () => ({
  state: 'prepared', jurisdiction: 'AR', intendedUse: 'Use', determination: 'identified',
  evidence: [], basis: 'Basis', requirements: [], warnings: [],
})
const dimensionCodes = productionCodes.filter((code) => code.startsWith('measure.dimensions.'))
const subsets = [
  { key: 'relevantDimensionCodes', field: 'codes', values: dimensionCodes, max: 8 },
  { key: 'relevantDimensionCodes', field: 'toyTypes', values: Array.from({ length: 15 }, (_, i) => `toy-${i}`), max: 15 },
  { key: 'relevantFitCodes', values: productionCodes.filter((code) => code.startsWith('measure.fit.')), max: 3 },
  { key: 'relevantCapacityCodes', values: productionCodes.filter((code) => code.startsWith('measure.capacity.')), max: 2 },
  { key: 'relevantEquipmentCodes', values: productionCodes.filter((code) => code.startsWith('measure.equipment.')), max: 5 },
  { key: 'optionalNonpertinenceCodes', values: [...productionCodes], max: 68 },
]
function subsetDeclaration(spec: typeof subsets[number], values: string[]) {
  return known(spec.key, spec.field ? { codes: [], toyTypes: [], [spec.field]: values } : values)
}
function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

describe('isFreshEditorialFactsCapture — capture only, never authorization', () => {
  it.each([0, 200, 201])('checks %i rows with unique subjects', (count) => {
    expect(capture(Array.from({ length: count }, (_, i) => row({ variantId: `v-${i}` })))).toBe(count <= 200)
  })
  it.each([null, undefined, {}, 'facts', [null], [row(), {}]])('rejects nonarrays or malformed rows: %j', (raw) => {
    expect(capture(raw)).toBe(false)
  })
  it.each([null, '', 'v', ' ', '__proto__', 'constructor', 'toString'])('rejects duplicate exact subject %j', (variantId) => {
    expect(capture([row({ variantId }), row({ variantId })])).toBe(false)
  })
  it('does not trim, stringify null, or collide special identities', () => {
    expect(capture([null, 'null', '', ' ', 'v', ' v ', '__proto__', 'constructor', 'toString']
      .map((variantId) => row({ variantId })))).toBe(true)
  })
  it.each([1, 300, 301])('counts presentation Unicode scalars: %i', (size) => {
    expect(capture([row({ presentation: '😀'.repeat(size) })])).toBe(size <= 300)
  })
  it.each(['', ' \t\n', '\u00a0', '\ud800', 'ok\udfff'])('rejects blank or nonscalar presentation %j', (presentation) => {
    expect(capture([row({ presentation })])).toBe(false)
  })
  it('allows prose controls and retains whitespace', () => {
    expect(capture(withDeclaration(known('consumable', false, ' \u0000\u007f ')))).toBe(true)
    expect(capture([row({ presentation: '\u0000\u007f' })])).toBe(true)
  })
  const keys = ['contentMagnitude', 'consumable', 'animalApplied', 'fitDeterminesChoice',
    'capacityDeterminesChoice', 'electricalApplies', 'relevantDimensionCodes', 'relevantFitCodes',
    'relevantCapacityCodes', 'relevantEquipmentCodes', 'presentationKind', 'optionalNonpertinenceCodes']
  it.each([0, 12, 13])('checks %i declarations', (size) => {
    const declarations = Array.from({ length: size }, (_, i) => unknown(keys[i % keys.length]))
    expect(capture([row({ declarations })])).toBe(size <= 12)
  })
  it.each(['unknown/unknown', 'known/known', 'unknown/known'])('rejects duplicate declaration keys: %s', (states) => {
    const declarations = states.split('/').map((state) => state === 'known' ? known('consumable', false) : unknown())
    expect(capture([row({ declarations })])).toBe(false)
  })
  it('accepts mixed known and unknown distinct declarations', () => {
    expect(capture([row({ declarations: [unknown(), known('animalApplied', false)] })])).toBe(true)
  })
  it.each([{ value: false }, { value: [] }])('requires basis/evidence even for known $value', ({ value }) => {
    const key = value === false ? 'consumable' : 'relevantFitCodes'
    for (const size of [1, 2000, 2001]) {
      expect(capture(withDeclaration(known(key, value, '😀'.repeat(size))))).toBe(size <= 2000)
    }
    for (const basis of ['', ' \n', '\ud800']) {
      expect(capture(withDeclaration(known(key, value, basis)))).toBe(false)
    }
    for (const badEvidence of [null, { sourceRef: '', verifiedOn: '2024-02-29' },
      { sourceRef: 'x', verifiedOn: '2023-02-29' }, { sourceRef: 'x\u0000', verifiedOn: '2024-02-29' },
      { sourceRef: 'x'.repeat(1001), verifiedOn: '2024-02-29' }]) {
      expect(capture(withDeclaration({ ...known(key, value), evidence: badEvidence }))).toBe(false)
    }
    const missing = known(key, value) as Record<string, unknown>
    delete missing.basis
    expect(capture(withDeclaration(missing))).toBe(false)
    const missingEvidence = known(key, value) as Record<string, unknown>
    delete missingEvidence.evidence
    expect(capture(withDeclaration(missingEvidence))).toBe(false)
  })
  for (const spec of subsets) {
    it(`${spec.key}/${spec.field ?? 'value'} enforces empty/max/overflow/unique`, () => {
      expect(spec.values).toHaveLength(spec.max)
      expect(capture(withDeclaration(subsetDeclaration(spec, [])))).toBe(true)
      expect(capture(withDeclaration(subsetDeclaration(spec, [...spec.values])))).toBe(true)
      expect(capture(withDeclaration(subsetDeclaration(spec, [...spec.values, spec.values[0]!])))).toBe(false)
      expect(capture(withDeclaration(subsetDeclaration(spec, [spec.values[0]!, spec.values[0]!])))).toBe(false)
    })
  }
  it('rejects 16 distinct toy identities independently of the eight dimension codes', () => {
    expect(capture(withDeclaration(known('relevantDimensionCodes', {
      codes: [], toyTypes: Array.from({ length: 16 }, (_, i) => `toy-${i}`),
    })))).toBe(false)
    expect(capture(withDeclaration(known('relevantDimensionCodes', {
      codes: [], toyTypes: ['toy', ' toy ', '__proto__', 'constructor', 'toString'],
    })))).toBe(true)
  })
  it('reuses primitive declaration value unions instead of accepting arbitrary codes', () => {
    for (const [key, value] of [['contentMagnitude', 'custom'], ['presentationKind', 'custom'],
      ['consumable', 'false'], ['relevantFitCodes', ['measure.fit.custom']],
      ['relevantCapacityCodes', ['measure.capacity.custom']],
      ['relevantEquipmentCodes', ['measure.equipment.custom']]]) {
      expect(capture(withDeclaration(known(key as string, value)))).toBe(false)
    }
  })
  it('keeps dimension and toy namespaces separate, including exact toy identities', () => {
    expect(capture(withDeclaration(known('relevantDimensionCodes', {
      codes: [...dimensionCodes], toyTypes: [dimensionCodes[0], '', ' ', '__proto__', 'constructor'],
    })))).toBe(true)
    expect(capture(withDeclaration(known('relevantDimensionCodes', {
      codes: ['toy-0'], toyTypes: [],
    })))).toBe(false)
    expect(capture(withDeclaration(known('relevantDimensionCodes', {
      codes: [], toyTypes: ['\ud800'],
    })))).toBe(false)
    expect(capture(withDeclaration(known('optionalNonpertinenceCodes', ['custom.code'])))).toBe(false)
  })
  it('unknown has no basis/value, but extra fields or malformed keys fail', () => {
    expect(capture(withDeclaration(unknown()))).toBe(true)
    for (const extra of [{ basis: 'basis' }, { value: false }, { evidence: evidence() }]) {
      expect(capture(withDeclaration({ ...unknown(), ...extra }))).toBe(false)
    }
    expect(capture(withDeclaration(unknown('custom')))).toBe(false)
  })
  it('propagates nonnull care capture without care eligibility or readiness inference', () => {
    for (const careReview of [null, { state: 'unknown' }, prepared(),
      { ...prepared(), determination: 'none_applicable', requirements: [{
        key: 'r', description: 'D', disposition: 'conflicting', evidence: [], basis: 'B',
      }] }]) expect(capture([row({ careReview })])).toBe(true)
    for (const careReview of [{ ...prepared(), basis: '' }, { ...prepared(), jurisdiction: 'x'.repeat(201) },
      { ...prepared(), evidence: [{ sourceRef: 'x', verifiedOn: 'bad' }] },
      { ...prepared(), warnings: [{ key: 'w', requirementKeys: ['missing'], text: 'W',
        disclosure: 'public_required', evidence: [], handlingBasis: 'B' }] }, undefined]) {
      expect(capture([row({ careReview })])).toBe(false)
    }
  })
  it('checks all rows, including unknown/inactive subjects', () => {
    expect(capture([row({ variantId: 'active' }), row({ variantId: 'inactive', presentation: '' })])).toBe(false)
  })
  it('rejects closed nested shape violations', () => {
    for (const raw of [[row({ extra: true })], withDeclaration({ ...known('consumable', false), extra: 1 }),
      withDeclaration({ ...known('consumable', false), evidence: { ...evidence(), extra: 1 } }),
      withDeclaration(known('relevantDimensionCodes', { codes: [], toyTypes: [], extra: 1 })),
      [row({ careReview: { state: 'unknown', extra: 1 } })]]) expect(capture(raw)).toBe(false)
  })
  it('rejects accessors at array, row, declaration, subset, evidence and care without execution', () => {
    let calls = 0
    const getter = { enumerable: true, get() { calls++; throw new Error('must not execute') } }
    const array: unknown[] = []
    Object.defineProperty(array, '0', getter)
    const rawRow = row()
    Object.defineProperty(rawRow, 'presentation', getter)
    const declaration = known('consumable', false)
    Object.defineProperty(declaration, 'basis', getter)
    const subset: unknown[] = []
    Object.defineProperty(subset, '0', getter)
    const badEvidence = evidence()
    Object.defineProperty(badEvidence, 'sourceRef', getter)
    const care = prepared()
    Object.defineProperty(care, 'basis', getter)
    for (const raw of [array, [rawRow], withDeclaration(declaration),
      withDeclaration(known('relevantFitCodes', subset)),
      withDeclaration({ ...known('consumable', false), evidence: badEvidence }), [row({ careReview: care })]]) {
      expect(capture(raw)).toBe(false)
    }
    expect(calls).toBe(0)
  })
  it('rejects sparse, decorated, cyclic and non-JSON containers safely', () => {
    const decorated = Object.assign([], { extra: true })
    const cyclic: unknown[] = []; cyclic.push(cyclic)
    for (const raw of [new Array(1), decorated, cyclic, new Date(), [new Map()]]) expect(capture(raw)).toBe(false)
  })
  it.each([true, false])('does not mutate frozen input (valid=%s)', (valid) => {
    const raw = freezeDeep([row({ declarations: [known('relevantDimensionCodes', {
      codes: [...dimensionCodes].reverse(), toyTypes: [' z ', 'a'],
    }, valid ? ' basis ' : '')] })])
    const before = JSON.stringify(raw)
    expect(capture(raw)).toBe(valid)
    expect(JSON.stringify(raw)).toBe(before)
  })
  it('leaves oversize historical primitive rows readable', () => {
    const raw = row({ presentation: 'x'.repeat(301), declarations: [known('consumable', false, 'b'.repeat(2001))] })
    expect(decodeEditorialSellableFacts(raw)).toEqual(raw)
    expect(capture([raw])).toBe(false)
  })
  it('does not infer context/family/axis/optional-route/toy-reference/current-E/NA/readiness permission', () => {
    // Unknown subjects and mutually contradictory production declarations are capture-valid.
    // A custom family's authority to use these production declarations is NOT established here.
    const raw = [row({ variantId: 'not-in-current-context', declarations: [
      known('consumable', false), known('animalApplied', true), known('contentMagnitude', 'mass'),
      known('fitDeterminesChoice', false), known('relevantFitCodes', ['measure.fit.neck']),
      known('presentationKind', 'device'), known('optionalNonpertinenceCodes', ['animal.target']),
      known('relevantDimensionCodes', { codes: [], toyTypes: ['unresolved-toy-reference'] }),
    ], careReview: prepared() })]
    expect(capture(raw)).toBe(true)
    // No facts does not mean all actual sellables were covered or publication-ready.
    expect(capture([])).toBe(true)
  })
})
