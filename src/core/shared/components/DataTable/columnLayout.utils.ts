import type { Column } from '@tanstack/vue-table'
import type { TableColumn } from '../../types/table.types'
import { columnKey, resolveSkeletonHeader } from './primaryColumn.utils'
import { isLockedColumn, SELECT_COLUMN_ID, type ColumnSizeBounds } from './tableLayout'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyColumn = TableColumn<any, unknown>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTableColumn = Column<any, unknown>
type CellArg = { column: AnyTableColumn }
type ClassValue = string | ((arg: never) => string) | undefined
type StyleValue = string | Record<string, string> | ((arg: never) => string | Record<string, string>) | undefined

interface ColumnShape {
  columns?: AnyColumn[]
  header?: unknown
  size?: number
  minSize?: number
  maxSize?: number
  meta?: {
    label?: string
    class?: { th?: ClassValue; td?: ClassValue }
    style?: { th?: StyleValue; td?: StyleValue }
  }
}

// SAFETY: every TanStack column definition has these optional fields; this reads them without the
// union narrowing (accessor, display and group columns) that the shared type forces.
const shape = (column: AnyColumn) => column as unknown as ColumnShape

/** Default widths. The name column gets the free space of the surface on top of its own. */
export const SELECT_COLUMN_SIZE = 48
export const ACTIONS_COLUMN_SIZE = 64
export const PRIMARY_COLUMN_SIZE = 256
export const COLUMN_SIZE = 128
const PRIMARY_BOUNDS: ColumnSizeBounds = { min: 160, max: 1200 }
const COLUMN_BOUNDS: ColumnSizeBounds = { min: 80, max: 640 }

/**
 * Default widths that exceed the surface shrink toward this floor (never below a column's own
 * minimum) before the surface scrolls; the name column stops at its minimum.
 */
export const SHRINK_FLOOR = 96

/** Keyboard resize step (Alt+←/→). */
export const RESIZE_STEP = 16

/** The leaf columns (group columns flattened) with an id. */
export function leafColumns(columns: readonly AnyColumn[]): AnyColumn[] {
  return columns.flatMap(column => {
    const children = shape(column).columns
    if (children) return leafColumns(children)
    return columnKey(column) === undefined ? [] : [column]
  })
}

/** A column id usable in a CSS custom property name and a class name. */
export const cssColumnId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_')
export const columnWidthVar = (id: string) => `--hf-col-w-${cssColumnId(id)}`
/** Class on every header and body cell of a column, so autofit can find the rendered cells. */
export const columnCellClass = (id: string) => `hf-colid-${cssColumnId(id)}`

/** The width a column declares with a `w-<n>` utility on its header (`w-16` → 64px), if any. */
function declaredUtilityWidth(column: AnyColumn): number | undefined {
  const th = shape(column).meta?.class?.th
  const match = typeof th === 'string' ? th.match(/(?:^|\s)w-(\d+)(?:\s|$)/) : null
  return match ? Number(match[1]) * 4 : undefined
}

export function defaultColumnSize(column: AnyColumn, primary: boolean): number {
  const id = columnKey(column)
  const declared = shape(column).size
  if (id === SELECT_COLUMN_ID) return SELECT_COLUMN_SIZE
  if (id !== undefined && isLockedColumn(id)) return ACTIONS_COLUMN_SIZE
  if (declared !== undefined) return declared
  return declaredUtilityWidth(column) ?? (primary ? PRIMARY_COLUMN_SIZE : COLUMN_SIZE)
}

export function columnSizeBounds(column: AnyColumn, primary: boolean): ColumnSizeBounds {
  const id = columnKey(column)
  const size = defaultColumnSize(column, primary)
  if (id !== undefined && isLockedColumn(id)) return { min: size, max: size }
  const fallback = primary ? PRIMARY_BOUNDS : COLUMN_BOUNDS
  const min = shape(column).minSize ?? Math.min(fallback.min, size)
  const max = shape(column).maxSize ?? Math.max(fallback.max, size)
  return { min, max }
}

/** The column's name for labels: `meta.label`, a string header, or a `SortableHeader` label. */
export function columnLabel(column: AnyColumn): string {
  const id = columnKey(column) ?? ''
  const { meta } = shape(column)
  if (meta?.label) return meta.label
  const header = resolveSkeletonHeader(column)
  if (header.kind === 'text') return header.text
  if (header.kind === 'node') {
    const label = (header.node.props as { label?: unknown } | null)?.label
    if (typeof label === 'string' && label) return label
  }
  return id
}

function withClass(current: ClassValue, extra: (arg: CellArg) => string) {
  return (arg: CellArg) => {
    const base = typeof current === 'function' ? (current as (value: CellArg) => string)(arg) : (current ?? '')
    return `${base} ${extra(arg)}`.trim()
  }
}

function withStyle(current: StyleValue, extra: Record<string, string>) {
  const css = Object.entries(extra)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}: ${value}`)
    .join('; ')
  return (arg: CellArg) => {
    const base = typeof current === 'function' ? (current as (value: CellArg) => StyleValue)(arg) : current
    if (base === undefined || base === '') return extra
    if (typeof base === 'string') return `${base}; ${css}`
    return { ...(base as Record<string, string>), ...extra }
  }
}

/** Edge classes: the last left-pinned and the first right-pinned column carry the pinned divider. */
function edgeClass(column: AnyTableColumn): string {
  const pinned = column.getIsPinned()
  if (pinned === 'left' && column.getIsLastColumn('left')) return 'hf-pin-edge-left'
  if (pinned === 'right' && column.getIsFirstColumn('right')) return 'hf-pin-edge-right'
  return ''
}

/**
 * Columns ready for the premium layout: default size and bounds, the width from `--hf-col-w-<id>` on
 * every header and cell (UTable never applies `column.getSize()`), the cell class autofit measures,
 * the pinned edge classes, and the locked selection / Acciones columns made unresizable and
 * unpinnable.
 */
export function withColumnLayout(columns: AnyColumn[], primaryKey: string | undefined): AnyColumn[] {
  return columns.map(column => {
    const { columns: children, meta } = shape(column)
    if (children) return { ...column, columns: withColumnLayout(children, primaryKey) } as AnyColumn
    const id = columnKey(column)
    if (id === undefined) return column
    const primary = id === primaryKey
    const locked = isLockedColumn(id)
    const bounds = columnSizeBounds(column, primary)
    const width = `var(${columnWidthVar(id)}, ${defaultColumnSize(column, primary)}px)`
    const widthStyle = { width, minWidth: width, maxWidth: width }
    const cellClass = columnCellClass(id)
    return {
      ...column,
      size: defaultColumnSize(column, primary),
      minSize: bounds.min,
      // AppDataTable clamps stored widths to `columnSizeBounds`; TanStack must not clamp the rendered
      // width, which adds the free space of the surface to one column (pinned offsets read it).
      maxSize: Number.MAX_SAFE_INTEGER,
      ...(locked ? { enableResizing: false, enablePinning: false } : {}),
      meta: {
        ...meta,
        class: {
          ...meta?.class,
          // A header that is not sticky is the positioning box of its resize handle.
          th: withClass(meta?.class?.th, ({ column: col }) =>
            [cellClass, col.getIsPinned() ? '' : 'relative', edgeClass(col)].join(' '),
          ),
          td: withClass(meta?.class?.td, ({ column: col }) => [cellClass, edgeClass(col)].join(' ')),
        },
        style: {
          ...meta?.style,
          th: withStyle(meta?.style?.th, widthStyle),
          td: withStyle(meta?.style?.td, widthStyle),
        },
      },
    } as AnyColumn
  })
}
