import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { resolveEditorialFactRule } from './editorial-contract-fact-policy'
import { allowsEditorialNotApplicable, selectEditorialOptionCase } from './editorial-contract-option-policy'

export type EditorialNotApplicableInput = {
  document: EditorialContractDocument
  vocabulary: EditorialContractVocabulary
}
export type EditorialNotApplicableIssue = { code: 'NA_NOT_ALLOWED'; valueIndex: number }
/**
 * Explicit NA only, never overall save or publication authorization.
 * Requires successful candidate shape/capture/evidence/reference checks, same-scope
 * qualified metadata (including product-only selectors), and admitted production dispatch.
 * Checks every supplied NA, not an E subset. Known contradictions remain draft-editable.
 * Caller owns those prerequisites; invariant errors are programming errors, not wire errors.
 */
export function inspectEditorialNotApplicableAdmission({ document, vocabulary }: EditorialNotApplicableInput): EditorialNotApplicableIssue[] {
  const issues: EditorialNotApplicableIssue[] = []
  const family = vocabulary.families.find(item => item.code === document.familyCode)
  const bindings = new Map(family?.bindings.map(binding => [binding.definitionCode, binding]))
  document.values.forEach((value, valueIndex) => {
    if (value.state !== 'not_applicable') return
    const binding = bindings.get(value.code)
    if (!family || !binding) throw new Error('NA inspection requires reference-valid family and bindings')
    const policy = binding.policy
    const result = policy.route === 'fact_rule'
      ? resolveEditorialFactRule(policy.rule, document.facts.find(row => row.variantId === value.variantId) ?? null)
      : selectEditorialOptionCase({ policy, family, definitions: vocabulary.definitions,
        values: document.values, currentSubject: value.variantId })
    if (!allowsEditorialNotApplicable(result)) issues.push({ code: 'NA_NOT_ALLOWED', valueIndex })
  })
  return issues
}
