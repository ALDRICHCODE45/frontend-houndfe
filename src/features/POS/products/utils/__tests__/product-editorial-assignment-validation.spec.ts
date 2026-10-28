import { describe, expect, it } from 'vitest'
import type { EditorialDocument, EditorialValue, EditorialVocabulary } from '../../interfaces/product-editorial.types'
import { qualifyEditorialBaseline, validateEditorialAssignments } from '../product-editorial-assignment-validation'

const vocabulary: EditorialVocabulary = {
  families: [
    { id: 'f', code: 'family', label: 'Family', bindings: [
      { definitionId: 's', definitionCode: 'choice', owner: 'sellable', sortOrder: 0 },
      { definitionId: 'm', definitionCode: 'many', owner: 'product', sortOrder: 1 },
      { definitionId: 'n', definitionCode: 'weight', owner: 'product', sortOrder: 2 },
      { definitionId: 't', definitionCode: 'text', owner: 'product', sortOrder: 3 },
      { definitionId: 'b', definitionCode: 'bool', owner: 'product', sortOrder: 4 },
    ] },
  ],
  definitions: [
    { id: 's', code: 'choice', label: 'Choice', type: 'single', options: [
      { code: 'old', label: 'Old', archived: true, sortOrder: 0 },
      { code: 'new', label: 'New', archived: false, sortOrder: 1 },
    ] },
    { id: 'm', code: 'many', label: 'Many', type: 'multi', options: [
      { code: 'old', label: 'Old', archived: true, sortOrder: 0 },
      { code: 'other-old', label: 'Other', archived: true, sortOrder: 1 },
      { code: 'new', label: 'New', archived: false, sortOrder: 2 },
    ] },
    { id: 'n', code: 'weight', label: 'Weight', type: 'number', units: [
      { code: null, label: null, sortOrder: 0 }, { code: 'kg', label: 'kg', sortOrder: 1 },
    ] },
    { id: 't', code: 'text', label: 'Text', type: 'text' },
    { id: 'b', code: 'bool', label: 'Boolean', type: 'boolean' },
  ],
}
const context = { variants: [{ id: 'v2', name: 'Same' }, { id: 'v1', name: 'Same' }] }
const single: EditorialValue = { code: 'choice', owner: 'sellable', variantId: 'v1', type: 'single', value: 'new' }
function document(values: EditorialValue[] = []): EditorialDocument {
  return { commercialTitle: null, description: null, mediaRefs: ['private-2', 'private-1'], familyCode: 'family', values }
}
function check(doc: unknown, baseline: unknown = document(), vocab: unknown = vocabulary, ctx: unknown = context) {
  const inputs = { document: doc, persistedBaseline: baseline, vocabulary: vocab, context: ctx }
  const before = JSON.stringify(inputs)
  const result = validateEditorialAssignments(inputs)
  expect(JSON.stringify(inputs)).toBe(before)
  return result
}
function invalid(doc: unknown, baseline?: unknown, vocab?: unknown, ctx?: unknown) {
  const result = check(doc, baseline, vocab, ctx)
  expect(result.valid).toBe(false)
  expect(result.issues.length).toBeGreaterThan(0)
  expect(result.issues.length).toBeLessThanOrEqual(200)
  return result.issues
}

describe('persisted editorial baseline qualification', () => {
  it('qualifies intact history independently of every fresh-save cap', () => {
    const variants = Array.from({ length: 201 }, (_, index) => ({ id: `v-${index}`, name: `Presentación ${index}` }))
    const baseline = { ...document(variants.map(variant => ({ ...single, variantId: variant.id, value: 'old' }))),
      commercialTitle: '😀'.repeat(201), description: 'x'.repeat(100001),
      mediaRefs: Array.from({ length: 21 }, (_, index) => `private-${index}`) }
    const input = { persistedBaseline: baseline, vocabulary, context: { variants } }
    const before = JSON.stringify(input)
    expect(qualifyEditorialBaseline(input)).toEqual(baseline)
    expect(validateEditorialAssignments({ ...input, document: baseline })).toEqual({ valid: false, issues: [{ code: 'limits' }] })
    expect(JSON.stringify(input)).toBe(before)
  })

  it('cannot authorize conservation from unreadable, unknown or context-invalid history', () => {
    const archived = { ...single, value: 'old' }
    const baseline = document([archived])
    const noBinding = structuredClone(vocabulary)
    noBinding.families[0]!.bindings = []
    const noOption = structuredClone(vocabulary)
    const definition = noOption.definitions[0]!
    if (definition.type === 'single') definition.options = []
    const inputs = [
      { persistedBaseline: null, vocabulary, context },
      { persistedBaseline: { ...baseline, extra: true }, vocabulary, context },
      { persistedBaseline: baseline, vocabulary: null, context },
      { persistedBaseline: baseline, vocabulary, context: null },
      { persistedBaseline: { ...baseline, familyCode: 'unknown' }, vocabulary, context },
      { persistedBaseline: document([archived, { ...single, code: 'unknown', variantId: 'v2' }]), vocabulary, context },
      { persistedBaseline: baseline, vocabulary: noBinding, context },
      { persistedBaseline: baseline, vocabulary: noOption, context },
      { persistedBaseline: document([archived, { code: 'weight', owner: 'product', variantId: null, type: 'number', value: 1, unit: 'unknown' }]), vocabulary, context },
      { persistedBaseline: baseline, vocabulary, context: { variants: [] } },
      { persistedBaseline: document([archived, { ...single, variantId: 'orphan' }]), vocabulary, context },
    ]
    const before = JSON.stringify(inputs)
    for (const input of inputs) expect(qualifyEditorialBaseline(input)).toBeNull()
    expect(JSON.stringify(inputs)).toBe(before)
    const replacementIds = structuredClone(vocabulary)
    replacementIds.definitions[0]!.id = 'current-id'
    replacementIds.families[0]!.bindings[0]!.definitionId = 'current-id'
    expect(qualifyEditorialBaseline({ persistedBaseline: baseline, vocabulary: replacementIds, context })).toEqual(baseline)
  })
})

describe('fresh editorial assignment validation', () => {
  it('allows current bindings, all value types and explicit null units without requiring every binding', () => {
    const doc = document([single,
      { code: 'weight', owner: 'product', variantId: null, type: 'number', value: 0, unit: null },
      { code: 'text', owner: 'product', variantId: null, type: 'text', value: '' },
      { code: 'bool', owner: 'product', variantId: null, type: 'boolean', value: false },
      { code: 'many', owner: 'product', variantId: null, type: 'multi', value: ['new'] },
    ])
    expect(check(doc)).toEqual({ valid: true, issues: [] })
    expect(check(document())).toEqual({ valid: true, issues: [] })
    expect(check({ ...document(), familyCode: null })).toEqual({ valid: true, issues: [] })
  })

  it('reuses structural and fresh-save limits without changing stored history', () => {
    expect(invalid({ ...document(), unexpected: true })[0]?.code).toBe('structure')
    expect(invalid({ ...document(), commercialTitle: '😀'.repeat(201) })[0]?.code).toBe('limits')
    const oversizedBaseline = { ...document(), description: 'x'.repeat(20001) }
    expect(check(document(), oversizedBaseline).valid).toBe(true)
    invalid({ ...document([single]), familyCode: null })
    invalid(document([{ ...single, owner: 'product', variantId: 'v1' }]))
  })

  it('fails closed on unknown families, binding codes, owners, types, units and options', () => {
    invalid({ ...document(), familyCode: 'unknown' })
    const badValues: EditorialValue[] = [
      { ...single, code: 'unknown' }, { ...single, owner: 'product', variantId: null },
      { ...single, type: 'text', value: 'new' }, { ...single, value: 'unknown' },
      { code: 'many', owner: 'product', variantId: null, type: 'multi', value: ['unknown'] },
      { code: 'weight', owner: 'product', variantId: null, type: 'number', value: 2, unit: 'unknown' },
    ]
    for (const value of badValues) invalid(document([value]))
    const vocab = structuredClone(vocabulary)
    vocab.families[0]!.bindings[0]!.definitionId = 't'
    invalid(document([single]), document(), vocab)
  })

  it('qualifies sellable ownership only from actual complete membership and preserves orphan values', () => {
    expect(check(document([single])).valid).toBe(true)
    invalid(document([{ ...single, variantId: null }]))
    const orphan = { ...single, variantId: 'removed' }
    expect(invalid(document([orphan]))).toContainEqual({ code: 'variant', valueIndex: 0 })
    invalid(document([single]), document(), vocabulary, { variants: [] })
    expect(check(document([{ ...single, variantId: null }]), document(), vocabulary, { variants: [] }).valid).toBe(true)
  })

  it('conserves archived membership only in the same persisted assignment, not the local buffer', () => {
    const archived = { ...single, value: 'old' }
    const baseline = document([archived])
    expect(check(baseline, baseline).valid).toBe(true)
    invalid(baseline, document()) // introduced or re-added after persisted removal
    invalid(baseline, null)
    invalid(document([{ ...archived, variantId: 'v2' }]), baseline)
    const secondFamily = structuredClone(vocabulary)
    secondFamily.families.push({ ...secondFamily.families[0]!, id: 'f2', code: 'other' })
    invalid({ ...baseline, familyCode: 'other' }, baseline, secondFamily)
    const productVocab = structuredClone(vocabulary)
    productVocab.families[0]!.bindings[0]!.owner = 'product'
    invalid(document([{ ...archived, owner: 'product', variantId: null }]), baseline, productVocab)
    const multiVocab = structuredClone(vocabulary)
    const definition = multiVocab.definitions[0]!
    if (definition.type === 'single') definition.type = 'multi'
    invalid(document([{ ...archived, type: 'multi', value: ['old'] }]), baseline, multiVocab)
    const differentDefinition = structuredClone(vocabulary)
    differentDefinition.families[0]!.bindings[0]!.definitionId = 'replacement'
    differentDefinition.definitions[0]!.id = 'replacement'
    // S8: resolve BOTH documents by code through current vocabulary, not historical IDs.
    expect(check(baseline, baseline, differentDefinition).valid).toBe(true)
    const replacement = differentDefinition.definitions[0]!
    if (replacement.type === 'single') replacement.options = []
    invalid(baseline, baseline, differentDefinition)
  })

  it('matches each archived multi option while allowing active additions and removals', () => {
    const many: EditorialValue = { code: 'many', owner: 'product', variantId: null, type: 'multi', value: ['old'] }
    const baseline = document([many])
    expect(check(document([{ ...many, value: ['new', 'old'] }]), baseline).valid).toBe(true)
    expect(check(document([{ ...many, value: ['new'] }]), baseline).valid).toBe(true)
    invalid(document([{ ...many, value: ['other-old'] }]), baseline)
    invalid(document([{ ...many, value: ['old', 'other-old'] }]), baseline)
    invalid(baseline, document([{ ...many, value: [] }]))
  })

  it('requires the exact original media sequence, without guessing media formats', () => {
    expect(check(document()).valid).toBe(true)
    for (const mediaRefs of [[], ['private-1', 'private-2'], ['different', 'private-1']]) {
      expect(invalid({ ...document(), mediaRefs })[0]?.code).toBe('media')
    }
    invalid(document(), null)
  })

  it('uses structurally readable, context-qualified baselines without fresh caps for archived eligibility', () => {
    const archived = { ...single, value: 'old' }
    const baseline = { ...document([archived]), commercialTitle: '😀'.repeat(201) }
    expect(check(document([archived]), baseline).valid).toBe(true)
    const unresolvedBaseline = document([archived,
      { code: 'removed-code', owner: 'product', variantId: null, type: 'text', value: 'stored' },
    ])
    invalid(document([archived]), unresolvedBaseline)
    const orphanedBaseline = document([archived, { ...single, variantId: 'removed' }])
    invalid(document([archived]), orphanedBaseline)
    const unknownUnitBaseline = document([archived,
      { code: 'weight', owner: 'product', variantId: null, type: 'number', value: 1, unit: 'removed' },
    ])
    invalid(document([archived]), unknownUnitBaseline)
  })

  it('accepts explicit empty metadata arrays without requiring values or inventing labels', () => {
    const empty = { ...document(), familyCode: null }
    expect(check(empty, empty, { families: [], definitions: [] }, { variants: [] }).valid).toBe(true)
    const noBindings = structuredClone(vocabulary)
    noBindings.families[0]!.bindings = []
    expect(check(document(), document(), noBindings).valid).toBe(true)
    invalid(document([single]), document(), noBindings)
  })

  it('returns bounded original indexes even when every assignment is orphaned', () => {
    const values = Array.from({ length: 200 }, (_, index) => ({ ...single, variantId: `orphan-${index}` }))
    const issues = invalid(document(values))
    expect(issues).toHaveLength(200)
    expect(issues[199]).toEqual({ code: 'variant', valueIndex: 199 })
  })

  it('rejects malformed or unavailable metadata instead of treating it as empty authority', () => {
    for (const vocab of [null, {}, { families: [], definitions: null },
      { ...vocabulary, definitions: [{ ...vocabulary.definitions[0], options: null }] },
      { ...vocabulary, families: [{ ...vocabulary.families[0], bindings: null }] },
    ]) invalid(document(), document(), vocab)
    for (const ctx of [null, {}, { variants: null }, { variants: [{ id: 'v1' }] },
      { variants: [], hasVariants: false },
    ]) invalid(document(), document(), vocabulary, ctx)
  })
})
