import { z } from 'zod'
import type { EditorialDefinition, EditorialDocument, EditorialValue } from '../interfaces/product-editorial.types'
import { decodeEditorialDocument } from './product-editorial-document'
import { validateEditorialSave } from './product-editorial-save-validation'

export interface EditorialAssignmentIssue {
  code: 'structure' | 'limits' | 'metadata' | 'baseline' | 'family' | 'binding' | 'variant' | 'unit' | 'option' | 'archived' | 'media'
  valueIndex?: number
}
export interface EditorialAssignmentValidation {
  valid: boolean
  issues: EditorialAssignmentIssue[]
}
export interface EditorialAssignmentInput {
  readonly document: unknown
  // Persisted GET draft (or Published/initialized document), NEVER the local buffer.
  // Unknown accepts readonly snapshots and unreadable history without rewriting it.
  readonly persistedBaseline: unknown
  readonly vocabulary: unknown
  readonly context: unknown
}

const owner = z.enum(['product', 'sellable'])
const nullableString = z.string().nullable()
const order = z.number().finite()
const definitionBase = { id: z.string(), code: z.string(), label: z.string() }
const definitionSchema = z.discriminatedUnion('type', [
  z.object({ ...definitionBase, type: z.literal('text') }).strict(),
  z.object({ ...definitionBase, type: z.literal('boolean') }).strict(),
  z.object({ ...definitionBase, type: z.literal('number'), units: z.array(z.object({
    code: nullableString, label: nullableString, sortOrder: order,
  }).strict()) }).strict(),
  ...(['single', 'multi'] as const).map(type => z.object({
    ...definitionBase, type: z.literal(type), options: z.array(z.object({
      code: z.string(), label: z.string(), archived: z.boolean(), sortOrder: order,
    }).strict()),
  }).strict()),
])
const vocabularySchema = z.object({
  families: z.array(z.object({
    id: z.string(), code: z.string(), label: z.string(), bindings: z.array(z.object({
      definitionId: z.string(), definitionCode: z.string(), owner, sortOrder: order,
    }).strict()),
  }).strict()),
  definitions: z.array(definitionSchema),
}).strict()
const contextSchema = z.object({
  variants: z.array(z.object({ id: z.string(), name: z.string() }).strict()),
}).strict()

type Vocabulary = z.infer<typeof vocabularySchema>
type Context = z.infer<typeof contextSchema>
type IssueCode = EditorialAssignmentIssue['code']

// Resolve IDs AND codes, never a first partial match or an invented label catalog.
function resolveDefinition(value: EditorialValue, familyCode: string | null, vocabulary: Vocabulary): EditorialDefinition | null {
  const families = vocabulary.families.filter(family => family.code === familyCode)
  if (families.length !== 1) return null
  const bindings = families[0]!.bindings.filter(binding => binding.definitionCode === value.code)
  const definitions = vocabulary.definitions.filter(definition => definition.code === value.code)
  if (bindings.length !== 1 || definitions.length !== 1) return null
  const binding = bindings[0]!
  const definition = definitions[0]!
  return binding.definitionId === definition.id && binding.owner === value.owner && definition.type === value.type
    ? definition : null
}

function qualify(value: EditorialValue, familyCode: string | null, vocabulary: Vocabulary, context: Context): IssueCode | null {
  const definition = resolveDefinition(value, familyCode, vocabulary)
  if (!definition) return 'binding'
  if (value.owner === 'product' ? value.variantId !== null
    : context.variants.length === 0 ? value.variantId !== null
      : !context.variants.some(variant => variant.id === value.variantId)) return 'variant'
  if (value.type === 'number' && definition.type === 'number' &&
    !definition.units.some(unit => unit.code === value.unit)) return 'unit'
  if ((value.type === 'single' || value.type === 'multi') &&
    (definition.type === 'single' || definition.type === 'multi')) {
    const codes = value.type === 'single' ? [value.value] : value.value
    if (codes.some(code => !definition.options.some(option => option.code === code))) return 'option'
  }
  return null
}

function hasFamily(document: EditorialDocument, vocabulary: Vocabulary): boolean {
  return document.familyCode === null || vocabulary.families.filter(family => family.code === document.familyCode).length === 1
}

function baselineMatchesContext(document: EditorialDocument, vocabulary: Vocabulary, context: Context): boolean {
  return hasFamily(document, vocabulary) && document.values.every(value =>
    qualify(value, document.familyCode, vocabulary, context) === null)
}

/** Archived eligibility only: qualify persisted history against current authority
 * without fresh-save caps, rewriting history or treating it as a new candidate.
 * A null result cannot authorize conservation; it does not decide readability.
 */
export function qualifyEditorialBaseline(
  input: Pick<EditorialAssignmentInput, 'persistedBaseline' | 'vocabulary' | 'context'>,
): EditorialDocument | null {
  const baseline = decodeEditorialDocument(input.persistedBaseline)
  const vocabulary = vocabularySchema.safeParse(input.vocabulary)
  const context = contextSchema.safeParse(input.context)
  if (!baseline.readable || !vocabulary.success || !context.success) return null
  return baselineMatchesContext(baseline.document, vocabulary.data, context.data) ? baseline.document : null
}

/** Fresh-save backstop only; never run against GET/history to determine readability.
 * Both documents resolve through CURRENT vocabulary (S8), not historical IDs.
 * One issue per assignment (at most 200); indexes refer to the unchanged input.
 * This is not final server authority and performs no requests or normalization.
 */
export function validateEditorialAssignments(input: EditorialAssignmentInput): EditorialAssignmentValidation {
  const fail = (code: IssueCode): EditorialAssignmentValidation => ({ valid: false, issues: [{ code }] })
  const fresh = validateEditorialSave(input.document)
  if (!fresh.valid) return fail(fresh.reason)
  const vocabulary = vocabularySchema.safeParse(input.vocabulary)
  const context = contextSchema.safeParse(input.context)
  if (!vocabulary.success || !context.success) return fail('metadata')
  const baseline = decodeEditorialDocument(input.persistedBaseline)
  if (!baseline.readable) return fail('baseline')
  const document = fresh.document
  if (document.mediaRefs.length !== baseline.document.mediaRefs.length ||
    document.mediaRefs.some((ref, index) => ref !== baseline.document.mediaRefs[index])) return fail('media')
  if (!hasFamily(document, vocabulary.data)) return fail('family')

  // Baseline eligibility has contextual checks, NOT fresh-save caps. Invalid
  // persisted assignments cannot authorize archived membership in a fresh save.
  const baselineQualifies = baselineMatchesContext(baseline.document, vocabulary.data, context.data)
  const issues: EditorialAssignmentIssue[] = []
  document.values.forEach((value, valueIndex) => {
    const issue = qualify(value, document.familyCode, vocabulary.data, context.data)
    if (issue) {
      issues.push({ code: issue, valueIndex })
      return
    }
    const definition = resolveDefinition(value, document.familyCode, vocabulary.data)!
    if ((value.type !== 'single' && value.type !== 'multi') ||
      (definition.type !== 'single' && definition.type !== 'multi')) return
    const codes = value.type === 'single' ? [value.value] : value.value
    const introducedArchived = codes.some(code => {
      if (!definition.options.some(option => option.code === code && option.archived)) return false
      return !baselineQualifies || baseline.document.familyCode !== document.familyCode ||
        !baseline.document.values.some(previous => previous.code === value.code && previous.owner === value.owner &&
          previous.variantId === value.variantId && previous.type === value.type &&
          (previous.type === 'single' ? previous.value === code : previous.type === 'multi' && previous.value.includes(code)))
    })
    if (introducedArchived) issues.push({ code: 'archived', valueIndex })
  })
  return { valid: issues.length === 0, issues }
}
