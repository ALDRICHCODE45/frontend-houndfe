import type { EditorialContentMagnitude, EditorialDeclaration } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialSellableFacts } from '../interfaces/editorial-contract-document.types'
import type { EditorialContractContext } from '../interfaces/editorial-contract-request.types'
import type { EditorialContractVocabulary, EditorialFamily } from '../interfaces/editorial-contract-vocabulary.types'

export type EditorialFactsReferenceIssue = {
  code: 'family' | 'subject' | 'declaration_family' | 'binding' | 'toy_type' | 'optional_route' | 'care_family'
  rowIndex: number
  declarationIndex?: number
}
export type EditorialFactsReferencesInput = {
  facts: EditorialSellableFacts[]
  family: EditorialFamily | null
  vocabulary: EditorialContractVocabulary
  context: EditorialContractContext
}

const productionFamilies = new Set(['food', 'treat', 'toy', 'hygiene', 'accessory', 'habitat', 'care'])
const permissions = new Map<EditorialDeclaration['key'], ReadonlySet<string>>([
  ['consumable', new Set(['hygiene'])],
  ['animalApplied', new Set(['hygiene'])],
  ['fitDeterminesChoice', new Set(['accessory'])],
  ['capacityDeterminesChoice', new Set(['accessory'])],
  ['electricalApplies', new Set(['accessory', 'habitat'])],
  ['relevantDimensionCodes', new Set(['toy', 'hygiene', 'accessory', 'habitat', 'care'])],
  ['relevantFitCodes', new Set(['accessory'])],
  ['relevantCapacityCodes', new Set(['accessory', 'habitat'])],
  ['relevantEquipmentCodes', new Set(['accessory', 'habitat'])],
  ['presentationKind', new Set(['care'])],
])
const magnitudeMeasures = new Map<EditorialContentMagnitude, string>([
  ['mass', 'measure.net_mass'], ['volume', 'measure.net_volume'], ['count', 'measure.content_count'],
  ['length', 'measure.coverage.length'], ['area', 'measure.coverage.area'],
])

/**
 * Reference checks only; not fresh capture admission or save/publication authority.
 * Reports row order, then subject, declarations in input order, and care permission.
 * Each declaration emits at most one issue per reference category (not per member).
 */
export function inspectEditorialFactsReferences({ facts, family, vocabulary, context }: EditorialFactsReferencesInput): EditorialFactsReferenceIssue[] {
  const issues: EditorialFactsReferenceIssue[] = []
  const subjects = new Set<string | null>(context.variants.length ? context.variants.map((v) => v.id) : [null])
  const bindings = new Map(family?.bindings.map((b) => [b.definitionCode, b]))
  const toyBinding = bindings.get('toy.type')
  const toyDefinition = toyBinding && vocabulary.definitions.find((d) => d.id === toyBinding.definitionId && d.code === 'toy.type')
  const toyOptions = new Set(toyDefinition && (toyDefinition.type === 'single' || toyDefinition.type === 'multi')
    ? toyDefinition.options.map((o) => o.code) : [])

  facts.forEach((row, rowIndex) => {
    if (!family) issues.push({ code: 'family', rowIndex })
    if (!subjects.has(row.variantId)) issues.push({ code: 'subject', rowIndex })
    // No selected family means no reference namespace; do not guess one.
    if (!family) return
    row.declarations.forEach((declaration, declarationIndex) => {
      const add = (code: EditorialFactsReferenceIssue['code']) => issues.push({ code, rowIndex, declarationIndex })
      const unrestricted = declaration.key === 'contentMagnitude' || declaration.key === 'optionalNonpertinenceCodes'
      if (!unrestricted && !permissions.get(declaration.key)?.has(family.code)) {
        add('declaration_family')
        return
      }
      if (declaration.state === 'unknown') return
      switch (declaration.key) {
        case 'contentMagnitude':
          if (!bindings.has(magnitudeMeasures.get(declaration.value)!)) add('binding')
          break
        case 'relevantDimensionCodes':
          if (declaration.value.codes.some((code) => !bindings.has(code))) add('binding')
          if (declaration.value.toyTypes.some((code) => family.code !== 'toy' || !toyOptions.has(code))) add('toy_type')
          break
        case 'relevantFitCodes':
        case 'relevantEquipmentCodes':
          if (declaration.value.some((code) => !bindings.has(code))) add('binding')
          break
        case 'relevantCapacityCodes':
          if (declaration.value.some((code) => !bindings.has(code)
            || (family.code === 'accessory' && code !== 'measure.capacity.container'))) add('binding')
          break
        case 'optionalNonpertinenceCodes':
          if (declaration.value.some((code) => {
            if (!productionFamilies.has(family.code)) return true
            const policy = bindings.get(code)?.policy
            return policy?.route !== 'fact_rule' || policy.rule.ruleId !== 'optional'
              || policy.rule.family !== family.code || policy.rule.parameter !== code
          })) add('optional_route')
          break
      }
    })
    if (row.careReview !== null && family.code !== 'care') issues.push({ code: 'care_family', rowIndex })
  })
  return issues
}
