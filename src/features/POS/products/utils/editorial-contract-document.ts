import { z } from 'zod'
import type {
  EditorialContractDocument, EditorialSellableFacts,
} from '../interfaces/editorial-contract-document.types'
import { decodeEditorialCareReview } from './editorial-contract-care'
import { decodeEditorialDeclaration } from './editorial-contract-declaration'
import { decodeEditorialValue, scalarString, snapshotJson } from './editorial-contract-value'

// Compose verified readers, not copies of their nested schemas. A failed atom
// becomes a parse issue so no parent can silently prune or replace stored data.
function decodedAtom<T>(reader: (raw: unknown) => T | null) {
  return z.unknown().transform((raw, ctx) => {
    const decoded = reader(raw)
    if (decoded !== null) return decoded
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unreadable editorial atom' })
    return z.NEVER
  })
}

const factsSchema: z.ZodType<EditorialSellableFacts, z.ZodTypeDef, unknown> = z.object({
  variantId: scalarString.nullable(),
  presentation: scalarString,
  declarations: z.array(decodedAtom(decodeEditorialDeclaration)),
  careReview: decodedAtom(decodeEditorialCareReview).nullable(),
}).strict()

const documentSchema: z.ZodType<EditorialContractDocument, z.ZodTypeDef, unknown> = z.object({
  schemaVersion: z.literal(2),
  commercialTitle: scalarString.nullable(),
  description: scalarString.nullable(),
  mediaRefs: z.array(scalarString),
  familyCode: scalarString.nullable(),
  values: z.array(decodedAtom(decodeEditorialValue)),
  facts: z.array(factsSchema),
}).strict()

/** Primitive readability only; fresh subject, family and publication rules are separate. */
export function decodeEditorialSellableFacts(raw: unknown): EditorialSellableFacts | null {
  try {
    const result = factsSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** Decode a complete detached document, never a partial or converted legacy document. */
export function decodeEditorialContractDocument(raw: unknown): EditorialContractDocument | null {
  try {
    const result = documentSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}
