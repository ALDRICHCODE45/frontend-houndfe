import type { EditorialDefinition } from '../interfaces/editorial-contract-definition.types'
import type { EditorialOwner } from '../interfaces/editorial-contract-value.types'
import type { EditorialFamily } from '../interfaces/editorial-contract-vocabulary.types'
import type { EditorialAssignmentInput, EditorialAssignmentTarget, EditorialPayloadInput } from './editorial-contract-assignment-input'
import type { EditorialAssignmentEditingRow } from './editorial-contract-document-editing'

export type EditorialTableSubject = { variantId: string | null; label: string }
export type EditorialTableColumn = { key: string; label: string; owner: EditorialOwner; variantId: string | null }
export type EditorialTableCell = {
  key: string
  target: EditorialAssignmentTarget
  /** Id of the stored assignment row, null until the cell has a value or a state. */
  rowId: string | null
  input: EditorialAssignmentInput
  filled: boolean
}
export type EditorialTableRow = {
  code: string
  label: string
  definition: EditorialDefinition
  /** One cell per table column; null where no binding allows that target. */
  cells: (EditorialTableCell | null)[]
}
export type EditorialAttributeTable = {
  columns: EditorialTableColumn[]
  rows: EditorialTableRow[]
  answered: number
  total: number
  missing: number
  /** Stored assignments with content that no cell shows (kept untouched in the document). */
  orphanCount: number
}

/** Identity of a cell: the exact (definition, owner, presentation) it stores. */
export const editorialTargetKey = (target: EditorialAssignmentTarget) => JSON.stringify([target.code, target.owner, target.variantId])

function isEmptyPayload(payload: EditorialPayloadInput, strict: boolean): boolean {
  const blank = (value: string) => (strict ? value === '' : value.trim() === '')
  switch (payload.type) {
    case 'text': case 'number': return blank(payload.value)
    case 'boolean': case 'single': return payload.value === null
    case 'multi': return payload.value.length === 0
    case 'range': return blank(payload.min) && blank(payload.max)
  }
}

/** A cell counts as answered with a value, "Desconocido" or "No aplica"; only "Sin dato" is missing. */
export function isEditorialInputFilled(input: EditorialAssignmentInput): boolean {
  if (input.state === 'omitted') return false
  return input.state !== 'known' || !isEmptyPayload(input.payload, false)
}

/** Nothing left to store: an omitted state or a known value whose control is back to its placeholder. */
export function isEditorialInputBlank(input: EditorialAssignmentInput): boolean {
  return input.state === 'omitted' || (input.state === 'known' && input.evidence === null && isEmptyPayload(input.payload, true))
}

/**
 * Rows are the definitions bound to the family, by human label. Columns are Producto plus one per
 * presentation, and a column exists only where some binding allows its target. Definitions carry no
 * topic metadata (their `groups` are option groups), so every row is one group. A product without
 * variants whose data is all per sellable has a single column, named Producto.
 */
export function buildEditorialAttributeTable({ family, definitions, values, subjects }: {
  family: EditorialFamily | null
  definitions: readonly EditorialDefinition[]
  values: readonly EditorialAssignmentEditingRow[]
  subjects: readonly EditorialTableSubject[]
}): EditorialAttributeTable {
  const empty: EditorialAttributeTable = { columns: [], rows: [], answered: 0, total: 0, missing: 0, orphanCount: 0 }
  if (!family) return empty
  const candidates: EditorialTableColumn[] = [
    { key: 'product', label: 'Producto', owner: 'product', variantId: null },
    ...subjects.map(subject => ({ key: `sellable:${subject.variantId ?? 'none'}`, label: subject.label, owner: 'sellable' as const, variantId: subject.variantId })),
  ]
  const stored = new Map<string, EditorialAssignmentEditingRow>()
  for (const item of values) {
    const key = editorialTargetKey(item.target)
    if (!stored.has(key)) stored.set(key, item)
  }
  const bound = family.bindings.flatMap(binding => {
    const definition = definitions.find(item => item.id === binding.definitionId && item.code === binding.definitionCode)
    return definition ? [{ binding, definition }] : []
  })
  const used = candidates.filter(column => bound.some(({ binding }) => binding.owner === column.owner))
  // With no Producto column and no variants, the one sellable column is the product itself.
  if (!used.some(column => column.owner === 'product') && used.length === 1 && used[0]!.variantId === null) used[0] = { ...used[0]!, label: 'Producto' }
  const matched = new Set<string>()
  let answered = 0
  let total = 0
  const rows = bound.map(({ binding, definition }): EditorialTableRow => ({
    code: definition.code,
    label: definition.label,
    definition,
    cells: used.map(column => {
      if (column.owner !== binding.owner) return null
      const target = { code: definition.code, owner: column.owner, variantId: column.variantId }
      const found = stored.get(editorialTargetKey(target))
      const input: EditorialAssignmentInput = found?.input ?? { state: 'omitted' }
      const filled = isEditorialInputFilled(input)
      if (found) matched.add(found.id)
      total++
      if (filled) answered++
      return { key: column.key, target, rowId: found?.id ?? null, input, filled }
    }),
  })).sort((left, right) => left.label.localeCompare(right.label, 'es'))
  const orphanCount = values.filter(item => item.input.state !== 'omitted' && !matched.has(item.id)).length
  return { columns: used, rows, answered, total, missing: total - answered, orphanCount }
}

/** Create the assignment when a cell gets a value or a state; drop it when nothing is left to store. */
export function applyEditorialCellInput(
  values: readonly EditorialAssignmentEditingRow[],
  cell: { target: EditorialAssignmentTarget; rowId: string | null },
  input: EditorialAssignmentInput,
  nextId: () => string,
): EditorialAssignmentEditingRow[] {
  if (isEditorialInputBlank(input)) return cell.rowId === null ? [...values] : removeEditorialCell(values, cell.rowId)
  if (cell.rowId !== null) return values.map(item => (item.id === cell.rowId ? { ...item, input } : item))
  return [...values, { id: nextId(), target: { ...cell.target }, input }]
}

/** "Quitar dato": the assignment leaves the document, other rows keep their identity. */
export function removeEditorialCell(values: readonly EditorialAssignmentEditingRow[], rowId: string): EditorialAssignmentEditingRow[] {
  return values.filter(item => item.id !== rowId)
}
