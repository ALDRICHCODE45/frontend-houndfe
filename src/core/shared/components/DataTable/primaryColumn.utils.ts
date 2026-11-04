import type { VNode } from 'vue'
import type { TableColumn, VisibilityState } from '../../types/table.types'

/** Class the core CSS reads to give the name column its floor and the largest share (C1). */
export const PRIMARY_COLUMN_CLASS = 'hf-col-primary'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = TableColumn<any, unknown>
type CellClass = string | ((cell: never) => string) | undefined

interface ColumnShape {
  id?: string
  accessorKey?: unknown
  header?: unknown
  columns?: unknown
  meta?: { primary?: boolean; class?: { th?: CellClass; td?: CellClass } }
}

// SAFETY: every TanStack column definition has these optional fields; this reads them without the
// union narrowing (accessor, display and group columns) that the shared type forces.
const shape = (column: AnyColumn) => column as unknown as ColumnShape

/** The id TanStack uses for the column: an explicit `id`, else its accessor key. */
export function columnKey(column: AnyColumn): string | undefined {
  const { id, accessorKey } = shape(column)
  return id ?? (accessorKey === undefined ? undefined : String(accessorKey))
}

/** Selection and Acciones columns hold controls, never the record's name. */
export function isUtilityColumn(column: AnyColumn): boolean {
  const key = columnKey(column)
  if (key === 'select' || key === 'actions') return true
  const th = shape(column).meta?.class?.th
  return typeof th === 'string' && /(^|\s)w-16(\s|$)/.test(th)
}

/**
 * The column that gets priority width: the first `meta.primary` column, else the first visible data
 * column after the selection column. Groups and the control columns are never primary.
 */
export function findPrimaryColumnKey(
  columns: readonly AnyColumn[],
  visibility: VisibilityState = {},
): string | undefined {
  const candidates = columns.filter(column => {
    const key = columnKey(column)
    return key !== undefined && visibility[key] !== false && !shape(column).columns
  })
  const flagged = candidates.find(column => shape(column).meta?.primary === true)
  const chosen = flagged ?? candidates.find(column => !isUtilityColumn(column))
  return chosen ? columnKey(chosen) : undefined
}

function withClass(current: CellClass, extra: string): string | ((cell: never) => string) {
  if (typeof current === 'function') return cell => `${current(cell)} ${extra}`.trim()
  return current ? `${current} ${extra}` : extra
}

/** Columns with `hf-col-primary` added to the header and cell classes of the primary column. */
export function withPrimaryColumn(columns: AnyColumn[], primaryKey: string | undefined): AnyColumn[] {
  if (primaryKey === undefined) return columns
  return columns.map(column => {
    if (columnKey(column) !== primaryKey) return column
    const { meta } = shape(column)
    return {
      ...column,
      meta: {
        ...meta,
        class: {
          ...meta?.class,
          th: withClass(meta?.class?.th, PRIMARY_COLUMN_CLASS),
          td: withClass(meta?.class?.td, PRIMARY_COLUMN_CLASS),
        },
      },
    } as AnyColumn
  })
}

/** The string classes a column declares for its header and cells (functions are not resolved). */
export function declaredCellClasses(column: AnyColumn): { th: string; td: string } {
  const cellClass = shape(column).meta?.class
  return {
    th: typeof cellClass?.th === 'string' ? cellClass.th : '',
    td: typeof cellClass?.td === 'string' ? cellClass.td : '',
  }
}

export type SkeletonHeader = { kind: 'text'; text: string } | { kind: 'node'; node: VNode } | { kind: 'none' }

// A header renderer that reads an API we did not stub must not break the loading state.
const inertStub = (key: string | undefined) =>
  new Proxy({ id: key }, { get: (target, prop) => (prop in target ? target[prop as 'id'] : () => false) })

/**
 * The header the real table will show, for the loading skeleton: a string as is, a render function
 * (`createSimpleHeader`, `SortableHeader`) called with inert stubs. Anything it cannot resolve is
 * `none`, which the skeleton draws as a bar.
 */
export function resolveSkeletonHeader(column: AnyColumn): SkeletonHeader {
  const { header } = shape(column)
  if (typeof header === 'string') return header ? { kind: 'text', text: header } : { kind: 'none' }
  if (typeof header !== 'function') return { kind: 'none' }
  try {
    const stub = inertStub(columnKey(column))
    const result = header({ column: stub, header: stub, table: stub })
    if (typeof result === 'string') return result ? { kind: 'text', text: result } : { kind: 'none' }
    return result && typeof result === 'object' ? { kind: 'node', node: result as VNode } : { kind: 'none' }
  } catch {
    return { kind: 'none' }
  }
}
