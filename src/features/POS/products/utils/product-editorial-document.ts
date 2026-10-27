import { z } from 'zod'
import type { EditorialDocument } from '../interfaces/product-editorial.types'

const nullableString = z.string().nullable()
const uniqueStrings = z.array(z.string()).refine((items) => new Set(items).size === items.length)
const assignment = {
  code: z.string(), owner: z.enum(['product', 'sellable']), variantId: nullableString,
}
const valueSchema = z.discriminatedUnion('type', [
  z.object({ ...assignment, type: z.literal('text'), value: z.string() }).strict(),
  z.object({ ...assignment, type: z.literal('boolean'), value: z.boolean() }).strict(),
  z.object({ ...assignment, type: z.literal('number'), value: z.number().finite(), unit: nullableString }).strict(),
  z.object({ ...assignment, type: z.literal('single'), value: z.string() }).strict(),
  z.object({ ...assignment, type: z.literal('multi'), value: uniqueStrings }).strict(),
])
const historySchema = z.object({
  commercialTitle: nullableString,
  description: nullableString,
  mediaRefs: uniqueStrings,
  familyCode: nullableString,
  values: z.array(valueSchema),
}).strict().refine((document) => {
  if (document.familyCode === null && document.values.length !== 0) return false
  const tuples = new Set<string>()
  return document.values.every((value) => {
    if (value.owner === 'product' && value.variantId !== null) return false
    const tuple = JSON.stringify([value.code, value.variantId])
    if (tuples.has(tuple)) return false
    tuples.add(tuple)
    return true
  })
})

export type EditorialDocumentDecode =
  | { readable: true; document: EditorialDocument }
  | { readable: false; raw: unknown }

export function decodeEditorialDocument(raw: unknown): EditorialDocumentDecode {
  // Structural readability only: no fresh-save caps, vocabulary membership,
  // archived-conservation decisions or variant qualification belong here.
  // Return the original value, never Zod's cloned/normalized output.
  return historySchema.safeParse(raw).success
    ? { readable: true, document: raw as EditorialDocument }
    : { readable: false, raw }
}
