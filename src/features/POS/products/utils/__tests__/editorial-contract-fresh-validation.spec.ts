import { describe, expect, it } from 'vitest'
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import type { EditorialDefinition, EditorialNumericPolicy } from '../../interfaces/editorial-contract-definition.types'
import type { EditorialValue, EditorialKnownPayload } from '../../interfaces/editorial-contract-value.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialBasicAdmission } from '../editorial-contract-fresh-validation'

const pending: EditorialNumericPolicy = { status: 'pending' }
const resolved = (patch = {}): EditorialNumericPolicy => ({
  status: 'resolved', magnitude: 'custom', integer: false,
  lower: null, lowerInclusive: false, upper: null, upperInclusive: false, ...patch,
})
function definition(type: EditorialKnownPayload['type'] = 'text', policy = pending): EditorialDefinition {
  const base = { id: 'id', code: '__proto__', label: 'Definition' }
  if (type === 'number' || type === 'range') return {
    ...base, type, units: [{ code: 'u', label: 'Unit', sortOrder: 0 },
      ...(type === 'number' ? [{ code: null, label: null, sortOrder: 1 }] : [])], numericPolicy: policy,
  }
  if (type === 'single' || type === 'multi') return {
    ...base, type, options: ['a', 'constructor'].map(code => ({ code, label: code, archived: true, sortOrder: 0 })),
    groups: [{ code: 'group', label: 'Group', optionCodes: ['a'] }], aliases: [{ label: 'alias', optionCode: 'a' }],
  }
  return { ...base, type }
}
function vocabulary(def = definition(), owner: 'product' | 'sellable' = 'sellable'): EditorialContractVocabulary {
  return { semanticsVersion: 'editorial-production-1', definitions: [def], families: [{
    id: 'family-id', code: 'constructor', label: 'Family', bindings: [{
      definitionId: def.id, definitionCode: def.code, owner, sortOrder: 0,
      exposure: 'INTERNAL', searchable: false, publicationCheck: 'when_asserted', policy: { route: 'pending' },
    }],
  }] }
}
const value = (payload: EditorialKnownPayload = { type: 'text', value: '' }): Extract<EditorialValue, { state: 'known' }> => ({
  code: '__proto__', owner: 'sellable', variantId: 'constructor', state: 'known', payload, evidence: null,
})
const document = (values: EditorialValue[] = []): EditorialContractDocument => ({
  schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [], familyCode: 'constructor', values, facts: [],
})
const context = { variants: [{ id: 'constructor', name: 'Variant' }, { id: 'other', name: 'Other' }] }
function inspect(doc: unknown, vocab = vocabulary(), ctx = context) {
  return inspectEditorialBasicAdmission({ document: doc, vocabulary: vocab, context: ctx })
}
const root = (code: string) => ({ code })
const at = (code: string, valueIndex = 0) => ({ code, valueIndex })

// Codes are stable, deterministic partial diagnostics, never a permission verdict.
describe('S21 basic admission only', () => {
  it.each([null, {}, { ...document(), extra: true }])('rejects unreadable document %j', raw => {
    expect(inspect(raw)).toEqual({ document: null, issues: [root('STRUCTURE')] })
  })
  it('preserves detached decoded order and never mutates inputs', () => {
    const doc = document([value(), { ...value(), variantId: 'other' }])
    doc.mediaRefs = ['z', 'a']; doc.commercialTitle = '  title  '
    const vocab = vocabulary(); const before = structuredClone({ doc, vocab, context })
    const result = inspect(doc, vocab)
    expect(result).toEqual({ document: doc, issues: [] })
    expect(result.document).not.toBe(doc)
    expect(result.document!.values[0]).not.toBe(doc.values[0])
    expect({ doc, vocab, context }).toEqual(before)
    result.document!.mediaRefs.push('new')
    expect(doc.mediaRefs).toEqual(['z', 'a'])
    expect(Object.keys(result).sort()).toEqual(['document', 'issues'])
  })
  it.each([
    ['commercialTitle', 200, 'TITLE_LIMIT'], ['description', 20000, 'DESCRIPTION_LIMIT'],
  ] as const)('%s counts scalar code points', (key, cap, code) => {
    expect(inspect({ ...document(), [key]: '😀'.repeat(cap) }).issues).toEqual([])
    expect(inspect({ ...document(), [key]: '😀'.repeat(cap + 1) }).issues).toEqual([root(code)])
  })
  it.each([['mediaRefs', 20, 'MEDIA_LIMIT'], ['values', 200, 'VALUES_LIMIT'], ['facts', 200, 'FACTS_LIMIT']] as const)(
    '%s exact cap', (key, cap, code) => {
      const make = (n: number) => Array.from({ length: n }, (_, i) => key === 'mediaRefs' ? String(i)
        : key === 'facts' ? { variantId: 'not-context', presentation: '', declarations: [], careReview: null }
          : { ...value(), code: String(i) })
      expect(inspect({ ...document(), [key]: make(cap) }).issues).not.toContainEqual(root(code))
      expect(inspect({ ...document(), [key]: make(cap + 1) }).issues).toContainEqual(root(code))
    },
  )
  it('checks root duplicates and null-family collections without media ownership or fresh facts', () => {
    expect(inspect({ ...document(), familyCode: null }).issues).toEqual([])
    expect(inspect({ ...document([value()]), familyCode: null, mediaRefs: ['url', 'url'], facts: [
      { variantId: 'missing', presentation: '', declarations: [], careReview: null },
    ] }).issues).toEqual([root('MEDIA_DUPLICATE'), root('FAMILY_NULL_CONTENT')])
    expect(inspect({ ...document(), mediaRefs: ['https://not-owned'], facts: [
      { variantId: 'missing', presentation: '', declarations: [], careReview: null },
    ] }).issues).toEqual([])
  })
  it('requires exact family, binding and owner identities', () => {
    expect(inspect({ ...document(), familyCode: ' constructor' }).issues).toEqual([root('FAMILY_UNKNOWN')])
    expect(inspect(document([{ ...value(), code: 'missing' }])).issues).toEqual([at('BINDING_UNKNOWN')])
    expect(inspect(document([value()]), vocabulary(definition(), 'product')).issues).toEqual([at('OWNER_MISMATCH')])
    expect(inspect(document([value({ type: 'boolean', value: false })])).issues).toEqual([at('PAYLOAD_TYPE')])
  })
  it('requires product-null and actual sellable context, not names or defaults', () => {
    expect(inspect(document([{ ...value(), owner: 'product', variantId: null }]), vocabulary(definition(), 'product')).issues).toEqual([])
    expect(inspect(document([{ ...value(), owner: 'product' }]), vocabulary(definition(), 'product')).issues).toEqual([at('SUBJECT')])
    for (const variantId of [null, 'Variant', ' constructor']) {
      expect(inspect(document([{ ...value(), variantId }])).issues).toEqual([at('SUBJECT')])
    }
    expect(inspect(document([{ ...value(), variantId: null }]), vocabulary(), { variants: [] }).issues).toEqual([])
    expect(inspect(document([value()]), vocabulary(), { variants: [] }).issues).toEqual([at('SUBJECT')])
    expect(inspect(document([{ ...value(), variantId: null }])).issues).toEqual([at('SUBJECT')])
  })
  it('uses unique [code,variantId] even across owners, without conflating variants', () => {
    expect(inspect(document([value(), { ...value(), variantId: 'other' }])).issues).toEqual([])
    expect(inspect(document([value(), { ...value(), owner: 'product' }])).issues).toEqual([
      at('DUPLICATE_VALUE', 1), at('OWNER_MISMATCH', 1), at('SUBJECT', 1),
    ])
  })
  it.each(['unknown', 'not_applicable'] as const)('%s has no payload check but retains references', state => {
    const v: EditorialValue = { code: '__proto__', owner: 'sellable', variantId: 'constructor', state, evidence: null }
    expect(inspect(document([v]), vocabulary(definition('number'))).issues).toEqual([])
    expect(inspect(document([{ ...v, code: 'missing', variantId: 'missing' }])).issues).toEqual([at('BINDING_UNKNOWN'), at('SUBJECT')])
  })
  it.each<EditorialKnownPayload>([{ type: 'text', value: '' }, { type: 'boolean', value: false },
    { type: 'multi', value: [] }])('keeps explicit empty/false %j', payload => {
    expect(inspect(document([value(payload)]), vocabulary(definition(payload.type))).issues).toEqual([])
  })
  it('allows unlimited text and prose controls, not evidence controls', () => {
    expect(inspect(document([value({ type: 'text', value: '\u0000' + 'x'.repeat(20001) })])).issues).toEqual([])
  })
  it.each(['single', 'multi'] as const)('%s exact options only; archive is not conservation permission', type => {
    for (const option of ['a', 'constructor', 'group', 'alias', ' a']) {
      const payload: EditorialKnownPayload = type === 'single' ? { type, value: option } : { type, value: [option] }
      expect(inspect(document([value(payload)]), vocabulary(definition(type))).issues).toEqual(
        ['a', 'constructor'].includes(option) ? [] : [at('OPTION_UNKNOWN')])
    }
    if (type === 'multi') expect(inspect(document([value({ type, value: ['a', 'a'] })]), vocabulary(definition(type))).issues).toEqual([at('MULTI_DUPLICATE')])
  })
  it.each([null, 'u', ' u', 'missing'])('number exact nullable unit %j', unit => {
    expect(inspect(document([value({ type: 'number', value: -1.5, unit })]), vocabulary(definition('number'))).issues).toEqual(
      unit === null || unit === 'u' ? [] : [at('UNIT_UNKNOWN')])
  })
  it.each([
    { type: 'number', value: '1', unit: null }, { type: 'number', value: NaN, unit: null },
    { type: 'number', value: Infinity, unit: null }, { type: 'range', min: 0, max: -Infinity, unit: 'u' },
    { type: 'range', min: 0, max: 1, unit: null },
  ])('decoder rejects malformed numeric %j', payload => {
    expect(inspect(document([{ ...value(), payload } as EditorialValue]))).toEqual({ document: null, issues: [root('STRUCTURE')] })
  })
  it.each([
    [2, 1, 'u', ['RANGE_ORDER']], [1, 1, 'u', []], [-2.5, -1, 'u', []],
    [2, 1, 'bad', ['UNIT_UNKNOWN', 'RANGE_ORDER']],
  ] as const)('pending range %s..%s unit %s', (min, max, unit, codes) => {
    expect(inspect(document([value({ type: 'range', min, max, unit })]), vocabulary(definition('range'))).issues).toEqual(codes.map(code => at(code)))
  })
  it.each([
    [resolved(), -20.5, []], [resolved({ integer: true }), 1.5, ['NUMERIC_INTEGER']],
    [resolved({ lower: -2, lowerInclusive: true }), -2, []],
    [resolved({ lower: -2, lowerInclusive: false }), -2, ['NUMERIC_BOUNDS']],
    [resolved({ upper: 2, upperInclusive: true }), 2, []],
    [resolved({ upper: 2, upperInclusive: false }), 2, ['NUMERIC_BOUNDS']],
    [resolved({ lower: 1, lowerInclusive: true, upper: 1, upperInclusive: true }), 1, []],
    [resolved({ lower: 0, lowerInclusive: true }), -1, ['NUMERIC_BOUNDS']],
  ] as const)('resolved policy applies to scalar and each endpoint %#', (policy, n, codes) => {
    for (const payload of [{ type: 'number', value: n, unit: 'u' },
      { type: 'range', min: n, max: n, unit: 'u' }] as EditorialKnownPayload[]) {
      expect(inspect(document([value(payload)]), vocabulary(definition(payload.type, policy))).issues).toEqual(codes.map(code => at(code)))
    }
  })
  it('checks both range endpoints, integer and bounds independently', () => {
    const policy = resolved({ integer: true, lower: 0, lowerInclusive: true, upper: 2, upperInclusive: false })
    for (const [min, max] of [[-1, 1], [1, 2], [0.5, 1], [0, 1.5]]) {
      const code = Number.isInteger(min) && Number.isInteger(max) ? 'NUMERIC_BOUNDS' : 'NUMERIC_INTEGER'
      expect(inspect(document([value({ type: 'range', min: min!, max: max!, unit: 'u' })]), vocabulary(definition('range', policy))).issues).toEqual([at(code)])
    }
  })
  it('does not execute submitted getters', () => {
    let reads = 0
    const doc = document()
    Object.defineProperty(doc, 'values', { enumerable: true, get() { reads++; return [] } })
    expect(inspect(doc)).toEqual({ document: null, issues: [root('STRUCTURE')] })
    expect(reads).toBe(0)
  })
  it('empty issues for NA or archived options are only basic checks, never permission', () => {
    const na: EditorialValue = { code: '__proto__', owner: 'sellable', variantId: 'constructor',
      state: 'not_applicable', evidence: null }
    for (const v of [na, value({ type: 'single', value: 'a' })]) {
      const result = inspect(document([v]), vocabulary(definition('single')))
      expect(result.issues).toEqual([])
      expect(result.document!.values).toEqual([v])
      expect(Object.keys(result).sort()).toEqual(['document', 'issues'])
      // No selected-NA decision or previous archived baseline was supplied.
      // Passing this inspector cannot establish either permission.
    }
  })
  it('continues numeric checks after bad evidence and reports evidence with missing family', () => {
    const v = { ...value({ type: 'range', min: 2.5, max: -1, unit: 'bad' }),
      evidence: { sourceRef: '', verifiedOn: '0000-01-01' } }
    const policy = resolved({ integer: true, lower: 0, lowerInclusive: true })
    expect(inspect(document([v]), vocabulary(definition('range', policy))).issues).toEqual([
      at('EVIDENCE'), at('UNIT_UNKNOWN'), at('RANGE_ORDER'), at('NUMERIC_INTEGER'), at('NUMERIC_BOUNDS'),
    ])
    expect(inspect({ ...document([v]), familyCode: null }).issues).toEqual([
      root('FAMILY_NULL_CONTENT'), at('EVIDENCE'),
    ])
  })
  it('reports all independent checks even when evidence is bad', () => {
    const v = { ...value({ type: 'multi', value: ['bad', 'bad'] }),
      evidence: { sourceRef: ' ', verifiedOn: '2024-02-30' } }
    expect(inspect(document([v]), vocabulary(definition('multi'))).issues).toEqual([
      at('EVIDENCE'), at('MULTI_DUPLICATE'), at('OPTION_UNKNOWN'),
    ])
    expect(inspect(document([{ ...v, code: 'missing', variantId: 'missing' }])).issues).toEqual([
      at('EVIDENCE'), at('BINDING_UNKNOWN'), at('SUBJECT'),
    ])
    expect(inspect(document([{ ...value(), evidence: { sourceRef: 'source', verifiedOn: '9999-12-31' } }])).issues).toEqual([])
  })
})
