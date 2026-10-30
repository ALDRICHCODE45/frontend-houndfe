import { describe, expect, it } from 'vitest'
import type { EditorialContractDocument, EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import type { EditorialKnownPayload } from '../../interfaces/editorial-contract-value.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialArchivedConservation, qualifyEditorialConservationBaseline } from '../editorial-contract-conservation'

const evidence = { sourceRef: '', verifiedOn: '2025-02-30' }
const context = { variants: [{ id: 'v', name: 'V' }, { id: 'null', name: 'Null' }] }
function vocabulary(type: 'single' | 'multi' = 'multi'): EditorialContractVocabulary {
  return { semanticsVersion: 'editorial-production-1', definitions: [{ id: 'current-definition', code: '__proto__',
    label: 'Choice', type, options: ['a', 'b', 'active', ' A ', 'a|b', '__proto__'].map((code, i) => ({
      code, label: 'Same label', archived: code !== 'active', sortOrder: i,
    })), groups: [{ code: 'group', label: 'Group', optionCodes: ['a'] }], aliases: [{ label: 'alias', optionCode: 'a' }] }],
  families: [{ id: 'current-family', code: 'care', label: 'Care', bindings: [{
    definitionId: 'current-definition', definitionCode: '__proto__', owner: 'sellable', sortOrder: 0,
    exposure: 'INTERNAL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' },
  }] }] }
}
function document(payload: EditorialKnownPayload = { type: 'multi', value: ['a', 'b'] }): EditorialContractDocument {
  return { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [], familyCode: 'care',
    values: [{ code: '__proto__', owner: 'sellable', variantId: 'v', state: 'known', payload, evidence }], facts: [] }
}
const row = (): EditorialSellableFacts => ({ variantId: 'v', presentation: '', declarations: [], careReview: {
  state: 'prepared', jurisdiction: '', intendedUse: '', determination: 'none_applicable', evidence: [], basis: '',
  requirements: [{ key: 'r', description: '', disposition: 'conflicting', evidence: [], basis: '' }],
  warnings: [{ key: 'w', requirementKeys: ['r'], text: '', disclosure: 'unresolved', evidence: [], handlingBasis: '' }],
} })
const inspect = (candidate: unknown = document(), baseline: unknown = document(), vocab = vocabulary(), ctx = context) =>
  inspectEditorialArchivedConservation({ document: candidate, baseline, vocabulary: vocab, context: ctx })
const warning = (optionCode: string, variantId: string | null = 'v') => ({ code: 'ARCHIVED_OPTION',
  familyId: 'current-family', definitionId: 'current-definition', owner: 'sellable', variantId, optionCode })
function freeze(value: unknown) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
}

describe('S6/S17/S24/S26/S27 explicit archived conservation, not fresh admission', () => {
  it('qualifies whole baseline to a deeply detached document, preserving history', () => {
    const raw = document(); raw.facts = [row()]
    const result = qualifyEditorialConservationBaseline(raw, vocabulary(), context)
    expect(result).toEqual(raw); expect(result).not.toBe(raw)
    expect(result!.values[0]).not.toBe(raw.values[0]); expect(result!.facts[0]!.careReview).not.toBe(raw.facts[0]!.careReview)
    result!.mediaRefs.push('new'); expect(raw.mediaRefs).toEqual([])
  })
  it.each([null, undefined, {}, { ...document(), extra: true }, { ...document(), schemaVersion: 1 }])(
    'never fabricates a baseline from %j', raw => {
      expect(qualifyEditorialConservationBaseline(raw, vocabulary(), context)).toBeNull()
      const result = inspectEditorialArchivedConservation({ document: document(), baseline: raw, vocabulary: vocabulary(), context })
      expect(result.issues).toHaveLength(2); expect(result.warnings).toEqual([])
    },
  )
  const invalidReferences: [string, (doc: EditorialContractDocument) => void][] = [
    ['unrelated media duplicate', d => { d.mediaRefs = ['x', 'x'] }],
    ['unrelated assignment', d => { d.values.push({ code: 'missing', owner: 'product', variantId: null, state: 'unknown', evidence: null }) }],
    ['unrelated fact subject', d => { d.facts = [{ ...row(), variantId: 'missing' }] }],
    ['duplicate fact subject', d => { d.facts = [row(), row()] }],
    ['declaration duplicate', d => { d.facts = [{ ...row(), declarations: [
      { key: 'optionalNonpertinenceCodes', state: 'unknown', evidence: null },
      { key: 'optionalNonpertinenceCodes', state: 'unknown', evidence: null },
    ] }] }],
    ['care duplicate', d => { const r = row(); if (r.careReview?.state === 'prepared') r.careReview.requirements.push(r.careReview.requirements[0]!); d.facts = [r] }],
    ['care reference', d => { const r = row(); if (r.careReview?.state === 'prepared') r.careReview.warnings[0]!.requirementKeys = ['missing']; d.facts = [r] }],
    ['care evidence pair duplicate', d => { const r = row(); if (r.careReview?.state === 'prepared') r.careReview.evidence = [evidence, evidence]; d.facts = [r] }],
    ['choice duplicate', d => { d.values[0] = { ...d.values[0]!, state: 'known', payload: { type: 'multi', value: ['a', 'a'] }, evidence } }],
  ]
  it.each(invalidReferences)('rejects entire baseline for %s but allows corrected active-only candidate', (_name, mutate) => {
    const baseline = document(); mutate(baseline)
    expect(qualifyEditorialConservationBaseline(baseline, vocabulary(), context)).toBeNull()
    expect(inspect(document(), baseline).warnings).toEqual([])
    expect(inspect(document(), baseline).issues).toHaveLength(2)
    const active = document({ type: 'multi', value: ['active'] })
    expect(inspect(active, baseline)).toEqual({ document: active, issues: [], warnings: [] })
  })
  it('rejects whole primitive failure and does not execute getters', () => {
    let calls = 0
    const bad = { ...document(), values: [document().values[0], { state: 'known' }] }
    Object.defineProperty(bad, 'commercialTitle', { enumerable: true, get() { calls++; return null } })
    expect(qualifyEditorialConservationBaseline(bad, vocabulary(), context)).toBeNull()
    expect(inspect(bad).document).toBeNull(); expect(inspect(bad).issues).toEqual([{ code: 'STRUCTURE' }])
    expect(inspect(bad).warnings).toEqual([]); expect(calls).toBe(0)
  })
  it('keeps fresh-invalid title/caps/prose/evidence/calendar/numeric bounds and range order reference-eligible', () => {
    const raw = document(); const vocab = vocabulary()
    raw.commercialTitle = 'x'.repeat(201); raw.description = 'x'.repeat(20001)
    raw.mediaRefs = Array.from({ length: 21 }, (_, i) => String(i)); raw.facts = [row()]
    vocab.definitions.push({ id: 'n', code: 'n', label: 'N', type: 'range', units: [{ code: 'u', label: 'U', sortOrder: 0 }],
      numericPolicy: { status: 'resolved', magnitude: 'm', integer: true, lower: 0, lowerInclusive: true, upper: 1, upperInclusive: true } })
    vocab.families[0]!.bindings.push({ ...vocab.families[0]!.bindings[0]!, definitionId: 'n', definitionCode: 'n' })
    raw.values.push({ code: 'n', owner: 'sellable', variantId: 'v', state: 'known', payload: { type: 'range', min: 9.5, max: -2, unit: 'u' }, evidence })
    expect(qualifyEditorialConservationBaseline(raw, vocab, context)).toEqual(raw)
    expect(inspect(raw, raw, vocab)).toEqual({ document: raw, issues: [], warnings: [warning('a'), warning('b')] })
  })
  it.each(invalidReferences)('candidate reference failure %s returns diagnostics, never partial warnings', (_name, mutate) => {
    const candidate = document(); mutate(candidate)
    const result = inspect(candidate)
    expect(result.document).toEqual(candidate); expect(result.issues.length).toBeGreaterThan(0); expect(result.warnings).toEqual([])
  })
  it.each(['single', 'multi'] as const)('conserves identical known %s identity with exact S17 fields', type => {
    const doc = document(type === 'single' ? { type, value: 'a' } : { type, value: ['b', 'a'] })
    expect(inspect(doc, doc, vocabulary(type))).toEqual({ document: doc, issues: [], warnings:
      type === 'single' ? [warning('a')] : [warning('b'), warning('a')] })
  })
  it('matches each multi member; additions active, removal and later readdition are distinct', () => {
    const baseline = document({ type: 'multi', value: ['a', 'active'] })
    const candidate = document({ type: 'multi', value: ['active', 'b', 'a'] })
    expect(inspect(candidate, baseline)).toMatchObject({ issues: [{ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'b' }], warnings: [warning('a')] })
    const removed = document({ type: 'multi', value: ['active'] })
    expect(inspect(removed, baseline).warnings).toEqual([])
    expect(inspect(baseline, removed).issues).toEqual([{ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'a' }])
  })
  it.each(['unknown', 'not_applicable', 'omitted'] as const)('%s baseline does not conserve known choices', state => {
    const baseline = document(); baseline.values = state === 'omitted' ? [] : [{ code: '__proto__', owner: 'sellable', variantId: 'v', state, evidence: null }]
    expect(inspect(document(), baseline).issues).toHaveLength(2)
    expect(inspect(baseline).warnings).toEqual([]); expect(inspect(baseline).issues).toEqual([])
  })
  it.each(['family', 'definition', 'subject', 'owner', 'type', 'option'] as const)('blocks %s transfers', axis => {
    const baseline = document(); const candidate = document(); const vocab = vocabulary()
    if (axis === 'family' || axis === 'owner') {
      const family = structuredClone(vocab.families[0]!); family.id = 'other-family'; family.code = 'other'
      if (axis === 'owner') { family.bindings[0]!.owner = 'product'; candidate.values[0]!.owner = 'product'; candidate.values[0]!.variantId = null }
      vocab.families.push(family); candidate.familyCode = 'other'
    } else if (axis === 'definition') {
      vocab.definitions.push({ ...structuredClone(vocab.definitions[0]!), id: 'other-definition', code: 'other' })
      vocab.families[0]!.bindings.push({ ...vocab.families[0]!.bindings[0]!, definitionId: 'other-definition', definitionCode: 'other' })
      candidate.values[0]!.code = 'other'
    } else if (axis === 'subject') candidate.values[0]!.variantId = 'null'
    else if (axis === 'type') baseline.values[0] = { ...baseline.values[0]!, state: 'known', payload: { type: 'single', value: 'a' }, evidence }
    else baseline.values[0] = { ...baseline.values[0]!, state: 'known', payload: { type: 'multi', value: ['active'] }, evidence }
    expect(inspect(candidate, baseline, vocab).issues).toHaveLength(2)
    expect(inspect(candidate, baseline, vocab).warnings).toEqual([])
  })
  it.each(['A', ' a', 'a ', 'group', 'alias'])('does not expand/normalize %j', value => {
    const result = inspect(document({ type: 'multi', value: [value] }))
    expect(result.issues).toEqual([{ code: 'OPTION_UNKNOWN', valueIndex: 0 }]); expect(result.warnings).toEqual([])
  })
  it('keeps whitespace/case/special identities and collision-safe tuples distinct', () => {
    const baseline = document({ type: 'multi', value: [' A ', '__proto__', 'a|b'] })
    const candidate = document({ type: 'multi', value: ['a|b', '__proto__', ' A ', 'a'] })
    expect(inspect(candidate, baseline).warnings).toEqual([warning('a|b'), warning('__proto__'), warning(' A ')])
    expect(inspect(candidate, baseline).issues).toEqual([{ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'a' }])
    const vocab = vocabulary(); vocab.definitions[0]!.id = 'd|sellable|v'; vocab.families[0]!.bindings[0]!.definitionId = 'd|sellable|v'
    const ctx = { variants: [] }; const nullDoc = document(); nullDoc.values[0]!.variantId = null
    expect(inspect(nullDoc, nullDoc, vocab, ctx).warnings).toHaveLength(2)
    expect(inspect(document(), nullDoc, vocab).warnings).toEqual([])
  })
  it('cannot collide nullable subjects or separator-bearing subject/option tuples', () => {
    const vocab = vocabulary(); const definition = vocab.definitions[0]!
    if (definition.type !== 'multi') throw new Error('fixture')
    definition.options.push({ code: 'v|a', label: 'Same label', archived: true, sortOrder: 0 })
    const ctx = { variants: [{ id: 'x', name: 'X' }, { id: 'x|v', name: 'XV' }] }
    const baseline = document({ type: 'multi', value: ['v|a'] }); baseline.values[0]!.variantId = 'x'
    const candidate = document({ type: 'multi', value: ['a'] }); candidate.values[0]!.variantId = 'x|v'
    expect(inspect(candidate, baseline, vocab, ctx).issues).toEqual([{ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'a' }])
    const nullBaseline = document(); nullBaseline.values[0]!.variantId = null
    expect(inspect(document(), nullBaseline, vocab).warnings).toEqual([])
  })
  it.each([NaN, Infinity, 'wrong'])('unrelated primitive number %j invalidates whole baseline, not corrected candidate', value => {
    const baseline = { ...document(), values: [...document().values, { code: 'n', owner: 'product', variantId: null,
      state: 'known', payload: { type: 'number', value, unit: null }, evidence: null }] }
    expect(qualifyEditorialConservationBaseline(baseline, vocabulary(), context)).toBeNull()
    expect(inspect(document(), baseline).issues).toHaveLength(2)
    const active = document({ type: 'multi', value: ['active'] })
    expect(inspect(active, baseline).issues).toEqual([])
    expect(inspect(baseline).issues).toEqual([{ code: 'STRUCTURE' }]); expect(inspect(baseline).warnings).toEqual([])
  })
  it('known same-label alternatives do not authorize an archived single choice', () => {
    expect(inspect(document({ type: 'single', value: 'b' }), document({ type: 'single', value: 'a' }), vocabulary('single')))
      .toMatchObject({ issues: [{ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'b' }], warnings: [] })
  })
  it('requires explicit Draft/save versus current Published/publish baseline; null Published is empty', () => {
    const draft = document(); const published = document({ type: 'multi', value: ['active'] })
    expect(inspect(draft, draft).issues).toEqual([])
    expect(inspect(draft, published).issues).toHaveLength(2)
    expect(inspect(draft, null).issues).toHaveLength(2)
    const empty = { ...document(), values: [], familyCode: null }
    expect(inspect(empty, null)).toEqual({ document: empty, issues: [], warnings: [] })
  })
  it('reports unconserved options in candidate order and imposes no media sequence/ownership rule', () => {
    const candidate = document({ type: 'multi', value: ['b', 'a'] })
    candidate.values.push({ ...candidate.values[0]!, variantId: 'null' }); candidate.mediaRefs = ['new-private-identity', 'other']
    const baseline = document(); baseline.values = []; baseline.mediaRefs = ['other', 'old']
    expect(inspect(candidate, baseline).issues).toEqual(['v', 'null'].flatMap((_id, valueIndex) => ['b', 'a'].map(optionCode => ({
      code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex, optionCode,
    }))))
    expect(inspect(candidate, { ...candidate, mediaRefs: ['different'] }).issues).toEqual([])
  })
  it('uses current IDs and candidate value/option order, not metadata order, without mutation', () => {
    const doc = document({ type: 'multi', value: ['b', 'a'] }); doc.values.push({ ...doc.values[0]!, variantId: 'null' })
    const vocab = vocabulary(); vocab.definitions[0]!.id = 'replacement'; vocab.families[0]!.bindings[0]!.definitionId = 'replacement'
    if (vocab.definitions[0]!.type === 'multi') vocab.definitions[0]!.options.reverse()
    const before = JSON.stringify({ doc, vocab, context }); freeze(doc); freeze(vocab); freeze(context)
    const result = inspect(doc, doc, vocab)
    expect(result.warnings).toEqual(['v', 'null'].flatMap(id => ['b', 'a'].map(code => ({ ...warning(code, id), definitionId: 'replacement' }))))
    expect(result.document).not.toBe(doc); expect(result.issues).toEqual([])
    expect(JSON.stringify({ doc, vocab, context })).toBe(before)
    expect(Object.keys(result).sort()).toEqual(['document', 'issues', 'warnings'])
  })
})
