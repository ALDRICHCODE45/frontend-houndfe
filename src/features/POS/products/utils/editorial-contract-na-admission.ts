import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialValue } from '../interfaces/editorial-contract-value.types'
import type { EditorialBinding, EditorialContractVocabulary, EditorialFamily, EditorialRuleResult } from '../interfaces/editorial-contract-vocabulary.types'
import { resolveEditorialFactRule } from './editorial-contract-fact-policy'
import { allowsEditorialNotApplicable, selectEditorialOptionCase } from './editorial-contract-option-policy'

export type EditorialNotApplicableInput = {
  document: EditorialContractDocument
  vocabulary: EditorialContractVocabulary
}
export type EditorialNotApplicableIssue = { code: 'NA_NOT_ALLOWED'; valueIndex: number }

/**
 * The policy result of one binding for one subject: the single evaluation behind both the save
 * check and the guidance of the table. `fact_rule` reads the declarations of the subject's row;
 * an option case is selected from the values. Null when the policy does not resolve.
 */
export function resolveEditorialBindingRule({ family, binding, definitions, values, facts, variantId }: {
  family: EditorialFamily
  binding: EditorialBinding
  definitions: readonly EditorialDefinition[]
  values: readonly EditorialValue[]
  facts: EditorialContractDocument['facts']
  variantId: string | null
}): EditorialRuleResult | null {
  const policy = binding.policy
  return policy.route === 'fact_rule'
    ? resolveEditorialFactRule(policy.rule, facts.find(row => row.variantId === variantId) ?? null)
    : selectEditorialOptionCase({ policy, family, definitions, values, currentSubject: variantId })
}

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
    const result = resolveEditorialBindingRule({ family, binding, definitions: vocabulary.definitions,
      values: document.values, facts: document.facts, variantId: value.variantId })
    if (!allowsEditorialNotApplicable(result)) issues.push({ code: 'NA_NOT_ALLOWED', valueIndex })
  })
  return issues
}
