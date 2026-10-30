import { z } from 'zod'
import type { EditorialValue } from '../interfaces/editorial-contract-value.types'

// Unicode mode treats a valid surrogate pair as one code point, not a surrogate.
export const scalarString = z.string().refine((value) => !/[\uD800-\uDFFF]/u.test(value))
const finiteNumber = z.number().finite()
const payloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), value: scalarString }).strict(),
  z.object({ type: z.literal('boolean'), value: z.boolean() }).strict(),
  z.object({ type: z.literal('number'), value: finiteNumber, unit: scalarString.nullable() }).strict(),
  z.object({ type: z.literal('single'), value: scalarString }).strict(),
  z.object({ type: z.literal('multi'), value: z.array(scalarString) }).strict(),
  z.object({ type: z.literal('range'), min: finiteNumber, max: finiteNumber, unit: scalarString }).strict(),
])
export const evidenceSchema = z.object({ sourceRef: scalarString, verifiedOn: scalarString }).strict()
const assignment = {
  code: scalarString,
  owner: z.enum(['product', 'sellable']),
  variantId: scalarString.nullable(),
}
const valueSchema: z.ZodType<EditorialValue> = z.discriminatedUnion('state', [
  z.object({
    ...assignment, state: z.literal('known'), payload: payloadSchema, evidence: evidenceSchema.nullable(),
  }).strict(),
  z.object({ ...assignment, state: z.literal('unknown'), evidence: z.null() }).strict(),
  z.object({ ...assignment, state: z.literal('not_applicable'), evidence: z.null() }).strict(),
])

type JsonData = null | string | boolean | number | JsonData[] | { [key: string]: JsonData }

// Zod reads properties directly. Snapshot data descriptors first so submitted
// getters, class instances and toJSON hooks never participate in validation.
export function snapshotJson(raw: unknown, ancestors = new Set<object>()): JsonData {
  if (raw === null || typeof raw === 'string' || typeof raw === 'boolean') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw !== 'object' || raw === null || ancestors.has(raw)) throw new Error('Not JSON data')

  const array = Array.isArray(raw)
  const prototype = Object.getPrototypeOf(raw)
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new Error('Not a plain JSON container')
  }
  const descriptors = Object.getOwnPropertyDescriptors(raw)
  const keys = Reflect.ownKeys(descriptors)
  ancestors.add(raw)
  try {
    if (array) {
      const length = descriptors.length?.value as number
      if (keys.length !== length + 1) throw new Error('Not a dense JSON array')
      const result: JsonData[] = []
      for (let i = 0; i < length; i++) {
        const descriptor = descriptors[String(i)]
        if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error('Not a JSON item')
        result.push(snapshotJson(descriptor.value, ancestors))
      }
      return result
    }
    const result: { [key: string]: JsonData } = Object.create(null)
    for (const key of keys) {
      if (typeof key !== 'string') throw new Error('Not a JSON key')
      const descriptor = descriptors[key]
      if (!descriptor?.enumerable || !('value' in descriptor)) throw new Error('Not a JSON field')
      result[key] = snapshotJson(descriptor.value, ancestors)
    }
    return result
  } finally {
    ancestors.delete(raw)
  }
}

/** Decode only primitive shape; fresh admission belongs to a separate boundary. */
export function decodeEditorialValue(raw: unknown): EditorialValue | null {
  try {
    const result = valueSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    // Invalid descriptors, cycles and excessive nesting are unreadable, not errors to callers.
    return null
  }
}
