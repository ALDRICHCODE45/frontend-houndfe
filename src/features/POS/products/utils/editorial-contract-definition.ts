import { z } from 'zod'
import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import { scalarString, snapshotJson } from './editorial-contract-value'

// Check identity whitespace without normalizing the stored spelling.
const nonblankString = scalarString.refine((value) => value.trim().length > 0)
const finiteNumber = z.number().finite()
const sortOrder = finiteNumber.refine(Number.isSafeInteger)
const unitSchema = z.object({
  code: nonblankString.nullable(),
  label: nonblankString.nullable(),
  sortOrder,
}).strict()
const optionSchema = z.object({
  code: nonblankString,
  label: nonblankString,
  archived: z.boolean(),
  sortOrder,
}).strict()
const groupSchema = z.object({
  code: nonblankString,
  label: nonblankString,
  optionCodes: z.array(nonblankString),
}).strict()
const aliasSchema = z.object({
  label: nonblankString,
  optionCode: nonblankString,
}).strict()
const numericPolicySchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('pending') }).strict(),
  z.object({
    status: z.literal('resolved'),
    magnitude: scalarString,
    integer: z.boolean(),
    lower: finiteNumber.nullable(),
    lowerInclusive: z.boolean(),
    upper: finiteNumber.nullable(),
    upperInclusive: z.boolean(),
  }).strict(),
])
const identity = { id: nonblankString, code: nonblankString, label: nonblankString, description: scalarString.nullable().optional() }
const numericMetadata = { units: z.array(unitSchema), numericPolicy: numericPolicySchema }
const choiceMetadata = {
  options: z.array(optionSchema),
  groups: z.array(groupSchema),
  aliases: z.array(aliasSchema),
}
const definitionSchema: z.ZodType<EditorialDefinition> = z.discriminatedUnion('type', [
  z.object({ ...identity, type: z.literal('text') }).strict(),
  z.object({ ...identity, type: z.literal('boolean') }).strict(),
  z.object({ ...identity, type: z.literal('number'), ...numericMetadata }).strict(),
  z.object({ ...identity, type: z.literal('range'), ...numericMetadata }).strict(),
  z.object({ ...identity, type: z.literal('single'), ...choiceMetadata }).strict(),
  z.object({ ...identity, type: z.literal('multi'), ...choiceMetadata }).strict(),
])

/** Decode primitive metadata only; relational/domain admission belongs to T3. */
export function decodeEditorialDefinition(raw: unknown): EditorialDefinition | null {
  try {
    const result = definitionSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    // Snapshot rejects unreadable data before Zod can access submitted properties.
    return null
  }
}
