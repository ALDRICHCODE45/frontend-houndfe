import { z } from 'zod'
import type { EditorialCareReview } from '../interfaces/editorial-contract-care.types'
import { evidenceSchema, scalarString, snapshotJson } from './editorial-contract-value'

const requirementSchema = z.object({
  key: scalarString,
  description: scalarString,
  disposition: z.enum(['satisfied', 'not_applicable', 'unresolved', 'conflicting']),
  evidence: z.array(evidenceSchema),
  basis: scalarString,
}).strict()

const warningSchema = z.object({
  key: scalarString,
  requirementKeys: z.array(scalarString),
  text: scalarString,
  disclosure: z.enum(['private_only', 'public_required', 'unresolved']),
  evidence: z.array(evidenceSchema),
  handlingBasis: scalarString,
}).strict()

const careReviewSchema: z.ZodType<EditorialCareReview> = z.discriminatedUnion('state', [
  z.object({ state: z.literal('unknown') }).strict(),
  z.object({
    state: z.literal('prepared'),
    jurisdiction: scalarString,
    intendedUse: scalarString,
    determination: z.enum(['identified', 'none_applicable']),
    evidence: z.array(evidenceSchema),
    basis: scalarString,
    requirements: z.array(requirementSchema),
    warnings: z.array(warningSchema),
  }).strict(),
])

/** Decode private capture shape only; readability does not grant publication readiness. */
export function decodeEditorialCareReview(raw: unknown): EditorialCareReview | null {
  try {
    const result = careReviewSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
