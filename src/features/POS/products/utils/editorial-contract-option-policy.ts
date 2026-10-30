import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialValue } from '../interfaces/editorial-contract-value.types'
import type { EditorialBindingPolicy, EditorialFamily, EditorialPolicyCase, EditorialRuleResult } from '../interfaces/editorial-contract-vocabulary.types'

export type EditorialOptionSelectionInput = {
  policy: Exclude<EditorialBindingPolicy, { route: 'fact_rule' }>
  family: EditorialFamily
  definitions: readonly EditorialDefinition[]
  values: readonly EditorialValue[]
  currentSubject: string | null
}
/**
 * Requires qualified metadata and reference-valid values from the same snapshot.
 * This is selection only: no fresh admission, dependency scheduling or E evaluation.
 * currentSubject is caller-owned, including when the target binding is product-owned.
 * Invariant errors indicate programmer misuse, never a wire error or unresolved policy.
 */
export function selectEditorialOptionCase({ policy, family, definitions, values, currentSubject }: EditorialOptionSelectionInput): EditorialPolicyCase | null {
  if (policy.route === 'pending') return null
  if (policy.route !== 'option_cases') throw new Error('Option selection requires an option-case policy')
  const bindings = new Map(family.bindings.map(binding => [binding.definitionCode, binding]))
  const definitionsByCode = new Map(definitions.map(definition => [definition.code, definition]))
  const matches = policy.cases.filter(candidate => candidate.when.every(test => {
    const binding = bindings.get(test.definitionCode)
    const definition = definitionsByCode.get(test.definitionCode)
    if (!binding || !definition || (definition.type !== 'single' && definition.type !== 'multi')) {
      throw new Error('Option selection requires qualified choice selectors')
    }
    const subject = binding.owner === 'product' ? null : currentSubject
    const value = values.find(item => item.code === test.definitionCode && item.variantId === subject)
    if (!value || value.state !== 'known') return false
    const payload = value.payload
    if (payload.type !== definition.type || (payload.type !== 'single' && payload.type !== 'multi')) {
      throw new Error('Option selection requires reference-valid choice payloads')
    }
    const selected = new Set(payload.type === 'single' ? [payload.value] : payload.value)
    switch (test.operator) {
      case 'equals_set':
        return selected.size === test.optionCodes.length && test.optionCodes.every(code => selected.has(code))
      case 'contains_all':
        return test.optionCodes.every(code => selected.has(code))
      case 'intersects':
        return test.optionCodes.some(code => selected.has(code))
    }
  }))
  const selected = matches.length === 1 ? matches[0] : undefined
  return selected ? { ...selected, when: selected.when.map(test => ({ ...test, optionCodes: [...test.optionCodes] })) } : null
}

/** NA permission only; documentary/evidence readiness and fresh admission are separate. */
export function allowsEditorialNotApplicable(rule: Pick<EditorialRuleResult, 'applicability' | 'allowNA'> | null): boolean {
  return rule?.applicability === 'not_applicable' && rule.allowNA
}
