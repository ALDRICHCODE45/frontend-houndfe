import type { EditorialDefinition } from './editorial-contract-definition.types'
import type { EditorialOwner } from './editorial-contract-value.types'
import type { EditorialProductionDefinitionCode } from './editorial-production-codes'

type EditorialOptionTest = {
  definitionCode: string
  operator: 'equals_set' | 'contains_all' | 'intersects'
  optionCodes: string[]
}
export type EditorialPolicyCase = {
  code: string
  when: EditorialOptionTest[]
  applicability: 'applicable' | 'not_applicable' | 'unresolved'
  required: boolean
  allowNA: boolean
  evidenceRequired: boolean
  documentary: 'resolved' | 'not_applicable' | 'unresolved'
}
export type EditorialProductionFamily = 'food' | 'treat' | 'toy' | 'hygiene' | 'accessory' | 'habitat' | 'care'
type EditorialRuleId =
  | 'required' | 'optional' | 'animal' | 'form' | 'content' | 'dimensions'
  | 'fit' | 'capacity' | 'space' | 'equipment' | 'optional_equipment' | 'presentation'
export type EditorialFactRule = {
  family: EditorialProductionFamily
  ruleId: EditorialRuleId
  parameter: EditorialProductionDefinitionCode
}
export type EditorialRuleResult = Pick<EditorialPolicyCase,
  'applicability' | 'required' | 'allowNA' | 'evidenceRequired' | 'documentary'>
export type EditorialBindingPolicy =
  | { route: 'pending' }
  | { route: 'option_cases'; cases: EditorialPolicyCase[] }
  | { route: 'fact_rule'; rule: EditorialFactRule }
export type EditorialBinding = {
  definitionId: string
  definitionCode: string
  owner: EditorialOwner
  sortOrder: number
  exposure: 'INTERNAL' | 'DETAIL' | 'FACET'
  searchable: boolean
  publicationCheck: 'always' | 'when_asserted'
  policy: EditorialBindingPolicy
}
export type EditorialFamily = { id: string; code: string; label: string; bindings: EditorialBinding[] }
export type EditorialContractVocabulary = {
  semanticsVersion: 'editorial-production-1'
  families: EditorialFamily[]
  definitions: EditorialDefinition[]
}
