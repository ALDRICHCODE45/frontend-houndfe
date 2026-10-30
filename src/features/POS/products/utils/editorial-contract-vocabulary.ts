import { z } from 'zod'
import type { EditorialContractVocabulary } from '../interfaces/editorial-contract-vocabulary.types'
import { EDITORIAL_PRODUCTION_DEFINITION_CODES } from '../interfaces/editorial-production-codes'
import { decodeEditorialDefinition } from './editorial-contract-definition'
import { scalarString, snapshotJson } from './editorial-contract-value'

const nonblankString = scalarString.refine((value) => value.trim().length > 0)
const optionTestSchema = z.object({
  definitionCode: nonblankString,
  operator: z.enum(['equals_set', 'contains_all', 'intersects']),
  optionCodes: z.array(nonblankString),
}).strict()
const policyCaseSchema = z.object({
  code: nonblankString,
  when: z.array(optionTestSchema),
  applicability: z.enum(['applicable', 'not_applicable', 'unresolved']),
  required: z.boolean(),
  allowNA: z.boolean(),
  evidenceRequired: z.boolean(),
  documentary: z.enum(['resolved', 'not_applicable', 'unresolved']),
}).strict()
const factRuleSchema = z.object({
  family: z.enum(['food', 'treat', 'toy', 'hygiene', 'accessory', 'habitat', 'care']),
  ruleId: z.enum([
    'required', 'optional', 'animal', 'form', 'content', 'dimensions',
    'fit', 'capacity', 'space', 'equipment', 'optional_equipment', 'presentation',
  ]),
  parameter: z.enum(EDITORIAL_PRODUCTION_DEFINITION_CODES),
}).strict()
const bindingPolicySchema = z.discriminatedUnion('route', [
  z.object({ route: z.literal('pending') }).strict(),
  z.object({ route: z.literal('option_cases'), cases: z.array(policyCaseSchema) }).strict(),
  z.object({ route: z.literal('fact_rule'), rule: factRuleSchema }).strict(),
])
const bindingSchema = z.object({
  definitionId: nonblankString,
  definitionCode: nonblankString,
  owner: z.enum(['product', 'sellable']),
  sortOrder: z.number().finite().refine(Number.isSafeInteger),
  exposure: z.enum(['INTERNAL', 'DETAIL', 'FACET']),
  searchable: z.boolean(),
  publicationCheck: z.enum(['always', 'when_asserted']),
  policy: bindingPolicySchema,
}).strict()
const familySchema = z.object({
  id: nonblankString,
  code: nonblankString,
  label: nonblankString,
  bindings: z.array(bindingSchema),
}).strict()
// Compose the existing reader rather than duplicating its six metadata branches.
const definitionSchema = z.unknown().transform((raw, context) => {
  const definition = decodeEditorialDefinition(raw)
  if (definition !== null) return definition
  context.addIssue({ code: 'custom', message: 'Unreadable definition' })
  return z.NEVER
})
const vocabularySchema: z.ZodType<EditorialContractVocabulary, z.ZodTypeDef, unknown> = z.object({
  semanticsVersion: z.literal('editorial-production-1'),
  families: z.array(familySchema),
  definitions: z.array(definitionSchema),
}).strict()

/** Decode the complete primitive snapshot, not metadata admission or policy evaluation. */
export function decodeEditorialContractVocabulary(raw: unknown): EditorialContractVocabulary | null {
  try {
    const result = vocabularySchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    // Snapshot rejects submitted accessors/non-JSON containers before schema reads.
    return null
  }
}
