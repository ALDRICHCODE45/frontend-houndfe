import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { inspectEditorialFactsReferences, type EditorialFactsReferenceIssue } from './editorial-contract-facts-references'

export type EditorialDocumentReferencesInput = {
  document: EditorialContractDocument
  vocabulary: EditorialContractVocabulary
  context: EditorialContractContext
}
export type EditorialBasicReferenceIssue =
  | { code: 'MEDIA_DUPLICATE' | 'FAMILY_NULL_CONTENT' | 'FAMILY_UNKNOWN' }
  | { code: 'DUPLICATE_VALUE' | 'BINDING_UNKNOWN' | 'OWNER_MISMATCH' | 'SUBJECT' | 'PAYLOAD_TYPE'
      | 'MULTI_DUPLICATE' | 'OPTION_UNKNOWN' | 'UNIT_UNKNOWN'; valueIndex: number }
export type EditorialDocumentReferenceIssue = EditorialBasicReferenceIssue | EditorialFactsReferenceIssue
  | { code: 'FACT_DUPLICATE' | 'DECLARATION_DUPLICATE' | 'SUBSET_DUPLICATE'; rowIndex: number;
      declarationIndex?: number; subset?: 'codes' | 'toyTypes' | 'value' }
  | { code: 'REQUIREMENT_DUPLICATE' | 'WARNING_DUPLICATE' | 'EVIDENCE_DUPLICATE'
      | 'WARNING_REFERENCE_DUPLICATE' | 'WARNING_REFERENCE_UNKNOWN'; rowIndex: number;
      careSection: 'review' | 'requirement' | 'warning'; careIndex?: number }
const duplicates = (items: readonly unknown[]) => new Set(items).size !== items.length

/** Typed reference subset shared with fresh basic admission; no decoding or fresh domains. */
export function inspectEditorialBasicReferences({ document, vocabulary, context }: EditorialDocumentReferencesInput): EditorialBasicReferenceIssue[] {
  const issues: EditorialBasicReferenceIssue[] = []
  if (duplicates(document.mediaRefs)) issues.push({ code: 'MEDIA_DUPLICATE' })
  const family = vocabulary.families.find(item => item.code === document.familyCode)
  if (document.familyCode === null) {
    if (document.values.length || document.facts.length) issues.push({ code: 'FAMILY_NULL_CONTENT' })
  } else if (!family) issues.push({ code: 'FAMILY_UNKNOWN' })
  const bindings = new Map(family?.bindings.map(binding => [binding.definitionCode, binding]))
  const definitions = new Map(vocabulary.definitions.map(definition => [definition.code, definition]))
  const variantIds = new Set(context.variants.map(variant => variant.id))
  const identities = new Map<string, Set<string | null>>()
  document.values.forEach((value, valueIndex) => {
    const report = (code: Extract<EditorialBasicReferenceIssue, { valueIndex: number }>['code']) => issues.push({ code, valueIndex })
    const subjects = identities.get(value.code) ?? new Set<string | null>()
    if (subjects.has(value.variantId)) report('DUPLICATE_VALUE')
    subjects.add(value.variantId)
    identities.set(value.code, subjects)
    const binding = bindings.get(value.code)
    const definition = definitions.get(value.code)
    // Qualified metadata guarantees binding ID/code coherence. Missing family is a root issue.
    if (family && !binding) report('BINDING_UNKNOWN')
    if (binding && binding.owner !== value.owner) report('OWNER_MISMATCH')
    const subjectMatches = value.owner === 'product' ? value.variantId === null
      : variantIds.size === 0 ? value.variantId === null
        : value.variantId !== null && variantIds.has(value.variantId)
    if (!subjectMatches) report('SUBJECT')
    if (value.state !== 'known' || !binding || !definition) return
    const payload = value.payload
    if (payload.type !== definition.type) { report('PAYLOAD_TYPE'); return }
    if ((payload.type === 'single' || payload.type === 'multi')
      && (definition.type === 'single' || definition.type === 'multi')) {
      const options = new Set(definition.options.map(option => option.code))
      const selected = payload.type === 'single' ? [payload.value] : payload.value
      if (payload.type === 'multi' && duplicates(selected)) report('MULTI_DUPLICATE')
      if (selected.some(option => !options.has(option))) report('OPTION_UNKNOWN')
    }
    if ((payload.type === 'number' || payload.type === 'range')
      && (definition.type === 'number' || definition.type === 'range')
      && !definition.units.some(unit => unit.code === payload.unit)) report('UNIT_UNKNOWN')
  })
  return issues
}

/**
 * S26 reference-only prerequisite, NOT baseline qualification or save authority.
 * Inputs are primitive-decoded and metadata qualified. Order: basic references,
 * unchanged S25 diagnostics, then local identities by row/declaration/care order.
 * No fresh caps, prose/evidence admission, numeric domains or readiness checks.
 */
export function inspectEditorialDocumentReferences(input: EditorialDocumentReferencesInput): EditorialDocumentReferenceIssue[] {
  const { document, vocabulary, context } = input
  const family = vocabulary.families.find(item => item.code === document.familyCode) ?? null
  const issues: EditorialDocumentReferenceIssue[] = [
    ...inspectEditorialBasicReferences(input),
    ...inspectEditorialFactsReferences({ facts: document.facts, family, vocabulary, context }),
  ]
  const subjects = new Set<string | null>()
  document.facts.forEach((row, rowIndex) => {
    if (subjects.has(row.variantId)) issues.push({ code: 'FACT_DUPLICATE', rowIndex })
    subjects.add(row.variantId)
    const keys = new Set<string>()
    row.declarations.forEach((declaration, declarationIndex) => {
      if (keys.has(declaration.key)) issues.push({ code: 'DECLARATION_DUPLICATE', rowIndex, declarationIndex })
      keys.add(declaration.key)
      if (declaration.state !== 'known') return
      const subset = (members: readonly string[], name: 'codes' | 'toyTypes' | 'value') => {
        if (duplicates(members)) issues.push({ code: 'SUBSET_DUPLICATE', rowIndex, declarationIndex, subset: name })
      }
      if (declaration.key === 'relevantDimensionCodes') {
        subset(declaration.value.codes, 'codes'); subset(declaration.value.toyTypes, 'toyTypes')
      } else if (Array.isArray(declaration.value)) subset(declaration.value, 'value')
    })
    const care = row.careReview
    if (care?.state !== 'prepared') return
    const evidenceDuplicates = (items: typeof care.evidence) => duplicates(items.map(item => JSON.stringify([item.sourceRef, item.verifiedOn])))
    if (evidenceDuplicates(care.evidence)) issues.push({ code: 'EVIDENCE_DUPLICATE', rowIndex, careSection: 'review' })
    const requirementKeys = new Set(care.requirements.map(item => item.key))
    const requirements = new Set<string>()
    care.requirements.forEach((item, careIndex) => {
      const location = { rowIndex, careSection: 'requirement' as const, careIndex }
      if (requirements.has(item.key)) issues.push({ code: 'REQUIREMENT_DUPLICATE', ...location })
      requirements.add(item.key)
      if (evidenceDuplicates(item.evidence)) issues.push({ code: 'EVIDENCE_DUPLICATE', ...location })
    })
    const warnings = new Set<string>()
    care.warnings.forEach((item, careIndex) => {
      const location = { rowIndex, careSection: 'warning' as const, careIndex }
      if (warnings.has(item.key)) issues.push({ code: 'WARNING_DUPLICATE', ...location })
      warnings.add(item.key)
      if (evidenceDuplicates(item.evidence)) issues.push({ code: 'EVIDENCE_DUPLICATE', ...location })
      if (duplicates(item.requirementKeys)) issues.push({ code: 'WARNING_REFERENCE_DUPLICATE', ...location })
      if (item.requirementKeys.some(key => !requirementKeys.has(key))) issues.push({ code: 'WARNING_REFERENCE_UNKNOWN', ...location })
    })
  })
  return issues
}
