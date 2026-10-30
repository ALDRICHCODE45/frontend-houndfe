import type { EditorialEvidence } from './editorial-contract-value.types'
import type { EditorialProductionDefinitionCode } from './editorial-production-codes'

export type EditorialDimensionCode =
  | 'measure.dimensions.external_length' | 'measure.dimensions.external_width'
  | 'measure.dimensions.external_height' | 'measure.dimensions.external_diameter'
  | 'measure.dimensions.internal_length' | 'measure.dimensions.internal_width'
  | 'measure.dimensions.internal_height' | 'measure.dimensions.internal_diameter'
export type EditorialFitCode = 'measure.fit.neck' | 'measure.fit.chest' | 'measure.fit.back_length'
export type EditorialCapacityCode =
  | 'measure.capacity.container' | 'measure.capacity.habitat_usable_volume'
export type EditorialEquipmentCode =
  | 'measure.equipment.power' | 'measure.equipment.voltage'
  | 'measure.equipment.frequency' | 'measure.equipment.flow' | 'measure.equipment.temperature'
export type EditorialContentMagnitude = 'mass' | 'volume' | 'count' | 'length' | 'area'

export type EditorialDeclarationValues = {
  contentMagnitude: EditorialContentMagnitude
  consumable: boolean
  animalApplied: boolean
  fitDeterminesChoice: boolean
  capacityDeterminesChoice: boolean
  electricalApplies: boolean
  relevantDimensionCodes: { codes: EditorialDimensionCode[]; toyTypes: string[] }
  relevantFitCodes: EditorialFitCode[]
  relevantCapacityCodes: EditorialCapacityCode[]
  relevantEquipmentCodes: EditorialEquipmentCode[]
  presentationKind: 'formulation' | 'device' | 'packaging'
  optionalNonpertinenceCodes: EditorialProductionDefinitionCode[]
}

export type EditorialDeclaration = {
  [K in keyof EditorialDeclarationValues]:
    | { key: K; state: 'unknown'; evidence: null }
    | {
        key: K
        state: 'known'
        value: EditorialDeclarationValues[K]
        evidence: EditorialEvidence
        basis: string
      }
}[keyof EditorialDeclarationValues]
