import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type {
  EditorialContractVocabulary, EditorialFamily,
} from '../interfaces/editorial-contract-vocabulary.types'
import { decodeEditorialContractVocabulary } from './editorial-contract-vocabulary'

function unique<T>(values: T[]): boolean {
  return new Set(values).size === values.length
}

function qualifiesDefinition(definition: EditorialDefinition): boolean {
  if (definition.type === 'number' || definition.type === 'range') {
    if (!unique(definition.units.map(unit => unit.code))) return false
    if (definition.units.some(unit =>
      (unit.code === null) !== (unit.label === null) ||
      (definition.type === 'range' && unit.code === null))) return false
    const policy = definition.numericPolicy
    if (policy.status === 'pending') return true
    if (policy.lower === null && policy.lowerInclusive) return false
    if (policy.upper === null && policy.upperInclusive) return false
    if (policy.lower !== null && policy.upper !== null) {
      if (policy.lower > policy.upper) return false
      if (policy.lower === policy.upper && !(policy.lowerInclusive && policy.upperInclusive)) return false
    }
  }
  if (definition.type === 'single' || definition.type === 'multi') {
    const options = new Set(definition.options.map(option => option.code))
    if (options.size !== definition.options.length) return false
    if (!unique(definition.groups.map(group => group.code))) return false
    if (definition.groups.some(group =>
      !unique(group.optionCodes) || group.optionCodes.some(code => !options.has(code)))) return false
    // Exact original labels only; Unicode collision admission belongs to the backend.
    if (!unique(definition.aliases.map(alias => alias.label))) return false
    if (definition.aliases.some(alias => !options.has(alias.optionCode))) return false
  }
  return true
}

/** Kahn traversal avoids a recursion-depth limit for valid conditional chains. */
function acyclic(edges: Map<string, Set<string>>): boolean {
  const incoming = new Map<string, number>([...edges.keys()].map(code => [code, 0]))
  for (const targets of edges.values()) {
    for (const target of targets) incoming.set(target, incoming.get(target)! + 1)
  }
  const ready = [...incoming.keys()].filter(code => incoming.get(code) === 0)
  for (let index = 0; index < ready.length; index++) {
    for (const target of edges.get(ready[index]!)!) {
      const remaining = incoming.get(target)! - 1
      incoming.set(target, remaining)
      if (remaining === 0) ready.push(target)
    }
  }
  return ready.length === edges.size
}

function qualifiesFamily(
  family: EditorialFamily,
  byId: Map<string, EditorialDefinition>,
  byCode: Map<string, EditorialDefinition>,
): boolean {
  const bound = new Map(family.bindings.map(binding => [binding.definitionCode, binding]))
  if (bound.size !== family.bindings.length) return false
  for (const binding of family.bindings) {
    const definition = byId.get(binding.definitionId)
    if (!definition || definition !== byCode.get(binding.definitionCode)) return false
  }
  const edges = new Map<string, Set<string>>([...bound.keys()].map(code => [code, new Set()]))
  for (const binding of family.bindings) {
    const policy = binding.policy
    if (policy.route === 'fact_rule') {
      if (policy.rule.family !== family.code || policy.rule.parameter !== binding.definitionCode ||
        binding.owner !== 'sellable') return false
    }
    if (policy.route !== 'option_cases') continue
    if (!unique(policy.cases.map(item => item.code))) return false
    for (const item of policy.cases) {
      if (item.required && (item.applicability !== 'applicable' ||
        binding.publicationCheck !== 'always')) return false
      if (!unique(item.when.map(test => test.definitionCode))) return false
      for (const test of item.when) {
        const selectorBinding = bound.get(test.definitionCode)
        if (!selectorBinding) return false
        // Product rules evaluate once: their selectors must not vary by sellable subject.
        if (binding.owner === 'product' && selectorBinding.owner === 'sellable') return false
        const selector = byCode.get(test.definitionCode)
        if (!selector || (selector.type !== 'single' && selector.type !== 'multi')) return false
        const options = new Set(selector.options.map(option => option.code))
        if (test.optionCodes.length === 0 || !unique(test.optionCodes) ||
          test.optionCodes.some(code => !options.has(code))) return false
        edges.get(binding.definitionCode)!.add(test.definitionCode)
      }
    }
  }
  return acyclic(edges)
}

/** Consumer relational safety only, not publication authorization or full server admission. */
export function qualifyEditorialContractVocabulary(raw: unknown): EditorialContractVocabulary | null {
  const vocabulary = decodeEditorialContractVocabulary(raw)
  if (vocabulary === null) return null
  const { families, definitions } = vocabulary
  if (!unique(families.map(family => family.id)) || !unique(families.map(family => family.code))) return null
  const byId = new Map(definitions.map(definition => [definition.id, definition]))
  const byCode = new Map(definitions.map(definition => [definition.code, definition]))
  if (byId.size !== definitions.length || byCode.size !== definitions.length) return null
  if (!definitions.every(qualifiesDefinition)) return null
  if (!families.every(family => qualifiesFamily(family, byId, byCode))) return null
  // Return the primitive reader's detached snapshot itself, without rewriting any metadata.
  return vocabulary
}
