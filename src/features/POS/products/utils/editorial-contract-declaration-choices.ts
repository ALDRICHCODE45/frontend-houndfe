import type { EditorialDeclarationValues, EditorialDimensionCode, EditorialFitCode, EditorialCapacityCode, EditorialEquipmentCode } from '../interfaces/editorial-contract-declaration.types'
import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialFamily } from '../interfaces/editorial-contract-vocabulary.types'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES } from '../interfaces/editorial-production-codes'
type Key = keyof EditorialDeclarationValues
export type EditorialDeclarationChoice = {
  key: Key; label: string
  choices: { code: string; label: string }[]; toyTypeChoices: { code: string; label: string }[]
}
const catalog: readonly { key: Key; label: string; families?: readonly string[] }[] = [
  { key: 'contentMagnitude', label: 'Magnitud del contenido' },
  { key: 'consumable', label: 'Consumible', families: ['hygiene'] },
  { key: 'animalApplied', label: 'Aplicado al animal', families: ['hygiene'] },
  { key: 'fitDeterminesChoice', label: 'El ajuste determina la elección', families: ['accessory'] },
  { key: 'capacityDeterminesChoice', label: 'La capacidad determina la elección', families: ['accessory'] },
  { key: 'electricalApplies', label: 'Aplica electricidad', families: ['accessory', 'habitat'] },
  { key: 'relevantDimensionCodes', label: 'Dimensiones relevantes', families: ['toy', 'hygiene', 'accessory', 'habitat', 'care'] },
  { key: 'relevantFitCodes', label: 'Medidas de ajuste relevantes', families: ['accessory'] },
  { key: 'relevantCapacityCodes', label: 'Capacidades relevantes', families: ['accessory', 'habitat'] },
  { key: 'relevantEquipmentCodes', label: 'Especificaciones de equipo relevantes', families: ['accessory', 'habitat'] },
  { key: 'presentationKind', label: 'Tipo de presentación', families: ['care'] },
  { key: 'optionalNonpertinenceCodes', label: 'Códigos opcionales no pertinentes' },
]
/** The words for a declaration key, so a stored key that is no longer offered still reads as a label. */
export function editorialDeclarationLabel(key: string): string {
  return catalog.find(entry => entry.key === key)?.label ?? 'Declaración'
}
const dimensions = [
  'measure.dimensions.external_length', 'measure.dimensions.external_width', 'measure.dimensions.external_height',
  'measure.dimensions.external_diameter', 'measure.dimensions.internal_length', 'measure.dimensions.internal_width',
  'measure.dimensions.internal_height', 'measure.dimensions.internal_diameter',
] satisfies EditorialDimensionCode[]
const fit = ['measure.fit.neck', 'measure.fit.chest', 'measure.fit.back_length'] satisfies EditorialFitCode[]
const capacity = ['measure.capacity.container', 'measure.capacity.habitat_usable_volume'] satisfies EditorialCapacityCode[]
const equipment = ['measure.equipment.power', 'measure.equipment.voltage', 'measure.equipment.frequency',
  'measure.equipment.flow', 'measure.equipment.temperature'] satisfies EditorialEquipmentCode[]
const axes = new Map<Key, ReadonlySet<string>>([
  ['relevantDimensionCodes', new Set(dimensions)], ['relevantFitCodes', new Set(fit)],
  ['relevantCapacityCodes', new Set(capacity)], ['relevantEquipmentCodes', new Set(equipment)],
])
const productionFamilies = new Set(['food', 'treat', 'toy', 'hygiene', 'accessory', 'habitat', 'care'])
const productionCodes = new Set<string>(EDITORIAL_PRODUCTION_DEFINITION_CODES)

/** Display projection from one qualified snapshot, not capture/reference/save authority.
 * Keep eligible keys even without choices: unknown/empty capture is a separate rule.
 * Bindings/options retain input order and exact labels, including archived toy options.
 * Scalar enums remain owned by the field; history stays owned by the list/field.
 * Limited S25 predicate duplication is pinned by reference-parity tests, not runtime
 * inspector probing. Caller must not use these display entries as permission to save.
 */
export function projectEditorialDeclarationChoices({ family, definitions }: {
  family: EditorialFamily | null; definitions: readonly EditorialDefinition[]
}): EditorialDeclarationChoice[] {
  if (!family) return []
  return catalog.filter(entry => !entry.families || entry.families.includes(family.code)).map(({ key, label }) => {
    const choices: EditorialDeclarationChoice['choices'] = []
    for (const binding of family.bindings) {
      let included = axes.get(key)?.has(binding.definitionCode) ?? false
      if (key === 'relevantCapacityCodes' && family.code === 'accessory')
        included = binding.definitionCode === 'measure.capacity.container'
      if (key === 'optionalNonpertinenceCodes') {
        const policy = binding.policy
        included = productionFamilies.has(family.code) && productionCodes.has(binding.definitionCode)
          && policy.route === 'fact_rule' && policy.rule.ruleId === 'optional'
          && policy.rule.family === family.code && policy.rule.parameter === binding.definitionCode
      }
      if (!included) continue
      const definition = definitions.find(d => d.id === binding.definitionId && d.code === binding.definitionCode)
      if (definition) choices.push({ code: definition.code, label: definition.label })
    }
    let toyTypeChoices: EditorialDeclarationChoice['toyTypeChoices'] = []
    if (key === 'relevantDimensionCodes' && family.code === 'toy') {
      const binding = family.bindings.find(b => b.definitionCode === 'toy.type')
      const definition = binding && definitions.find(d => d.id === binding.definitionId && d.code === binding.definitionCode)
      if (definition && (definition.type === 'single' || definition.type === 'multi'))
        toyTypeChoices = definition.options.map(option => ({ code: option.code, label: option.label }))
    }
    return { key, label, choices, toyTypeChoices }
  })
}
