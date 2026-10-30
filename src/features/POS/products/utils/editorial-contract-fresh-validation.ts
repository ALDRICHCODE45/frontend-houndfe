import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { decodeEditorialContractDocument } from './editorial-contract-document'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'

export type EditorialBasicIssue =
  | { code: 'STRUCTURE' | 'TITLE_LIMIT' | 'DESCRIPTION_LIMIT' | 'MEDIA_LIMIT' | 'VALUES_LIMIT'
      | 'FACTS_LIMIT' | 'MEDIA_DUPLICATE' | 'FAMILY_NULL_CONTENT' | 'FAMILY_UNKNOWN' }
  | { code: 'DUPLICATE_VALUE' | 'EVIDENCE' | 'BINDING_UNKNOWN' | 'OWNER_MISMATCH'
      | 'SUBJECT' | 'PAYLOAD_TYPE' | 'MULTI_DUPLICATE' | 'OPTION_UNKNOWN'
      | 'UNIT_UNKNOWN' | 'RANGE_ORDER' | 'NUMERIC_INTEGER' | 'NUMERIC_BOUNDS'; valueIndex: number }
export type EditorialBasicInput = {
  document: unknown
  vocabulary: EditorialContractVocabulary
  context: EditorialContractContext
}
type ValueIssueCode = Extract<EditorialBasicIssue, { valueIndex: number }>['code']

/**
 * Partial S21 draft inspection only. Empty issues NEVER authorize save or publish.
 * Excludes fresh facts/care references, media ownership, archived conservation,
 * selected NA/policy/evidence requiredness, publication, permissions and CAS.
 * Vocabulary/context are already qualified; stored reads/receipts must not use this.
 * Diagnostics: root checks in the order below, then ascending valueIndex; each
 * applicable code appears once per value (numeric endpoint failures aggregate).
 */
export function inspectEditorialBasicAdmission(input: EditorialBasicInput): {
  document: EditorialContractDocument | null; issues: EditorialBasicIssue[]
} {
  const document = decodeEditorialContractDocument(input.document)
  if (document === null) return { document: null, issues: [{ code: 'STRUCTURE' }] }
  const issues: EditorialBasicIssue[] = []
  if (document.commercialTitle !== null && [...document.commercialTitle].length > 200) {
    issues.push({ code: 'TITLE_LIMIT' })
  }
  if (document.description !== null && [...document.description].length > 20000) {
    issues.push({ code: 'DESCRIPTION_LIMIT' })
  }
  if (document.mediaRefs.length > 20) issues.push({ code: 'MEDIA_LIMIT' })
  if (document.values.length > 200) issues.push({ code: 'VALUES_LIMIT' })
  if (document.facts.length > 200) issues.push({ code: 'FACTS_LIMIT' })
  if (new Set(document.mediaRefs).size !== document.mediaRefs.length) issues.push({ code: 'MEDIA_DUPLICATE' })
  const family = input.vocabulary.families.find(item => item.code === document.familyCode)
  if (document.familyCode === null) {
    if (document.values.length || document.facts.length) issues.push({ code: 'FAMILY_NULL_CONTENT' })
  } else if (!family) issues.push({ code: 'FAMILY_UNKNOWN' })

  const bindings = new Map(family?.bindings.map(binding => [binding.definitionCode, binding]))
  const definitions = new Map(input.vocabulary.definitions.map(definition => [definition.code, definition]))
  const variantIds = new Set(input.context.variants.map(variant => variant.id))
  const identities = new Map<string, Set<string | null>>()
  document.values.forEach((value, valueIndex) => {
    const report = (code: ValueIssueCode) => issues.push({ code, valueIndex })
    const subjects = identities.get(value.code) ?? new Set<string | null>()
    if (subjects.has(value.variantId)) report('DUPLICATE_VALUE')
    subjects.add(value.variantId)
    identities.set(value.code, subjects)
    if (value.evidence !== null && !isFreshEditorialEvidence(value.evidence)) report('EVIDENCE')
    const binding = bindings.get(value.code)
    const definition = definitions.get(value.code)
    // Missing family is already a root issue, not an invented binding per row.
    if (family && !binding) report('BINDING_UNKNOWN')
    if (binding && binding.owner !== value.owner) report('OWNER_MISMATCH')
    const subjectMatches = value.owner === 'product' ? value.variantId === null
      : variantIds.size === 0 ? value.variantId === null
        : value.variantId !== null && variantIds.has(value.variantId)
    if (!subjectMatches) report('SUBJECT')
    if (value.state !== 'known' || !binding || !definition) return
    const payload = value.payload
    if (payload.type !== definition.type) {
      report('PAYLOAD_TYPE')
      return
    }
    if ((payload.type === 'single' || payload.type === 'multi')
      && (definition.type === 'single' || definition.type === 'multi')) {
      const options = new Set(definition.options.map(option => option.code))
      const selected = payload.type === 'single' ? [payload.value] : payload.value
      if (payload.type === 'multi' && new Set(selected).size !== selected.length) report('MULTI_DUPLICATE')
      if (selected.some(option => !options.has(option))) report('OPTION_UNKNOWN')
    }
    if ((payload.type === 'number' || payload.type === 'range')
      && (definition.type === 'number' || definition.type === 'range')) {
      if (!definition.units.some(unit => unit.code === payload.unit)) report('UNIT_UNKNOWN')
      if (payload.type === 'range' && payload.min > payload.max) report('RANGE_ORDER')
      // The primitive reader already rejects numeric strings and nonfinite numbers.
      const numbers = payload.type === 'number' ? [payload.value] : [payload.min, payload.max]
      const policy = definition.numericPolicy
      if (policy.status === 'resolved') {
        if (policy.integer && numbers.some(n => !Number.isInteger(n))) report('NUMERIC_INTEGER')
        if (numbers.some(n => (policy.lower !== null
          && (n < policy.lower || (n === policy.lower && !policy.lowerInclusive)))
          || (policy.upper !== null
          && (n > policy.upper || (n === policy.upper && !policy.upperInclusive))))) report('NUMERIC_BOUNDS')
      }
    }
  })
  return { document, issues }
}
