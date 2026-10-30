import { z } from 'zod'
import type {
  EditorialDeclaration, EditorialDeclarationValues,
} from '../interfaces/editorial-contract-declaration.types'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES } from '../interfaces/editorial-production-codes'
import { evidenceSchema, scalarString, snapshotJson } from './editorial-contract-value'

const declarationValues = {
  contentMagnitude: z.enum(['mass', 'volume', 'count', 'length', 'area']),
  consumable: z.boolean(),
  animalApplied: z.boolean(),
  fitDeterminesChoice: z.boolean(),
  capacityDeterminesChoice: z.boolean(),
  electricalApplies: z.boolean(),
  relevantDimensionCodes: z.object({
    codes: z.array(z.enum([
      'measure.dimensions.external_length', 'measure.dimensions.external_width',
      'measure.dimensions.external_height', 'measure.dimensions.external_diameter',
      'measure.dimensions.internal_length', 'measure.dimensions.internal_width',
      'measure.dimensions.internal_height', 'measure.dimensions.internal_diameter',
    ])),
    toyTypes: z.array(scalarString),
  }).strict(),
  relevantFitCodes: z.array(z.enum(['measure.fit.neck', 'measure.fit.chest', 'measure.fit.back_length'])),
  relevantCapacityCodes: z.array(z.enum([
    'measure.capacity.container', 'measure.capacity.habitat_usable_volume',
  ])),
  relevantEquipmentCodes: z.array(z.enum([
    'measure.equipment.power', 'measure.equipment.voltage', 'measure.equipment.frequency',
    'measure.equipment.flow', 'measure.equipment.temperature',
  ])),
  presentationKind: z.enum(['formulation', 'device', 'packaging']),
  optionalNonpertinenceCodes: z.array(z.enum(EDITORIAL_PRODUCTION_DEFINITION_CODES)),
} satisfies { [K in keyof EditorialDeclarationValues]: z.ZodType<EditorialDeclarationValues[K]> }

const declarationEnvelope = z.discriminatedUnion('state', [
  z.object({ key: scalarString, state: z.literal('unknown'), evidence: z.null() }).strict(),
  z.object({
    key: scalarString, state: z.literal('known'), value: z.unknown(),
    evidence: evidenceSchema, basis: scalarString,
  }).strict(),
])

/** Decode primitive shape only; current admission and publication policy belong elsewhere. */
export function decodeEditorialDeclaration(raw: unknown): EditorialDeclaration | null {
  try {
    const snapshot = snapshotJson(raw)
    // Parse the closed envelope before choosing its key-specific value schema.
    const envelope = declarationEnvelope.safeParse(snapshot)
    if (!envelope.success) return null
    const declaration = envelope.data
    if (!Object.prototype.hasOwnProperty.call(declarationValues, declaration.key)) return null
    if (declaration.state === 'unknown') return declaration as EditorialDeclaration
    if (!Object.prototype.hasOwnProperty.call(declaration, 'value')) return null
    const value = declarationValues[declaration.key as keyof EditorialDeclarationValues]
      .safeParse(declaration.value)
    if (!value.success) return null
    // Membership and key-specific parsing above establish the mapped-union correlation.
    return { ...declaration, value: value.data } as EditorialDeclaration
  } catch {
    return null
  }
}
