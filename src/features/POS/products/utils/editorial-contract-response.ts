import { z } from 'zod'
import type {
  EditorialStateResponse, EditorialVocabularyResponse,
} from '../interfaces/editorial-contract-response.types'
import { decodeEditorialContractDocument } from './editorial-contract-document'
import { scalarString, snapshotJson } from './editorial-contract-value'
import { qualifyEditorialContractVocabulary } from './editorial-contract-vocabulary-qualification'

const revisionPrefix = 'ev2-sha256-'

/** Syntax only: not a hash verification, authorization or global identity proof. */
export function isEditorialVocabularyRevision(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length === revisionPrefix.length + 64 &&
    raw.startsWith(revisionPrefix) && /^[0-9a-f]{64}$/.test(raw.slice(revisionPrefix.length))
}

function decodedAtom<T>(reader: (raw: unknown) => T | null) {
  return z.unknown().transform((raw, ctx) => {
    const decoded = reader(raw)
    if (decoded !== null) return decoded
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unreadable editorial response atom' })
    return z.NEVER
  })
}

// Storage counters only. Request CAS validation is a separate transport boundary.
const counter = z.number().int().min(1).max(2147483647)
const nonblank = scalarString.refine(value => value.trim().length > 0)
const warningSchema = z.object({
  code: z.literal('ARCHIVED_OPTION'),
  familyId: nonblank,
  definitionId: nonblank,
  owner: z.enum(['product', 'sellable']),
  variantId: scalarString.nullable(),
  optionCode: nonblank,
}).strict()
const documentSchema = decodedAtom(decodeEditorialContractDocument)
const stateSchema = z.object({
  cycle: counter.nullable(),
  draft: z.object({
    revision: counter,
    basePublishedRevision: counter.nullable(),
    document: documentSchema,
  }).strict().nullable(),
  published: z.object({ revision: counter, document: documentSchema }).strict().nullable(),
  warnings: z.array(warningSchema).optional(),
}).strict().refine(state => state.cycle !== null || (state.draft === null && state.published === null))
const envelope = {
  contractVersion: z.literal(2),
  vocabularyRevision: z.string().refine(isEditorialVocabularyRevision),
}
const stateResponseSchema: z.ZodType<EditorialStateResponse, z.ZodTypeDef, unknown> = z.object({
  ...envelope, state: stateSchema,
}).strict()
const vocabularyResponseSchema: z.ZodType<EditorialVocabularyResponse, z.ZodTypeDef, unknown> = z.object({
  ...envelope, vocabulary: decodedAtom(qualifyEditorialContractVocabulary),
}).strict()

/** Read a complete detached success body; never convert raw state or legacy modes. */
export function decodeEditorialStateResponse(raw: unknown): EditorialStateResponse | null {
  try {
    const result = stateResponseSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** Qualify the entire vocabulary before exposing any of its metadata. */
export function decodeEditorialVocabularyResponse(raw: unknown): EditorialVocabularyResponse | null {
  try {
    const result = vocabularyResponseSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
