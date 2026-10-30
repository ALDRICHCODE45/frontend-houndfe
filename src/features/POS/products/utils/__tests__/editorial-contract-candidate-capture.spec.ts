import { describe, expect, it } from 'vitest'
import type { EditorialContractDocument, EditorialSellableFacts } from '../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialCandidateCapture } from '../editorial-contract-candidate-capture'

function document(): EditorialContractDocument {
  return { schemaVersion: 2, commercialTitle: null, description: null, mediaRefs: [], familyCode: 'care', values: [], facts: [] }
}
function vocabulary(): EditorialContractVocabulary {
  return { semanticsVersion: 'editorial-production-1',
    definitions: [{ id: 'd', code: 'choice', label: 'Choice', type: 'single', options: [
      { code: 'old', label: 'Old', archived: true, sortOrder: 0 },
      { code: 'new', label: 'New', archived: false, sortOrder: 1 },
    ], groups: [], aliases: [] }],
    families: [{ id: 'f', code: 'care', label: 'Care', bindings: [{
      definitionId: 'd', definitionCode: 'choice', owner: 'sellable', sortOrder: 0, exposure: 'INTERNAL',
      searchable: false, publicationCheck: 'always', policy: { route: 'pending' },
    }] }] }
}
const context = { variants: [] }
function selected(option = 'old') {
  const doc = document()
  doc.values = [{ code: 'choice', owner: 'sellable', variantId: null, state: 'known',
    payload: { type: 'single', value: option }, evidence: null }]
  return doc
}
function row(): EditorialSellableFacts {
  return { variantId: null, presentation: 'Presentation', declarations: [], careReview: { state: 'unknown' } }
}
const inspect = (doc: unknown, storedDraft: unknown = null, vocab = vocabulary()) =>
  inspectEditorialCandidateCapture({ document: doc, storedDraft, vocabulary: vocab, context })
const warning = { code: 'ARCHIVED_OPTION', familyId: 'f', definitionId: 'd', owner: 'sellable', variantId: null, optionCode: 'old' }

describe('S31 stage-separated candidate capture, never save/publication authority', () => {
  it('retains an incomplete draft and exposes no overall permission boolean', () => {
    const doc = document()
    expect(inspect(doc)).toEqual({ document: doc, basicIssues: [], factsCapture: 'valid', referenceConservationIssues: [], warnings: [] })
  })
  it('structural failure skips downstream stages and baseline access', () => {
    let calls = 0
    const baseline = { get schemaVersion() { calls++; return 2 } }
    expect(inspect({ schemaVersion: 1 }, baseline)).toEqual({
      document: null, basicIssues: [{ code: 'STRUCTURE' }], factsCapture: 'not_checked', referenceConservationIssues: null, warnings: [],
    })
    expect(calls).toBe(0)
    const raw = { ...document(), get commercialTitle() { calls++; return null } }
    expect(inspect(raw).basicIssues).toEqual([{ code: 'STRUCTURE' }]); expect(calls).toBe(0)
  })
  it('reports facts capture only as an aggregate, not a fabricated row diagnostic', () => {
    const doc = document(); doc.facts = [{ ...row(), presentation: '' }]
    expect(inspect(doc)).toEqual({ document: doc, basicIssues: [], factsCapture: 'invalid', referenceConservationIssues: [], warnings: [] })
  })
  it('checks capture for care but preserves unknown and unresolved draft reviews', () => {
    const doc = document(); doc.facts = [row()]
    expect(inspect(doc).factsCapture).toBe('valid')
    doc.facts[0]!.careReview = { state: 'prepared', jurisdiction: 'Local', intendedUse: 'Use', determination: 'identified',
      evidence: [], basis: 'Basis', requirements: [{ key: 'r', description: 'Requirement', disposition: 'unresolved', evidence: [], basis: 'Pending' }], warnings: [] }
    expect(inspect(doc).factsCapture).toBe('valid')
    doc.facts[0]!.careReview.jurisdiction = ''
    expect(inspect(doc).factsCapture).toBe('invalid')
  })
  it('keeps full-reference diagnostics distinct from capture validity', () => {
    const doc = document(); doc.facts = [{ ...row(), variantId: 'orphan' }]
    const result = inspect(doc)
    expect(result.basicIssues).toEqual([]); expect(result.factsCapture).toBe('valid')
    expect(result.referenceConservationIssues).toEqual([{ code: 'subject', rowIndex: 0 }])
    expect(result.warnings).toEqual([])
  })
  it('keeps shared reference findings in their own stages without flattening or duplicate passes', () => {
    const doc = selected('missing')
    const result = inspect(doc)
    expect(result.basicIssues).toEqual([{ code: 'OPTION_UNKNOWN', valueIndex: 0 }])
    expect(result.referenceConservationIssues).toEqual([{ code: 'OPTION_UNKNOWN', valueIndex: 0 }])
    expect(result.factsCapture).toBe('valid'); expect(result.warnings).toEqual([])
  })
  it('preserves basic issue order and conservation warnings despite unrelated fresh failures', () => {
    const baseline = selected(); const doc = selected()
    doc.commercialTitle = 'x'.repeat(201); doc.description = 'x'.repeat(20001)
    doc.values[0]!.evidence = { sourceRef: '', verifiedOn: 'bad' }
    doc.facts = [{ ...row(), presentation: '' }]
    const result = inspect(doc, baseline)
    expect(result.basicIssues).toEqual([{ code: 'TITLE_LIMIT' }, { code: 'DESCRIPTION_LIMIT' }, { code: 'EVIDENCE', valueIndex: 0 }])
    expect(result.factsCapture).toBe('invalid'); expect(result.referenceConservationIssues).toEqual([])
    expect(result.warnings).toEqual([warning])
  })
  it('never feeds historical baseline through fresh validation', () => {
    const baseline = selected(); baseline.commercialTitle = 'x'.repeat(201)
    baseline.values[0]!.evidence = { sourceRef: '', verifiedOn: 'not a date' }
    baseline.facts = [{ ...row(), presentation: '' }]
    expect(inspect(selected(), baseline)).toMatchObject({
      basicIssues: [], factsCapture: 'valid', referenceConservationIssues: [], warnings: [warning],
    })
  })
  it('uses stored Draft explicitly; invalid history grants none without blocking corrected active candidates', () => {
    const baseline = selected(); baseline.facts = [{ ...row(), variantId: 'orphan' }]
    expect(inspect(selected(), baseline).referenceConservationIssues).toEqual([
      { code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'old' },
    ])
    expect(inspect(selected('new'), baseline)).toMatchObject({ basicIssues: [], factsCapture: 'valid', referenceConservationIssues: [], warnings: [] })
    expect(inspect(selected(), null).warnings).toEqual([])
    expect(inspect(selected(), selected()).warnings).toEqual([warning])
  })
  it('allows pending numeric draft capture and leaves selected NA unevaluated', () => {
    const vocab = vocabulary()
    vocab.definitions.push({ id: 'n', code: 'n', label: 'Number', type: 'number', units: [{ code: null, label: null, sortOrder: 0 }], numericPolicy: { status: 'pending' } })
    vocab.families[0]!.bindings.push({ ...vocab.families[0]!.bindings[0]!, definitionId: 'n', definitionCode: 'n' })
    const doc = document(); doc.values = [
      { code: 'choice', owner: 'sellable', variantId: null, state: 'not_applicable', evidence: null },
      { code: 'n', owner: 'sellable', variantId: null, state: 'known', payload: { type: 'number', value: -2.5, unit: null }, evidence: null },
    ]
    expect(inspect(doc, null, vocab)).toEqual({ document: doc, basicIssues: [], factsCapture: 'valid', referenceConservationIssues: [], warnings: [] })
  })
  it('preserves raw inputs and returns a detached candidate', () => {
    const doc = selected(); const baseline = selected(); const vocab = vocabulary()
    const before = JSON.stringify({ doc, baseline, vocab })
    function freeze(value: unknown): void {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value) }
    }
    freeze(doc); freeze(baseline); freeze(vocab)
    const result = inspect(doc, baseline, vocab)
    expect(result.document).toEqual(doc); expect(result.document).not.toBe(doc)
    result.document!.mediaRefs.push('local'); result.warnings[0]!.optionCode = 'changed'
    expect(JSON.stringify({ doc, baseline, vocab })).toBe(before)
  })
})
