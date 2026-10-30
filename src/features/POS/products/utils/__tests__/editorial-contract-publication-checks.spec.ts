import { describe, expect, it } from 'vitest'
import { inspectEditorialPublicationContent, inspectEditorialRuntimeCandidate } from '../editorial-contract-publication-checks'
import { careDocument, careVocabulary, document, vocabulary } from '../../__tests__/editorial-contract-fixtures'
import type { EditorialContractDocument } from '../../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../../interfaces/editorial-contract-vocabulary.types'
const context = { variants: [] }
const choiceVocabulary = (): EditorialContractVocabulary => ({ ...vocabulary(), families: [{ id: 'f', code: 'f', label: 'Familia', bindings: [
  { definitionId: 'd', definitionCode: 'choice', owner: 'product', sortOrder: 0, exposure: 'DETAIL', searchable: false, publicationCheck: 'always',
    policy: { route: 'option_cases', cases: [{ code: 'all', when: [], applicability: 'applicable', required: false, allowNA: false, evidenceRequired: false, documentary: 'resolved' }] } },
] }], definitions: [{ id: 'd', code: 'choice', label: 'Elección', type: 'single', groups: [], aliases: [], options: [{ code: 'old', label: 'Anterior', archived: true, sortOrder: 0 }] }] })
const chosen = (): EditorialContractDocument => ({ ...document(), familyCode: 'f', values: [{ code: 'choice', owner: 'product', variantId: null, state: 'known', payload: { type: 'single', value: 'old' }, evidence: null }] })

describe('supplied-content publication boundary, never inferred E', () => {
  it('uses stored Draft on save and current Published on publish for archive conservation', () => {
    const doc = chosen(), vocab = choiceVocabulary()
    expect(inspectEditorialRuntimeCandidate(doc, doc, vocab, context)).toEqual([])
    expect(inspectEditorialPublicationContent(doc, null, vocab, context)).toContainEqual({ code: 'ARCHIVED_OPTION_NOT_CONSERVED', valueIndex: 0, optionCode: 'old' })
    expect(inspectEditorialPublicationContent(doc, doc, vocab, context)).toEqual([])
  })
  it('checks explicit NA but does not turn all always bindings into per-variant requirements', () => {
    const vocab = choiceVocabulary()
    const doc = { ...chosen(), values: [{ code: 'choice', owner: 'product' as const, variantId: null, state: 'not_applicable' as const, evidence: null }] }
    expect(inspectEditorialRuntimeCandidate(doc, null, vocab, context)).toContainEqual({ code: 'NA_NOT_ALLOWED', valueIndex: 0 })
    expect(inspectEditorialPublicationContent({ ...doc, values: [] }, null, vocab, { variants: [{ id: 'v', name: 'Only current identity' }] })).toEqual([])
  })
  it('permits incomplete inactive-or-offered care rows without guessing eligibility but rejects malformed supplied evidence/capture/references', () => {
    const doc = careDocument(), vocab = careVocabulary()
    expect(inspectEditorialPublicationContent(doc, null, vocab, context)).toEqual([])
    doc.facts[0]!.careReview = { state: 'prepared', jurisdiction: 'J', intendedUse: 'U', determination: 'identified', basis: 'B', evidence: [{ sourceRef: '', verifiedOn: 'bad' }], requirements: [], warnings: [] }
    expect(inspectEditorialPublicationContent(doc, null, vocab, context)).toContainEqual({ code: 'FACTS_CAPTURE' })
    doc.facts[0]!.careReview = { state: 'unknown' }; doc.facts.push({ ...doc.facts[0]! })
    expect(inspectEditorialPublicationContent(doc, null, vocab, context)).toContainEqual({ code: 'FACT_DUPLICATE', rowIndex: 1 })
  })
  it('keeps pending numeric draft saving separate from publication and still checks finite/order/unit domains', () => {
    const vocab = choiceVocabulary()
    vocab.definitions = [{ id: 'd', code: 'choice', label: 'Número', type: 'range', units: [{ code: 'cm', label: 'cm', sortOrder: 0 }], numericPolicy: { status: 'pending' } }]
    const doc: EditorialContractDocument = { ...document(), familyCode: 'f', values: [{ code: 'choice', owner: 'product', variantId: null, state: 'known', payload: { type: 'range', min: 1, max: 2, unit: 'cm' }, evidence: null }] }
    expect(inspectEditorialRuntimeCandidate(doc, null, vocab, context)).toEqual([])
    expect(inspectEditorialPublicationContent(doc, null, vocab, context)).toContainEqual({ code: 'NUMERIC_POLICY_PENDING', valueIndex: 0 })
    const range = doc.values[0]!
    if (range.state === 'known' && range.payload.type === 'range') range.payload.min = 3
    expect(inspectEditorialRuntimeCandidate(doc, null, vocab, context)).toContainEqual({ code: 'RANGE_ORDER', valueIndex: 0 })
  })
  it('requires nonblank title and empty media independently of server per-E completeness', () => {
    const doc = { ...document(), commercialTitle: ' \n ', mediaRefs: ['private'] }
    expect(inspectEditorialPublicationContent(doc, null, vocabulary(), context)).toEqual([{ code: 'title' }, { code: 'media' }])
  })
})
