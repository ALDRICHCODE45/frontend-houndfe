import { z } from 'zod'
import type { EditorialContractDocument } from '../interfaces/editorial-contract-document.types'
import type { EditorialReadiness, EditorialReadinessIssues, EditorialReadinessItem } from '../interfaces/editorial-contract-readiness.types'
import type { EditorialContractState } from '../interfaces/editorial-contract-response.types'
import { isEditorialVocabularyRevision } from './editorial-contract-response'
import { scalarString, snapshotJson } from './editorial-contract-value'

const counter = z.number().int().min(1).max(2147483647)
const itemSchema = z.object({
  scope: z.enum(['definition', 'variant', 'product', 'care']),
  definitionCode: scalarString.nullable(),
  variantId: scalarString.nullable(),
  sectionCode: scalarString.nullable(),
  problem: scalarString,
  message: scalarString.refine(value => value.trim().length > 0),
}).strict()
const issueShape = {
  items: z.array(itemSchema),
  bySection: z.record(z.string(), z.number().int().min(0)),
}
/** The `items`/`bySection` of a refused publish: the same list readiness gives. */
export const editorialReadinessIssuesShape = issueShape
const readinessSchema: z.ZodType<EditorialReadiness, z.ZodTypeDef, unknown> = z.object({
  ready: z.boolean(),
  cycle: counter.nullable(),
  draftRevision: counter.nullable(),
  vocabularyRevision: z.string().refine(isEditorialVocabularyRevision),
  ...issueShape,
}).strict().refine(value => value.ready === (value.items.length === 0))

export function decodeEditorialReadiness(raw: unknown): EditorialReadiness | null {
  try {
    const result = readinessSchema.safeParse(snapshotJson(raw))
    return result.success ? result.data : null
  } catch {
    return null
  }
}

/** «No saved draft» (readiness only): after a publish the draft is cleared, so this reads as published, not as a problem. */
export function isEditorialNoDraftReadiness(readiness: EditorialReadinessIssues): boolean {
  return readiness.items.length === 1 && readiness.items[0]!.scope === 'product' && readiness.items[0]!.problem === 'NO_DRAFT'
}

/**
 * The field an item is about: a datum of one presentation, keyed by (scope, definitionCode, variantId). A field may
 * have several items (evidence and a mismatch); an item with no datum (product, care) is a field of its own.
 */
export function editorialReadinessFieldKey(item: EditorialReadinessItem, fallback: string): string {
  return item.definitionCode === null ? `#${fallback}` : `${item.scope}\u0000${item.definitionCode}\u0000${item.variantId ?? ''}`
}
/** «Faltan N»: distinct fields, never items, so the header, the checklist and the section index agree. */
export function countEditorialReadinessFields(items: readonly EditorialReadinessItem[]): number {
  return new Set(items.map((item, index) => editorialReadinessFieldKey(item, `${index}`))).size
}
/** Distinct fields per section, from the items (the backend's `bySection` counts items). */
export function editorialReadinessSectionCounts(items: readonly EditorialReadinessItem[]): Record<string, number> {
  const fields = new Map<string, Set<string>>()
  items.forEach((item, index) => {
    if (item.sectionCode === null) return
    const set = fields.get(item.sectionCode) ?? new Set<string>()
    set.add(editorialReadinessFieldKey(item, `${index}`))
    fields.set(item.sectionCode, set)
  })
  return Object.fromEntries([...fields].map(([code, set]) => [code, set.size]))
}

/** Readiness evaluates one saved draft; it only speaks for the installed state it was read for. */
export function isEditorialReadinessCurrent(readiness: EditorialReadiness, state: EditorialContractState, vocabularyRevision: string): boolean {
  return readiness.vocabularyRevision === vocabularyRevision && readiness.cycle === state.cycle &&
    readiness.draftRevision === (state.draft?.revision ?? null)
}

// Stored content only. JSONB storage reorders object keys; array order is kept.
function comparable(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))) : item)
}
export function isSameEditorialDocument(left: EditorialContractDocument, right: EditorialContractDocument): boolean {
  return comparable(left) === comparable(right)
}

export type EditorialPublicationStatus = { kind: 'draft' | 'published' | 'changes'; label: string }
const shortDate = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })

/** The header state (handoff 05, §1). The read carries no publication date, so the date shows only
 * when this session published it. */
export function editorialPublicationStatus(state: EditorialContractState, publishedAt: Date | null): EditorialPublicationStatus | null {
  const { draft, published } = state
  if (!published) return draft ? { kind: 'draft', label: 'Borrador' } : null
  if (draft && !isSameEditorialDocument(draft.document, published.document)) return { kind: 'changes', label: 'Cambios sin publicar' }
  return { kind: 'published', label: publishedAt ? `Publicado · ${shortDate.format(publishedAt).replace('.', '')}` : 'Publicado' }
}
