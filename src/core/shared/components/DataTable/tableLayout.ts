import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  VisibilityState,
} from '@tanstack/vue-table'

/**
 * The user's layout of one table, persisted per `persistKey`. Version 1 replaced the old
 * `{ pinning, visibility }` shape, which `normalizeTableLayout` still reads.
 */
export const TABLE_LAYOUT_VERSION = 1

/** Row height presets: Compacta 40 / Normal 48 / Cómoda 64 (today's rows). */
export type TableDensity = 'compact' | 'normal' | 'comfortable'
export const TABLE_DENSITIES: readonly TableDensity[] = ['compact', 'normal', 'comfortable']
export const DEFAULT_TABLE_DENSITY: TableDensity = 'comfortable'

export interface TableLayout {
  version: typeof TABLE_LAYOUT_VERSION
  order: ColumnOrderState
  pinning: ColumnPinningState
  sizing: ColumnSizingState
  visibility: VisibilityState
  density: TableDensity
}

export type TableLayoutDefaults = Partial<Omit<TableLayout, 'version'>>

/** The selection column is locked at the left edge. */
export const SELECT_COLUMN_ID = 'select'
/** The Acciones column is locked at the right edge (PendingApprovalsView names it `acciones`). */
export const ACTIONS_COLUMN_IDS: readonly string[] = ['actions', 'acciones']

/** The edge a locked column is held at, or `undefined` for a column the user can arrange. */
export function lockedSide(id: string): 'left' | 'right' | undefined {
  if (id === SELECT_COLUMN_ID) return 'left'
  return ACTIONS_COLUMN_IDS.includes(id) ? 'right' : undefined
}

export const isLockedColumn = (id: string) => lockedSide(id) !== undefined

type Ids = readonly string[] | undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []

const known = (ids: Ids) => (id: string) => ids === undefined || ids.includes(id)

const unique = (list: string[]) => [...new Set(list)]

/**
 * Column order with unknown ids dropped and new columns appended (when `ids` is given), the
 * selection column first and the Acciones column last.
 */
export function sanitizeOrder(order: unknown, ids?: Ids): ColumnOrderState {
  const list = unique(stringList(order)).filter(known(ids))
  const full = ids === undefined ? list : [...list, ...ids.filter(id => !list.includes(id))]
  return [
    ...full.filter(id => lockedSide(id) === 'left'),
    ...full.filter(id => !isLockedColumn(id)),
    ...full.filter(id => lockedSide(id) === 'right'),
  ]
}

/**
 * Pinning with unknown ids dropped and the locked columns held at their edges: the selection column
 * first on the left, the Acciones column last on the right. With `ids`, a locked column that exists
 * is always pinned; without them, a locked id is only moved to its edge.
 */
export function sanitizePinning(pinning: unknown, ids?: Ids): ColumnPinningState {
  const source = isRecord(pinning) ? pinning : {}
  const keep = known(ids)
  const left = unique(stringList(source.left)).filter(keep)
  const right = unique(stringList(source.right)).filter(id => keep(id) && !left.includes(id))
  const present = (side: 'left' | 'right') => {
    const candidates = ids ?? [...left, ...right]
    return candidates.filter(id => lockedSide(id) === side)
  }
  return {
    left: [...unique(present('left')), ...left.filter(id => !isLockedColumn(id))],
    right: [...right.filter(id => !isLockedColumn(id)), ...unique(present('right'))],
  }
}

export interface ColumnSizeBounds {
  min: number
  max: number
}

/** Widths of the arrangeable columns only, rounded and clamped to each column's bounds. */
export function sanitizeSizing(
  sizing: unknown,
  ids?: Ids,
  bounds?: (id: string) => ColumnSizeBounds | undefined,
): ColumnSizingState {
  if (!isRecord(sizing)) return {}
  const keep = known(ids)
  const result: ColumnSizingState = {}
  for (const [id, value] of Object.entries(sizing)) {
    if (!keep(id) || isLockedColumn(id) || typeof value !== 'number' || !Number.isFinite(value)) continue
    const limit = bounds?.(id)
    result[id] = Math.round(limit ? Math.min(limit.max, Math.max(limit.min, value)) : Math.max(0, value))
  }
  return result
}

export function sanitizeVisibility(visibility: unknown, ids?: Ids): VisibilityState {
  if (!isRecord(visibility)) return {}
  const keep = known(ids)
  const result: VisibilityState = {}
  for (const [id, value] of Object.entries(visibility)) {
    if (keep(id) && typeof value === 'boolean') result[id] = value
  }
  return result
}

export const sanitizeDensity = (density: unknown): TableDensity =>
  TABLE_DENSITIES.includes(density as TableDensity) ? (density as TableDensity) : DEFAULT_TABLE_DENSITY

export function createTableLayout(defaults: TableLayoutDefaults = {}, ids?: Ids): TableLayout {
  return normalizeTableLayout(undefined, defaults, ids)
}

/**
 * Reads a stored layout of any version (the old `{ pinning, visibility }` included) into the current
 * shape. A missing or unreadable field falls back to its default; with `ids`, columns that no longer
 * exist are dropped and new ones appended.
 */
export function normalizeTableLayout(raw: unknown, defaults: TableLayoutDefaults = {}, ids?: Ids): TableLayout {
  const source = isRecord(raw) ? raw : {}
  const pick = <K extends keyof TableLayoutDefaults>(key: K) => (key in source ? source[key] : defaults[key])
  return {
    version: TABLE_LAYOUT_VERSION,
    order: sanitizeOrder(pick('order') ?? [], ids),
    pinning: sanitizePinning(pick('pinning') ?? { left: [], right: [] }, ids),
    sizing: sanitizeSizing(pick('sizing') ?? {}, ids),
    visibility: sanitizeVisibility(pick('visibility') ?? {}, ids),
    density: sanitizeDensity(pick('density')),
  }
}
