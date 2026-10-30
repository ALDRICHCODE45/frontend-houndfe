import type { EditorialDeclaration, EditorialDeclarationValues } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialSellableFacts } from '../interfaces/editorial-contract-document.types'
import type { EditorialFactRule, EditorialRuleResult } from '../interfaces/editorial-contract-vocabulary.types'

type Outcome = 'O' | 'R' | 'N' | 'U'
const content = {
  mass: 'measure.net_mass', volume: 'measure.net_volume', count: 'measure.content_count',
  length: 'measure.coverage.length', area: 'measure.coverage.area',
} as const
const presentation = { formulation: 'care.form', device: 'care.device', packaging: 'pack.form' } as const

function subset(parameter: string, selected: readonly string[] | null, required = true): Outcome {
  if (selected === null) return 'U'
  if (selected.length === 0) return 'N'
  return required && selected.includes(parameter) ? 'R' : 'O'
}
function flag(parameter: string, value: boolean | null, selected: readonly string[] | null, required = true): Outcome {
  if (value === false) return selected?.length ? 'U' : 'N'
  if (value === true) return selected?.length ? subset(parameter, selected, required) : 'U'
  return required ? 'U' : 'O'
}
function known<K extends keyof EditorialDeclarationValues>(declarations: readonly EditorialDeclaration[], key: K): EditorialDeclarationValues[K] | null {
  const declaration = declarations.find(item => item.key === key)
  // The exact key comparison and discriminant establish the indexed value type.
  return declaration?.state === 'known' ? declaration.value as EditorialDeclarationValues[K] : null
}

function outcome({ family, ruleId, parameter }: EditorialFactRule, facts: EditorialSellableFacts | null): Outcome {
  const declarations = facts?.declarations ?? []
  const get = <K extends keyof EditorialDeclarationValues>(key: K) => known(declarations, key)
  switch (ruleId) {
    case 'required': return 'R'
    case 'optional': return get('optionalNonpertinenceCodes')?.includes(parameter) ? 'N' : 'O'
    case 'animal':
    case 'form': {
      const value = get(ruleId === 'animal' ? 'animalApplied' : 'consumable')
      if (value === false) return 'N'
      return value === true ? 'R' : 'U'
    }
    case 'content': {
      if (!['food', 'treat', 'hygiene', 'care'].includes(family)) return 'O'
      if (family === 'hygiene') {
        const consumable = get('consumable')
        if (consumable === false) return 'N'
        if (consumable !== true) return 'U'
      }
      const magnitude = get('contentMagnitude')
      if (magnitude === null || (family === 'treat' && (magnitude === 'length' || magnitude === 'area'))) return 'U'
      return parameter === content[magnitude] ? 'R' : 'O'
    }
    case 'dimensions': return subset(parameter, get('relevantDimensionCodes')?.codes ?? null)
    case 'space': {
      const dimensions = get('relevantDimensionCodes')?.codes ?? null
      const capacities = get('relevantCapacityCodes')
      if (dimensions === null || capacities === null) return 'U'
      return subset(parameter, parameter.startsWith('measure.dimensions.') ? dimensions : capacities)
    }
    case 'fit': return flag(parameter, get('fitDeterminesChoice'), get('relevantFitCodes'))
    case 'capacity': return flag(parameter, get('capacityDeterminesChoice'), get('relevantCapacityCodes'))
    case 'equipment': return flag(parameter, get('electricalApplies'), get('relevantEquipmentCodes'))
    case 'optional_equipment': return flag(parameter, get('electricalApplies'), get('relevantEquipmentCodes'), false)
    case 'presentation': {
      const kind = get('presentationKind')
      if (kind === null) return 'U'
      return parameter === presentation[kind] ? 'R' : 'O'
    }
    default: {
      const unreachable: never = ruleId
      throw new Error(`Unsupported production rule: ${unreachable}`)
    }
  }
}

/**
 * Resolves one admitted production rule for one caller-selected subject row.
 * Requires shape/evidence/reference-validated facts and admitted production dispatch;
 * ordinary FE metadata qualification alone does not prove that dispatch admission.
 * Missing/unknown projects to null, never a fabricated negative finding.
 * Does not check E, independent fact conflicts, care, value evidence or publication.
 */
export function resolveEditorialFactRule(rule: EditorialFactRule, facts: EditorialSellableFacts | null): EditorialRuleResult {
  const result = outcome(rule, facts)
  return {
    applicability: result === 'N' ? 'not_applicable' : result === 'U' ? 'unresolved' : 'applicable',
    required: result === 'R', allowNA: result === 'N', evidenceRequired: true, documentary: 'resolved',
  }
}
