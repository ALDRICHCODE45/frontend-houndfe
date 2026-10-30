import { describe, expect, it } from 'vitest'
import type { EditorialContractDocument, EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import type { EditorialKnownPayload } from '../../interfaces/editorial-contract-value.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import { decodeEditorialContractDocument } from '../editorial-contract-document'
import { inspectEditorialDocumentReferences } from '../editorial-contract-document-references'
import { inspectEditorialBasicAdmission } from '../editorial-contract-fresh-validation'

const evidence = { sourceRef: '', verifiedOn: 'not a date' }
const context = { variants: [{ id: 'v', name: 'Variant' }, { id: 'other', name: 'Other' }] }
function vocabulary(type: EditorialKnownPayload['type'] = 'multi'): EditorialContractVocabulary {
  const base = { id: 'd', code: '__proto__', label: 'Definition' }
  const definition = type === 'number' || type === 'range'
    ? { ...base, type, units: [{ code: 'u', label: 'Unit', sortOrder: 0 }], numericPolicy: {
      status: 'resolved' as const, magnitude: 'custom', integer: true,
      lower: 0, lowerInclusive: true, upper: 1, upperInclusive: true,
    } }
    : type === 'single' || type === 'multi'
      ? { ...base, type, options: [{ code: 'a', label: 'A', archived: true, sortOrder: 0 }], groups: [], aliases: [] }
      : { ...base, type }
  return { semanticsVersion: 'editorial-production-1', definitions: [definition], families: [{
    id: 'f', code: 'care', label: 'Care', bindings: [{ definitionId: 'd', definitionCode: '__proto__',
      owner: 'sellable', sortOrder: 0, exposure: 'INTERNAL', searchable: false,
      publicationCheck: 'when_asserted', policy: { route: 'pending' } }],
  }] }
}
function document(payload: EditorialKnownPayload = { type: 'multi', value: ['a'] }): EditorialContractDocument {
  return { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [], familyCode: 'care',
    values: [{ code: '__proto__', variantId: 'v', owner: 'sellable', state: 'known', payload, evidence }], facts: [] }
}
const row = (): EditorialSellableFacts => ({ variantId: 'v', presentation: '', declarations: [], careReview: {
  state: 'prepared', jurisdiction: '', intendedUse: '', determination: 'none_applicable', evidence: [], basis: '',
  requirements: [{ key: 'same', description: '', disposition: 'conflicting', evidence: [], basis: '' }],
  warnings: [{ key: 'same', requirementKeys: ['same'], text: '', disclosure: 'unresolved', evidence: [], handlingBasis: '' }],
} })
const inspect = (doc = document(), vocab = vocabulary(), ctx = context) =>
  inspectEditorialDocumentReferences({ document: doc, vocabulary: vocab, context: ctx })
function freeze(value: unknown) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
}

describe('S24/S26 typed document references, not fresh admission', () => {
  it('accepts historically fresh-invalid prose/evidence/caps/numeric domains and range order', () => {
    const doc = document({ type: 'range', min: 9.5, max: -2, unit: 'u' })
    doc.commercialTitle = 'x'.repeat(201); doc.description = 'x'.repeat(20001)
    doc.mediaRefs = Array.from({ length: 201 }, (_, i) => String(i))
    doc.facts = [row()]
    expect(inspect(doc, vocabulary('range'))).toEqual([])
    expect(inspectEditorialBasicAdmission({ document: doc, vocabulary: vocabulary('range'), context }).issues.length).toBeGreaterThan(0)
  })
  it('checks every unrelated row and identity without filtering', () => {
    const doc = document(); doc.mediaRefs = ['a', 'a']; doc.values.push({ ...doc.values[0]!, variantId: 'missing' })
    doc.values.push(doc.values[0]!)
    expect(inspect(doc)).toEqual([{ code: 'MEDIA_DUPLICATE' }, { code: 'SUBJECT', valueIndex: 1 }, { code: 'DUPLICATE_VALUE', valueIndex: 2 }])
    doc.facts = [row(), { ...row(), variantId: 'missing' }, row()]
    expect(inspect(doc)).toContainEqual({ code: 'subject', rowIndex: 1 })
    expect(inspect(doc)).toContainEqual({ code: 'FACT_DUPLICATE', rowIndex: 2 })
  })
  it.each(['unknown', 'not_applicable'] as const)('%s still checks exact binding, owner and context', state => {
    const doc = document(); doc.values = [{ code: 'missing', owner: 'product', variantId: 'v', state, evidence: null }]
    expect(inspect(doc)).toEqual([{ code: 'BINDING_UNKNOWN', valueIndex: 0 }, { code: 'SUBJECT', valueIndex: 0 }])
    doc.values = [{ code: '__proto__', owner: 'product', variantId: null, state, evidence: null }]
    expect(inspect(doc)).toEqual([{ code: 'OWNER_MISMATCH', valueIndex: 0 }])
  })
  it.each([
    [{ type: 'single', value: ' a' }, 'OPTION_UNKNOWN'],
    [{ type: 'multi', value: ['a', 'a'] }, 'MULTI_DUPLICATE'],
    [{ type: 'number', value: 0, unit: ' u' }, 'UNIT_UNKNOWN'],
    [{ type: 'range', min: 0, max: 1, unit: 'bad' }, 'UNIT_UNKNOWN'],
  ] as const)('checks exact payload references %j', (payload, code) => {
    expect(inspect(document(structuredClone(payload) as EditorialKnownPayload), vocabulary(payload.type))).toEqual([{ code, valueIndex: 0 }])
  })
  it('checks payload types, family and empty-context subject semantics', () => {
    expect(inspect(document(), vocabulary('text'))).toEqual([{ code: 'PAYLOAD_TYPE', valueIndex: 0 }])
    const doc = document(); doc.familyCode = null; doc.facts = [row()]
    expect(inspect(doc)).toContainEqual({ code: 'FAMILY_NULL_CONTENT' })
    expect(inspect(doc)).toContainEqual({ code: 'family', rowIndex: 0 })
    doc.familyCode = ' care'
    expect(inspect(doc)).toContainEqual({ code: 'FAMILY_UNKNOWN' })
    doc.familyCode = 'care'; doc.facts = []; doc.values[0]!.variantId = null
    expect(inspect(doc, vocabulary(), { variants: [] })).toEqual([])
    expect(inspect(doc)).toEqual([{ code: 'SUBJECT', valueIndex: 0 }])
  })
  it('composes declaration family/binding checks and local subset/key identities', () => {
    const doc = document(); const facts = row(); doc.facts = [facts]
    facts.declarations = [
      { key: 'consumable', state: 'unknown', evidence: null },
      { key: 'relevantDimensionCodes', state: 'known', value: { codes: [], toyTypes: ['x', 'x'] }, evidence, basis: '' },
      { key: 'relevantDimensionCodes', state: 'unknown', evidence: null },
    ]
    expect(inspect(doc)).toContainEqual({ code: 'declaration_family', rowIndex: 0, declarationIndex: 0 })
    expect(inspect(doc)).toContainEqual({ code: 'toy_type', rowIndex: 0, declarationIndex: 1 })
    expect(inspect(doc)).toContainEqual({ code: 'SUBSET_DUPLICATE', rowIndex: 0, declarationIndex: 1, subset: 'toyTypes' })
    expect(inspect(doc)).toContainEqual({ code: 'DECLARATION_DUPLICATE', rowIndex: 0, declarationIndex: 2 })
  })
  it('keeps care namespaces separate; evidence pairs and warning references are local', () => {
    const doc = document(); const facts = row(); doc.facts = [facts, { ...row(), variantId: 'other' }]
    expect(inspect(doc)).toEqual([])
    const care = facts.careReview!; if (care.state !== 'prepared') throw new Error('fixture')
    care.evidence = [evidence, { ...evidence }]
    care.requirements.push(care.requirements[0]!)
    care.warnings.push({ ...care.warnings[0]!, requirementKeys: ['missing', 'missing'], evidence: [evidence, evidence] })
    expect(inspect(doc)).toEqual([
      { code: 'EVIDENCE_DUPLICATE', rowIndex: 0, careSection: 'review' },
      { code: 'REQUIREMENT_DUPLICATE', rowIndex: 0, careSection: 'requirement', careIndex: 1 },
      { code: 'WARNING_DUPLICATE', rowIndex: 0, careSection: 'warning', careIndex: 1 },
      { code: 'EVIDENCE_DUPLICATE', rowIndex: 0, careSection: 'warning', careIndex: 1 },
      { code: 'WARNING_REFERENCE_DUPLICATE', rowIndex: 0, careSection: 'warning', careIndex: 1 },
      { code: 'WARNING_REFERENCE_UNKNOWN', rowIndex: 0, careSection: 'warning', careIndex: 1 },
    ])
    care.evidence = [{ sourceRef: 'a|b', verifiedOn: 'c' }, { sourceRef: 'a', verifiedOn: 'b|c' }]
    expect(inspect(doc)).not.toContainEqual({ code: 'EVIDENCE_DUPLICATE', rowIndex: 0, careSection: 'review' })
  })
  it('has no reference-layer collection caps and no cross-row care resolution', () => {
    const doc = document(); const vocab = vocabulary()
    const ctx = { variants: Array.from({ length: 201 }, (_, i) => ({ id: String(i), name: String(i) })) }
    doc.values = ctx.variants.map(v => ({ ...doc.values[0]!, variantId: v.id }))
    doc.facts = ctx.variants.map(v => ({ ...row(), variantId: v.id }))
    expect(inspect(doc, vocab, ctx)).toEqual([])
    const care = doc.facts[0]!.careReview!
    if (care.state !== 'prepared') throw new Error('fixture')
    care.requirements = []
    expect(inspect(doc, vocab, ctx)).toEqual([
      { code: 'WARNING_REFERENCE_UNKNOWN', rowIndex: 0, careSection: 'warning', careIndex: 0 },
    ])
  })
  it.each(['relevantFitCodes', 'relevantCapacityCodes', 'relevantEquipmentCodes', 'optionalNonpertinenceCodes'] as const)(
    'detects duplicate known %s independently of family references', key => {
      const doc = document(); const facts = row(); doc.facts = [facts]
      const code = key === 'relevantFitCodes' ? 'measure.fit.neck' : key === 'relevantCapacityCodes'
        ? 'measure.capacity.container' : 'measure.equipment.power'
      // The primitive decoder establishes each key-specific finite union.
      const decoded = decodeEditorialContractDocument({ ...doc, facts: [{ ...facts, declarations: [
        { key, state: 'known', value: [code, code], evidence, basis: '' },
      ] }] })!
      expect(decoded).not.toBeNull()
      expect(inspect(decoded)).toContainEqual({ code: 'SUBSET_DUPLICATE', rowIndex: 0, declarationIndex: 0, subset: 'value' })
    },
  )
  it('detects duplicate requirement evidence and dimension codes', () => {
    const doc = document(); const facts = row(); doc.facts = [facts]
    facts.declarations = [{ key: 'relevantDimensionCodes', state: 'known',
      value: { codes: ['measure.dimensions.external_length', 'measure.dimensions.external_length'], toyTypes: [] }, evidence, basis: '' }]
    const care = facts.careReview!; if (care.state !== 'prepared') throw new Error('fixture')
    care.requirements[0]!.evidence = [evidence, evidence]
    expect(inspect(doc)).toContainEqual({ code: 'SUBSET_DUPLICATE', rowIndex: 0, declarationIndex: 0, subset: 'codes' })
    expect(inspect(doc)).toContainEqual({ code: 'EVIDENCE_DUPLICATE', rowIndex: 0, careSection: 'requirement', careIndex: 0 })
  })
  it('requires primitive decoding first rather than pretending malformed data is typed', () => {
    expect(decodeEditorialContractDocument({ ...document(), values: [{ state: 'known' }] })).toBeNull()
    expect(decodeEditorialContractDocument(document({ type: 'number', value: Infinity, unit: 'u' }))).toBeNull()
  })
  it('preserves deeply frozen document, metadata and context unchanged', () => {
    const doc = document(); doc.facts = [row()]; const vocab = vocabulary()
    const before = JSON.stringify({ doc, vocab, context }); freeze(doc); freeze(vocab); freeze(context)
    expect(inspect(doc, vocab)).toEqual([])
    expect(JSON.stringify({ doc, vocab, context })).toBe(before)
  })
})
