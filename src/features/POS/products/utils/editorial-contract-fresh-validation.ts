import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { decodeEditorialContractDocument } from './editorial-contract-document'
import { inspectEditorialBasicReferences, type EditorialBasicReferenceIssue } from './editorial-contract-document-references'
import { isFreshEditorialEvidence } from './editorial-contract-evidence-validation'

export type EditorialBasicIssue = EditorialBasicReferenceIssue
  | { code: 'STRUCTURE' | 'TITLE_LIMIT' | 'DESCRIPTION_LIMIT' | 'MEDIA_LIMIT' | 'VALUES_LIMIT' | 'FACTS_LIMIT' }
  | { code: 'EVIDENCE' | 'RANGE_ORDER' | 'NUMERIC_INTEGER' | 'NUMERIC_BOUNDS'; valueIndex: number }
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
  const references = inspectEditorialBasicReferences({ ...input, document })
  const valueReferences = new Map<number, Extract<EditorialBasicReferenceIssue, { valueIndex: number }>[]>()
  for (const issue of references) {
    if (!('valueIndex' in issue)) issues.push(issue)
    else {
      const row = valueReferences.get(issue.valueIndex) ?? []
      row.push(issue)
      valueReferences.set(issue.valueIndex, row)
    }
  }
  const family = input.vocabulary.families.find(item => item.code === document.familyCode)
  const bindings = new Map(family?.bindings.map(binding => [binding.definitionCode, binding]))
  const definitions = new Map(input.vocabulary.definitions.map(definition => [definition.code, definition]))
  document.values.forEach((value, valueIndex) => {
    const report = (code: ValueIssueCode) => issues.push({ code, valueIndex })
    const row = valueReferences.get(valueIndex) ?? []
    // Evidence remains after duplicate identity and before binding/payload references.
    let referenceIndex = 0
    if (row[0]?.code === 'DUPLICATE_VALUE') { issues.push(row[0]); referenceIndex++ }
    if (value.evidence !== null && !isFreshEditorialEvidence(value.evidence)) report('EVIDENCE')
    issues.push(...row.slice(referenceIndex))
    const definition = definitions.get(value.code)
    if (value.state !== 'known' || !bindings.has(value.code) || !definition) return
    const payload = value.payload
    if ((payload.type === 'number' || payload.type === 'range') && payload.type === definition.type
      && (definition.type === 'number' || definition.type === 'range')) {
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
