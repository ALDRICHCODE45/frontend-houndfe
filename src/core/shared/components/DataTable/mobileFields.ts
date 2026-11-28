import type {
  SortingState,
  TableColumn,
  TableMobileField,
  TableMobileRole,
  TableMobileTone,
  TableSortOption,
  VisibilityState,
} from '../../types/table.types'
import { columnLabel, leafColumns } from './columnLayout.utils'
import { columnKey, findPrimaryColumnKey } from './primaryColumn.utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = TableColumn<any, unknown>

interface ColumnShape {
  accessorKey?: unknown
  accessorFn?: (row: unknown, index: number) => unknown
  meta?: { mobile?: TableMobileField<unknown> | TableMobileField<unknown>[] }
}
// SAFETY: reads the optional accessor and meta fields of any TanStack column definition.
const shape = (column: AnyColumn) => column as unknown as ColumnShape

/** A mobile field resolved for one row. */
export interface MobileFieldValue {
  /** The column it comes from. */
  id: string
  role: TableMobileRole
  text: string
  tone?: TableMobileTone
  note?: string
  /** Caption (stats); the column label by default. */
  label: string
  icon?: string
}

/** What the phone row / card shows for one record (odd/tasks/mobile-tables.md S4). */
export interface MobileRowModel {
  lead?: MobileFieldValue
  primary?: MobileFieldValue
  secondary: MobileFieldValue[]
  figure?: MobileFieldValue
  figureNote?: MobileFieldValue
  status: MobileFieldValue[]
  stats: MobileFieldValue[]
}

const MAX_STATS = 3

function fieldsOf(column: AnyColumn): TableMobileField<unknown>[] {
  const mobile = shape(column).meta?.mobile
  if (!mobile) return []
  return Array.isArray(mobile) ? mobile : [mobile]
}

/** Some column declares `meta.mobile`. */
export function hasMobileFields(columns: readonly AnyColumn[]): boolean {
  return leafColumns(columns as AnyColumn[]).some(column => fieldsOf(column).length > 0)
}

function accessorValue(column: AnyColumn, row: unknown, index: number): unknown {
  const { accessorKey, accessorFn } = shape(column)
  if (accessorFn) return accessorFn(row, index)
  if (typeof accessorKey === 'string' && row && typeof row === 'object') {
    // Dotted keys read nested values, as TanStack does.
    return accessorKey.split('.').reduce<unknown>(
      (value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined),
      row,
    )
  }
  return undefined
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function resolveField(
  column: AnyColumn,
  field: TableMobileField<unknown>,
  row: unknown,
  index: number,
): MobileFieldValue | undefined {
  const text = asText(field.value ? field.value(row) : accessorValue(column, row, index)).trim()
  if (!text) return undefined
  const note = field.note?.(row)
  const icon = typeof field.icon === 'function' ? field.icon(row) : field.icon
  return {
    id: columnKey(column) ?? '',
    role: field.role,
    text,
    tone: field.tone?.(row),
    note: note ? note : undefined,
    label: field.label ?? columnLabel(column),
    icon: icon || undefined,
  }
}

interface ResolveOptions {
  visibility?: VisibilityState
  /** Cards (B): the «Columnas» sheet chooses their fields, so hidden columns are left out. */
  honourVisibility?: boolean
}

/**
 * The fields of one record for the phone list. Without any `meta.mobile`, the name is the first data
 * column (the desktop primary) and nothing else is shown.
 */
export function resolveMobileRow(
  columns: readonly AnyColumn[],
  row: unknown,
  index: number,
  { visibility = {}, honourVisibility = false }: ResolveOptions = {},
): MobileRowModel {
  const model: MobileRowModel = { secondary: [], status: [], stats: [] }
  const leaves = leafColumns(columns as AnyColumn[])

  if (!hasMobileFields(leaves)) {
    const key = findPrimaryColumnKey(leaves)
    const column = leaves.find(candidate => columnKey(candidate) === key)
    if (column) model.primary = resolveField(column, { role: 'primary' }, row, index)
    return model
  }

  for (const column of leaves) {
    const hidden = honourVisibility && visibility[columnKey(column) ?? ''] === false
    for (const field of fieldsOf(column)) {
      if (hidden && field.role !== 'primary') continue
      const value = resolveField(column, field, row, index)
      if (!value) continue
      switch (field.role) {
        case 'secondary':
          model.secondary.push(value)
          break
        case 'status':
          model.status.push(value)
          break
        case 'stat':
          if (model.stats.length < MAX_STATS) model.stats.push(value)
          break
        default:
          model[field.role] ??= value
      }
    }
  }
  return model
}

/** `<id>:asc|desc` of the first sort, or `undefined` without one. */
export function sortOptionValue(sorting: SortingState): string | undefined {
  const first = sorting[0]
  return first ? `${first.id}:${first.desc ? 'desc' : 'asc'}` : undefined
}

/** The option that matches the current sort, if the menu has it. */
export function findSortOption(options: readonly TableSortOption[], sorting: SortingState): TableSortOption | undefined {
  const value = sortOptionValue(sorting)
  return value ? options.find(option => option.value === value) : undefined
}

/** The sorting state an option stands for. */
export function sortingFromOption(value: string): SortingState {
  const separator = value.lastIndexOf(':')
  const id = separator > 0 ? value.slice(0, separator) : value
  return [{ id, desc: value.slice(separator + 1) === 'desc' }]
}
