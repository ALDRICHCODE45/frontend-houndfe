<script setup lang="ts" generic="T extends Record<string, any>">
import {
  useTemplateRef,
  computed,
  useSlots,
  defineComponent,
  nextTick,
  onMounted,
  provide,
  reactive,
  ref,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import {
  breakpointsTailwind,
  useBreakpoints,
  useEventListener,
  useResizeObserver,
} from '@vueuse/core'
import {
  FlexRender,
  type ColumnOrderState,
  type ColumnSizingInfoState,
  type ColumnSizingState,
  type Header,
} from '@tanstack/vue-table'
import type {
  TableColumn,
  SortingState,
  PaginationState,
  ColumnPinningState,
  VisibilityState,
  RowSelectionState,
} from '../../types/table.types'
import type { BulkAction } from '../../types/table.types'
import type { DropdownMenuItem } from '@nuxt/ui'
import DataTableToolbar from './DataTableToolbar.vue'
import DataTableHeaderCell from './DataTableHeaderCell.vue'
import DataTablePagination from './DataTablePagination.vue'
import DataTableBulkActions from './DataTableBulkActions.vue'
import { useClickableRow } from '../../composables/useClickableRow'
import EmptyState from '../EmptyState.vue'
import {
  declaredCellClasses,
  findPrimaryColumnKey,
  isUtilityColumn,
  PRIMARY_COLUMN_CLASS,
  columnKey,
  resolveSkeletonHeader,
  withPrimaryColumn,
} from './primaryColumn.utils'
import {
  columnCellClass,
  columnLabel,
  columnSizeBounds,
  columnWidthVar,
  defaultColumnSize,
  leafColumns,
  RESIZE_STEP,
  SHRINK_FLOOR,
  withColumnLayout,
} from './columnLayout.utils'
import {
  columnGroup,
  groupMembers,
  moveColumn as movedArrangement,
  placeColumn,
  screenOrder,
  withoutColumn,
  type ColumnArrangement,
  type ColumnGroup,
} from './columnArrange.utils'
import { useColumnDrag, type ColumnDropTarget } from './useColumnDrag'
import { DATA_TABLE_HEADER } from './headerContext'
import {
  DEFAULT_TABLE_DENSITY,
  isLockedColumn,
  lockedSide,
  sanitizeOrder,
  sanitizePinning,
  sanitizeSizing,
  type ColumnSizeBounds,
  type TableDensity,
} from './tableLayout'

/** Copy for the shared "nothing yet" state (`emptyState` prop). */
interface TableEmptyState {
  title: string
  description?: string
  actionLabel?: string
  actionIcon?: string
}

const SKELETON_ROW_COUNT = 5

const props = withDefaults(
  defineProps<{
    columns: TableColumn<T, unknown>[]
    data: T[]
    loading?: boolean
    fetching?: boolean
    empty?: string
    // Error state — when true, the table renders a distinct error block
    // INSTEAD of the empty placeholder, so a failed request is never masked
    // as "0 results". Consumers wire this to useServerTable's isError.
    error?: boolean
    /**
     * Title of the error state. Optional: the default is a fixed human
     * sentence. Pass a better one per list (`No se pudieron cargar los
     * productos`), never a server or HTTP message.
     */
    errorMessage?: string
    /**
     * Shared "nothing yet" state. When the list is empty (not loading, not
     * failed, not filtered) it renders `EmptyState kind="empty"` with this copy
     * and emits `empty-action` from its button. Unset → the plain `empty`
     * string behaves exactly as before.
     */
    emptyState?: TableEmptyState
    /**
     * The list is empty because search or filters matched nothing. Wins over
     * `emptyState`: renders `EmptyState kind="no-match"` titled `noMatchTitle`
     * with "Limpiar filtros", which emits `clear-filters`.
     */
    filtered?: boolean
    /**
     * Title of the no-match state when there is no search term (filters only).
     * With a search term the title is `Ningún resultado para «<term>»`.
     */
    noMatchTitle?: string
    // Pagination
    pageCount?: number
    totalCount?: number
    pageSizeOptions?: number[]
    showingFrom?: number
    showingTo?: number
    // Features
    enableColumnVisibility?: boolean
    enableRowSelection?: boolean
    // Toolbar
    showToolbar?: boolean
    searchPlaceholder?: string
    showAddButton?: boolean
    addButtonText?: string
    addButtonIcon?: string
    /**
     * Toolbar refresh button. Off by default: the error state's `Reintentar` is
     * the retry and background refresh shows in the table. A consumer that
     * passes it explicitly keeps its button.
     */
    showRefresh?: boolean
    /** Optional presentation boundary for toolbar content rendered through portals. */
    portalClass?: string
    /** Optional page-size menu boundary; independent from the toolbar opt-in. */
    paginationPortalClass?: string
    /**
     * Optional `data-testid` for the toolbar refresh button. Forwarded to
     * DataTableToolbar. Default `undefined` → no testid rendered. Used by
     * feature consumers that need to keep a stable testid (REQ-QAF-016) after
     * migrating off an external refresh button.
     */
    refreshButtonTestId?: string
    /**
     * Optional `data-testid` for the toolbar add button. Forwarded to
     * DataTableToolbar. Default `undefined` → no testid rendered. Used by
     * feature consumers that need to keep a stable testid (REQ-QAF-016) after
     * migrating off an external add button.
     */
    addButtonTestId?: string
    /**
     * Number of active filters the view applies. Rendered as a `UBadge` next
     * to the mobile "Filtros" trigger. Computed by the consuming view from
     * its existing filter state (status-tab, threshold, includeInactive, ...)
     * — the table itself does NOT derive the number. Default `0` → no badge.
     */
    activeFilterCount?: number
    // Bulk actions
    bulkActions?: BulkAction<T>[]
    /**
     * Optional whole-row click contract. When set, a click on a body row (outside
     * interactive children, with no modifier, on the primary button and with no
     * text selected) calls it with the row's data, and rows get `hf-clickable-row`.
     * Keyboard access stays on the row's primary button, so rows get no tabindex.
     * Table view only; cards rendered through slots bind `useClickableRow` themselves.
     * Default `undefined` → rows and listeners are exactly as before.
     */
    rowOpen?: (row: T) => void
    // Mobile rendering
    displayMode?: 'auto' | 'table' | 'cards'
    mobileRender?: 'table' | 'cards'
    mobileBreakpoint?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    loading: false,
    fetching: false,
    empty: 'No se encontraron resultados',
    error: false,
    errorMessage: 'No se pudo cargar la lista',
    emptyState: undefined,
    filtered: false,
    noMatchTitle: 'Ningún resultado',
    pageCount: 0,
    totalCount: 0,
    pageSizeOptions: () => [5, 10, 20, 50],
    showingFrom: 0,
    showingTo: 0,
    enableColumnVisibility: false,
    enableRowSelection: false,
    showToolbar: true,
    searchPlaceholder: 'Buscar...',
    showAddButton: false,
    addButtonText: 'Agregar',
    addButtonIcon: 'i-lucide-plus',
    showRefresh: false,
    refreshButtonTestId: undefined,
    addButtonTestId: undefined,
    activeFilterCount: 0,
    bulkActions: () => [],
    displayMode: 'auto',
    mobileRender: 'table',
    mobileBreakpoint: 'md',
  },
)

const emit = defineEmits<{
  add: []
  refresh: []
  'clear-filters': []
  /** The button of the shared empty state (`emptyState.actionLabel`) was clicked. */
  'empty-action': []
}>()

// v-model bindings for table state
const sorting = defineModel<SortingState>('sorting', { default: () => [] })
const pagination = defineModel<PaginationState>('pagination', {
  default: () => ({ pageIndex: 0, pageSize: 10 }),
})
const globalFilter = defineModel<string>('globalFilter', { default: '' })
const columnPinning = defineModel<ColumnPinningState>('columnPinning', {
  default: () => ({ left: [], right: [] }),
})
const columnVisibility = defineModel<VisibilityState>('columnVisibility', {
  default: () => ({}),
})
const rowSelection = defineModel<RowSelectionState>('rowSelection', {
  default: () => ({}),
})
// Column layout (premium tables). Every write goes through the setters below, which keep the
// selection column pinned first on the left and Acciones last on the right, unresizable.
const columnOrder = defineModel<ColumnOrderState>('columnOrder', { default: () => [] })
const columnSizing = defineModel<ColumnSizingState>('columnSizing', { default: () => ({}) })
/** Row density; `comfortable` is today's 64px row. The control arrives with the density menu. */
const density = defineModel<TableDensity>('density', { default: DEFAULT_TABLE_DENSITY })
const columnSizingInfo = ref<ColumnSizingInfoState>({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: [],
})

// Table ref for accessing tableApi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableRef = useTemplateRef<any>('table')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableApi = computed<any>(() => tableRef.value?.tableApi)

// Slot pass-through: forward any #xxx-header / #xxx-cell / #expanded / #empty
// slots from the parent directly to UTable underneath
const slots = useSlots()

// Slots owned by this wrapper (toolbar + card views); never forwarded to UTable.
const SLOTS_NOT_FORWARDED_TO_TABLE = new Set([
  'filters',
  'actions',
  'above-table',
  'cards',
  'mobile-card',
])

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobileViewport = breakpoints.smaller(() => props.mobileBreakpoint)
const isCardsMode = computed(() => {
  if (props.displayMode === 'cards') return true
  if (props.displayMode === 'table') return false
  return props.mobileRender === 'cards' && isMobileViewport.value
})
const isLoading = computed(() => props.loading || props.fetching)

// Shared empty / no-match state: only for a settled, successful, empty list.
// A consumer `#empty` slot always wins, and with neither prop set the plain
// `empty` string path below stays untouched.
const sharedEmptyKind = computed<'no-match' | 'empty' | null>(() => {
  if (props.data.length > 0 || props.loading || props.error) return null
  if (props.filtered) return 'no-match'
  return props.emptyState ? 'empty' : null
})
const noMatchTitleText = computed(() => {
  const term = globalFilter.value.trim()
  return term ? `Ningún resultado para «${term}»` : props.noMatchTitle
})
const showTableSkeleton = computed(() => props.loading && props.data.length === 0)

// C1: the name column has priority width. `meta.primary` picks it; the default is the first data
// column after the selection column.
const primaryKey = computed(() => findPrimaryColumnKey(props.columns, columnVisibility.value))
const displayColumns = computed(() =>
  withColumnLayout(withPrimaryColumn(props.columns, primaryKey.value), primaryKey.value),
)

// ── Column layout: order, pinning and widths ───────────────────────────────
const leaves = computed(() => leafColumns(props.columns))
const leafIds = computed(() => leaves.value.map(column => columnKey(column)!))
const columnInfo = computed(() => {
  const info = new Map<string, { label: string; size: number; bounds: ColumnSizeBounds }>()
  for (const column of leaves.value) {
    const id = columnKey(column)!
    const primary = id === primaryKey.value
    info.set(id, {
      label: columnLabel(column),
      size: defaultColumnSize(column, primary),
      bounds: columnSizeBounds(column, primary),
    })
  }
  return info
})
const boundsOf = (id: string) => columnInfo.value.get(id)?.bounds
const labelOf = (id: string) => columnInfo.value.get(id)?.label ?? id

const effectiveOrder = computed(() => sanitizeOrder(columnOrder.value, leafIds.value))
const effectivePinning = computed(() => sanitizePinning(columnPinning.value, leafIds.value))
const storedSizing = computed(() => sanitizeSizing(columnSizing.value, leafIds.value, boundsOf))
const visibleIds = computed(() => leafIds.value.filter(id => columnVisibility.value[id] !== false))

// The surface's inner width. When the columns are narrower, the free space goes to one column
// (the name column until the user sizes it, then the last centre column the user has not sized),
// so the table always fills the surface and user widths hold exactly. When they are wider, the
// columns the user has not sized shrink toward their floors first, so default widths still fit and
// the surface scrolls only once user widths or the floors make it unavoidable.
const containerWidth = ref(0)
const flexColumnId = computed(() => {
  const visible = new Set(visibleIds.value)
  const pinned = new Set([...effectivePinning.value.left!, ...effectivePinning.value.right!])
  const centre = effectiveOrder.value.filter(id => visible.has(id) && !pinned.has(id) && !isLockedColumn(id))
  const primary = primaryKey.value !== undefined && visible.has(primaryKey.value) ? primaryKey.value : undefined
  const unsized = (id: string | undefined) => id !== undefined && storedSizing.value[id] === undefined
  if (unsized(primary)) return primary
  return [...centre].reverse().find(unsized) ?? primary ?? centre[centre.length - 1]
})
const columnWidths = computed<Record<string, number>>(() => {
  const widths: Record<string, number> = {}
  for (const id of visibleIds.value) {
    widths[id] = storedSizing.value[id] ?? columnInfo.value.get(id)?.size ?? 0
  }
  const surface = Math.floor(containerWidth.value)
  if (surface <= 0) return widths
  const free = surface - Object.values(widths).reduce((sum, width) => sum + width, 0)
  const flex = flexColumnId.value
  if (free > 0 && flex !== undefined) widths[flex]! += free
  if (free < 0) shrinkToFit(widths, -free)
  return widths
})
/** The narrowest a default width shrinks to: the floor, or the column's own minimum if larger. */
function shrinkFloor(id: string) {
  const info = columnInfo.value.get(id)
  return info ? Math.max(info.bounds.min, Math.min(SHRINK_FLOOR, info.size)) : 0
}
/** Takes `overflow` px from the unsized columns, in proportion to how far each can shrink. */
function shrinkToFit(widths: Record<string, number>, overflow: number) {
  const slack = Object.keys(widths)
    .filter(id => !isLockedColumn(id) && storedSizing.value[id] === undefined)
    .map(id => ({ id, room: widths[id]! - shrinkFloor(id) }))
    .filter(column => column.room > 0)
  const room = slack.reduce((sum, column) => sum + column.room, 0)
  if (room === 0) return
  const cut = Math.min(overflow, room)
  let rest = cut
  for (const column of slack) {
    const share = Math.floor((cut * column.room) / room)
    widths[column.id]! -= share
    rest -= share
  }
  // Rounding leftovers, one pixel at a time from the columns that can still shrink.
  while (rest > 0) {
    const column = slack.find(candidate => widths[candidate.id]! > shrinkFloor(candidate.id))
    if (!column) break
    widths[column.id]! -= 1
    rest -= 1
  }
}
const tableWidth = computed(() => Object.values(columnWidths.value).reduce((sum, width) => sum + width, 0))
// What TanStack reads as `column.getSize()` (pinned offsets, the resize handler's start width).
const effectiveSizing = computed<ColumnSizingState>(() => {
  const sizing: ColumnSizingState = {}
  for (const [id, info] of columnInfo.value) sizing[id] = storedSizing.value[id] ?? info.size
  return { ...sizing, ...columnWidths.value }
})
const widthVars = computed(() => {
  const vars: Record<string, string> = { '--hf-table-w': `${tableWidth.value}px` }
  for (const [id, width] of Object.entries(columnWidths.value)) vars[columnWidthVar(id)] = `${width}px`
  return vars
})

function setColumnOrder(next: ColumnOrderState) {
  columnOrder.value = sanitizeOrder(next, leafIds.value)
}
function setColumnPinning(next: ColumnPinningState) {
  columnPinning.value = sanitizePinning(next, leafIds.value)
}
// TanStack hands over the whole sizing state: a width that differs from the rendered one is the
// user's, an unchanged one keeps what was stored, and a missing one goes back to its default.
function setColumnSizing(next: ColumnSizingState) {
  const result: ColumnSizingState = {}
  for (const [id, width] of Object.entries(next)) {
    if (width !== effectiveSizing.value[id]) result[id] = width
    else if (storedSizing.value[id] !== undefined) result[id] = storedSizing.value[id]!
  }
  columnSizing.value = sanitizeSizing(result, leafIds.value, boundsOf)
}
/** Sets one column's width, clamped to its bounds, and returns the width set. */
function setColumnWidth(id: string, width: number): number {
  const next = sanitizeSizing({ ...storedSizing.value, [id]: width }, leafIds.value, boundsOf)
  columnSizing.value = next
  return next[id] ?? width
}
function resizeColumnBy(id: string, delta: number): number {
  return setColumnWidth(id, (columnWidths.value[id] ?? effectiveSizing.value[id] ?? 0) + delta)
}

// ── Resize handle: pointer, keyboard and autofit ───────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onResizeStart(event: MouseEvent, header: Header<any, unknown>) {
  if (event.button !== 0) return
  header.getResizeHandler()(event)
}

// Header keyboard, from anywhere in a header cell: Alt+←/→ resizes (the handle itself also takes
// plain arrows), Alt+Shift+←/→ moves, Shift+F10 or the menu key opens ⋯, and Enter/Space on the
// header sorts where the column sorts (else opens ⋯).
function onTableKeydown(event: KeyboardEvent) {
  const target = event.target instanceof Element ? event.target : null
  const th = target?.closest<HTMLElement>('th[data-slot="th"]')
  const id = th ? headerColumnId(th) : undefined
  if (!th || !id) return
  const arrangeable = !isLockedColumn(id)
  const plain = !event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey
  if ((event.key === 'Enter' || event.key === ' ') && plain && target?.matches('[data-hf-header]')) {
    event.preventDefault()
    activateHeader(id)
    return
  }
  if (arrangeable && (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) {
    event.preventDefault()
    openMenuId.value = id
    return
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  if (event.ctrlKey || event.metaKey) return
  const delta = event.key === 'ArrowLeft' ? -1 : 1
  if (event.altKey && event.shiftKey) {
    if (!arrangeable) return
    event.preventDefault()
    shiftColumn(id, delta)
    focusHeader(id)
    return
  }
  if (event.shiftKey) return
  const onHandle = target?.matches('[data-resize-handle]') ?? false
  if (!event.altKey && !onHandle) return
  if (!th.querySelector('[data-resize-handle]')) return
  event.preventDefault()
  const width = resizeColumnBy(id, delta * RESIZE_STEP)
  announce(`Ancho de ${labelOf(id)}: ${width} px`)
}

/** Fits a column to its widest rendered cell (header included), within its bounds. */
function autofitColumn(id: string): number | undefined {
  const surface = surfaceEl.value
  if (!surface) return undefined
  const cells = surface.querySelectorAll<HTMLElement>(`.${columnCellClass(id)}`)
  const probe = document.createElement('div')
  probe.setAttribute('data-hf-measure', '')
  probe.setAttribute('aria-hidden', 'true')
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;width:max-content;white-space:nowrap'
  surface.appendChild(probe)
  let widest = 0
  for (const cell of cells) {
    const style = getComputedStyle(cell)
    probe.style.font = style.font
    probe.replaceChildren(...Array.from(cell.childNodes, node => node.cloneNode(true)))
    probe.querySelectorAll('[data-resize-handle]').forEach(node => node.remove())
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    widest = Math.max(widest, probe.getBoundingClientRect().width + padding)
  }
  probe.remove()
  return widest > 0 ? setColumnWidth(id, Math.ceil(widest)) : undefined
}

// Width tooltip while dragging: «Estado · 152 px».
const resizingColumnId = computed(() => columnSizingInfo.value.isResizingColumn || undefined)
const resizeTip = ref<{ text: string; left: number; top: number }>()
watch(
  [resizingColumnId, columnWidths],
  ([id]) => {
    const handle = id
      ? Array.from(surfaceEl.value?.querySelectorAll<HTMLElement>('[data-resize-handle]') ?? []).find(
          el => el.dataset.columnId === id,
        )
      : undefined
    if (!id || !handle) {
      resizeTip.value = undefined
      return
    }
    const rect = handle.getBoundingClientRect()
    resizeTip.value = { text: `${labelOf(id)} · ${columnWidths.value[id]} px`, left: rect.right, top: rect.top }
  },
  { flush: 'post' },
)

// ── Pinned edge: shown only while content is scrolled under it ─────────────
const skeletonRef = useTemplateRef<HTMLElement>('skeleton')
const surfaceEl = computed<HTMLElement | undefined>(
  () => (tableRef.value?.$el as HTMLElement | undefined) ?? skeletonRef.value ?? undefined,
)
const scrolledLeft = ref(false)
const scrolledRight = ref(false)
function measureSurface() {
  const el = surfaceEl.value
  if (!el) return
  // clientWidth rounds a fractional width up; the floored box width (minus its borders) is what
  // really fits, so the table never overflows by a pixel.
  const box = el.getBoundingClientRect().width
  const style = getComputedStyle(el)
  const borders = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0)
  containerWidth.value = box > 0 ? Math.min(el.clientWidth, Math.floor(box - borders)) : el.clientWidth
  const max = el.scrollWidth - el.clientWidth
  scrolledLeft.value = el.scrollLeft > 0
  scrolledRight.value = max > 1 && el.scrollLeft < max - 1
}
useEventListener(surfaceEl, 'scroll', measureSurface, { passive: true })
useResizeObserver(surfaceEl, measureSurface)
onMounted(measureSurface)
watch(tableWidth, () => nextTick(measureSurface))
// A string: UTable merges `class` through tailwind-variants, which drops object syntax.
const surfaceClasses = computed(() =>
  [scrolledLeft.value ? 'hf-table-scrolled-left' : '', scrolledRight.value ? 'hf-table-scrolled-right' : '']
    .filter(Boolean)
    .join(' '),
)

// C2: the loading skeleton keeps the real header row and `min(pageSize, 5)` rows, so the surface
// does not change height when the data arrives.
const SkeletonHeaderNode = defineComponent({
  props: { node: { type: Object as PropType<VNode>, required: true } },
  setup: props => () => props.node,
})
const skeletonRowCount = computed(() =>
  Math.max(1, Math.min(pagination.value.pageSize, SKELETON_ROW_COUNT)),
)
const skeletonColumns = computed(() => {
  const hidden = columnVisibility.value
  return props.columns
    .filter(column => {
      const key = columnKey(column)
      return key === undefined || hidden[key] !== false
    })
    .map((column, index) => {
      const key = columnKey(column)
      const classes = declaredCellClasses(column)
      const primary = key !== undefined && key === primaryKey.value
      const utility = isUtilityColumn(column)
      return {
        key: key ?? `column-${index}`,
        select: key === 'select',
        actions: utility && key !== 'select',
        header: resolveSkeletonHeader(column),
        thClass: [classes.th, primary ? PRIMARY_COLUMN_CLASS : ''],
        tdClass: [classes.td, primary ? PRIMARY_COLUMN_CLASS : ''],
        width: key === undefined ? undefined : `var(${columnWidthVar(key)})`,
        barClass: index === 0 || primary ? 'w-2/3' : 'w-1/2',
      }
    })
})

// Every leaf header is rendered here (the consumer's `#<id>-header` slot or the column's header,
// plus the resize handle), so those slots are not forwarded as is.
const headerSlotNames = computed(() => new Set(leafIds.value.map(id => `${id}-header`)))
const forwardedTableSlots = computed(() =>
  Object.keys(slots).filter(
    (name) => !SLOTS_NOT_FORWARDED_TO_TABLE.has(name) && !headerSlotNames.value.has(name),
  ),
)

// ── Arranging columns: header menu, keyboard moves, drag and announcements ─────────────
// Columns whose header is a SortableHeader (they register themselves through the context).
const sortableCounts = reactive(new Map<string, number>())
provide(DATA_TABLE_HEADER, {
  registerSortable(id: string) {
    sortableCounts.set(id, (sortableCounts.get(id) ?? 0) + 1)
    return () => {
      const count = (sortableCounts.get(id) ?? 1) - 1
      if (count > 0) sortableCounts.set(id, count)
      else sortableCounts.delete(id)
    }
  },
})
const isSortable = (id: string) => sortableCounts.has(id)

// One polite live region; the key re-renders the text so a repeated message is read again.
const announcement = ref('')
const announcementKey = ref(0)
function announce(text: string) {
  announcement.value = text
  announcementKey.value += 1
}

const SIDE_TEXT = { left: 'a la izquierda', right: 'a la derecha' } as const
const arrangement = computed<ColumnArrangement>(() => ({
  order: effectiveOrder.value,
  pinning: effectivePinning.value,
}))
const isVisible = (id: string) => columnVisibility.value[id] !== false
const groupOf = (id: string) => columnGroup(id, effectivePinning.value)
const pinnedSide = (id: string) => {
  const group = groupOf(id)
  return group === 'center' ? undefined : group
}

// Header cells carry the column's cell class (`hf-colid-<id>`); this maps it back to the id.
const idByCellClass = computed(() => new Map(leafIds.value.map(id => [columnCellClass(id), id])))
function headerColumnId(th: Element): string | undefined {
  for (const name of Array.from(th.classList)) {
    const id = idByCellClass.value.get(name)
    if (id !== undefined) return id
  }
  return undefined
}
const headerTargets = () => Array.from(surfaceEl.value?.querySelectorAll<HTMLElement>('[data-hf-header]') ?? [])
function focusHeader(id: string) {
  nextTick(() => headerTargets().find(el => el.dataset.columnId === id)?.focus())
}

function applyArrangement(next: ColumnArrangement) {
  if (next.order.join() !== effectiveOrder.value.join()) setColumnOrder(next.order)
  if (JSON.stringify(next.pinning) !== JSON.stringify(effectivePinning.value)) setColumnPinning(next.pinning)
}
function positionText(id: string, next: ColumnArrangement) {
  const order = screenOrder(next, isVisible)
  return `posición ${order.indexOf(id) + 1} de ${order.length}`
}
/** Applies a new place for `id` and announces a move, a pin or an unpin. */
function arrangeColumn(id: string, next: ColumnArrangement) {
  const before = groupOf(id)
  const after = columnGroup(id, next.pinning)
  const moved = screenOrder(next, isVisible).join() !== screenOrder(arrangement.value, isVisible).join()
  applyArrangement(next)
  const label = labelOf(id)
  if (after !== before) {
    announce(after === 'center' ? `Columna ${label} desfijada` : `Columna ${label} fijada ${SIDE_TEXT[after]}`)
  } else if (moved) {
    announce(`Columna ${label} movida a la ${positionText(id, next)}`)
  }
}
const canShift = (id: string, delta: number) => movedArrangement(arrangement.value, id, delta, isVisible) !== undefined
function shiftColumn(id: string, delta: number) {
  const next = movedArrangement(arrangement.value, id, delta, isVisible)
  if (next) arrangeColumn(id, next)
  else announce(`Columna ${labelOf(id)} ya está en el borde de su grupo`)
}
function pinColumn(id: string, side: 'left' | 'right' | false) {
  const from = groupOf(id)
  const target: ColumnGroup = side === false ? 'center' : side
  const members = groupMembers(target, withoutColumn(arrangement.value, id), isVisible)
  // Pinned left goes last on the left, pinned right first on the right; unpinned returns to the
  // edge of the centre it came from.
  const index = target === 'left' || (target === 'center' && from === 'right') ? members.length : 0
  arrangeColumn(id, placeColumn(arrangement.value, id, target, index, isVisible))
}

function setSort(id: string, desc: boolean | undefined) {
  sorting.value = desc === undefined ? sorting.value.filter(sort => sort.id !== id) : [{ id, desc }]
  const label = labelOf(id)
  announce(desc === undefined ? 'Sin orden' : `Ordenado por ${label}, ${desc ? 'descendente' : 'ascendente'}`)
}
function activateHeader(id: string) {
  const column = tableApi.value?.getColumn(id)
  if (isSortable(id) && column) column.toggleSorting(column.getIsSorted() === 'asc')
  else if (!isLockedColumn(id)) openMenuId.value = id
}
/** A click on the header sorts where the column sorts; the ⋯ button opens the menu. */
function onHeaderClick(id: string) {
  if (isSortable(id)) activateHeader(id)
}

function resetColumnWidth(id: string) {
  const rest = { ...storedSizing.value }
  delete rest[id]
  columnSizing.value = rest
  announce(`Ancho de ${labelOf(id)} restablecido`)
}
function fitColumn(id: string) {
  const width = autofitColumn(id)
  if (width !== undefined) announce(`Ancho de ${labelOf(id)}: ${width} px`)
}
function hideColumn(id: string) {
  // The focus goes to the neighbour once the header is gone.
  const order = screenOrder(arrangement.value, isVisible)
  const index = order.indexOf(id)
  refocusId.value = order[index + 1] ?? order[index - 1]
  columnVisibility.value = { ...columnVisibility.value, [id]: false }
  announce(`Columna ${labelOf(id)} oculta`)
}

// ⋯ menu: one open at a time; on close the focus returns to the header (or its neighbour).
const openMenuId = ref<string>()
const refocusId = ref<string>()
function onMenuOpen(id: string, open: boolean) {
  if (open) openMenuId.value = id
  else if (openMenuId.value === id) openMenuId.value = undefined
}
function onMenuClosed(id: string) {
  const target = refocusId.value ?? id
  refocusId.value = undefined
  focusHeader(target)
}

function columnMenuItems(id: string): DropdownMenuItem[][] {
  const groups: DropdownMenuItem[][] = []
  if (isSortable(id)) {
    const sort: DropdownMenuItem[] = [
      { label: 'Ordenar ascendente', icon: 'i-lucide-arrow-up-narrow-wide', onSelect: () => setSort(id, false) },
      { label: 'Ordenar descendente', icon: 'i-lucide-arrow-down-wide-narrow', onSelect: () => setSort(id, true) },
    ]
    if (sorting.value.some(item => item.id === id)) {
      sort.push({ label: 'Quitar orden', icon: 'i-lucide-x', onSelect: () => setSort(id, undefined) })
    }
    groups.push(sort)
  }
  const group = groupOf(id)
  const unpin: DropdownMenuItem = { label: 'Desfijar', icon: 'i-lucide-pin-off', onSelect: () => pinColumn(id, false) }
  groups.push([
    group === 'left'
      ? unpin
      : { label: 'Fijar a la izquierda', icon: 'i-lucide-panel-left', onSelect: () => pinColumn(id, 'left') },
    group === 'right'
      ? unpin
      : { label: 'Fijar a la derecha', icon: 'i-lucide-panel-right', onSelect: () => pinColumn(id, 'right') },
  ])
  groups.push([
    {
      label: 'Mover a la izquierda',
      icon: 'i-lucide-arrow-left',
      kbds: ['alt', 'shift', 'arrowleft'],
      disabled: !canShift(id, -1),
      onSelect: () => shiftColumn(id, -1),
    },
    {
      label: 'Mover a la derecha',
      icon: 'i-lucide-arrow-right',
      kbds: ['alt', 'shift', 'arrowright'],
      disabled: !canShift(id, 1),
      onSelect: () => shiftColumn(id, 1),
    },
  ])
  groups.push([
    { label: 'Ajustar ancho al contenido', icon: 'i-lucide-move-horizontal', onSelect: () => fitColumn(id) },
    {
      label: 'Restablecer ancho',
      icon: 'i-lucide-rotate-ccw',
      disabled: storedSizing.value[id] === undefined,
      onSelect: () => resetColumnWidth(id),
    },
  ])
  if (id !== primaryKey.value) {
    groups.push([{ label: 'Ocultar columna', icon: 'i-lucide-eye-off', onSelect: () => hideColumn(id) }])
  }
  return groups
}

function headerName(id: string) {
  const side = pinnedSide(id)
  const sort = sorting.value.find(item => item.id === id)
  return [
    labelOf(id),
    side ? `fijada ${SIDE_TEXT[side]}` : '',
    sort ? `orden ${sort.desc ? 'descendente' : 'ascendente'}` : '',
  ]
    .filter(Boolean)
    .join(', ')
}

// Drop target under the pointer: the gap before or after the header hit (pinned headers paint over
// the scrolled ones, so they are hit first). A locked edge column stands for its pinned side.
function dropTargetAt(id: string, x: number): ColumnDropTarget | undefined {
  const surface = surfaceEl.value
  if (!surface) return undefined
  const bounds = surface.getBoundingClientRect()
  const cells = Array.from(surface.querySelectorAll<HTMLElement>('thead th[data-slot="th"]'))
    .map(th => ({ th, id: headerColumnId(th), rect: th.getBoundingClientRect() }))
    .filter((cell): cell is { th: HTMLElement; id: string; rect: DOMRect } => cell.id !== undefined)
  if (cells.length === 0) return undefined
  const ranked = [...cells.filter(cell => cell.th.hasAttribute('data-pinned')), ...cells.filter(cell => !cell.th.hasAttribute('data-pinned'))]
  const first = cells[0]!
  const last = cells[cells.length - 1]!
  const hit =
    ranked.find(cell => x >= cell.rect.left && x < cell.rect.right) ??
    (x < first.rect.left ? first : x >= last.rect.right ? last : undefined)
  if (!hit || hit.id === id) return undefined
  const clamp = (value: number) => Math.min(bounds.right, Math.max(bounds.left, value))
  const base = withoutColumn(arrangement.value, id)
  const locked = lockedSide(hit.id)
  if (locked === 'left') return { group: 'left', index: 0, x: clamp(hit.rect.right) }
  if (locked === 'right') {
    return { group: 'right', index: groupMembers('right', base, isVisible).length, x: clamp(hit.rect.left) }
  }
  const before = x < hit.rect.left + hit.rect.width / 2
  const group = groupOf(hit.id)
  const index = groupMembers(group, base, isVisible).indexOf(hit.id) + (before ? 0 : 1)
  return { group, index, x: clamp(before ? hit.rect.left : hit.rect.right) }
}

const columnDrag = useColumnDrag({
  surface: () => surfaceEl.value,
  canDrag: id => !isLockedColumn(id) && !isCardsMode.value,
  labelOf,
  cellsOf: id => Array.from(surfaceEl.value?.querySelectorAll<HTMLElement>(`.${columnCellClass(id)}`) ?? []),
  targetAt: dropTargetAt,
  onDrop(id, target) {
    arrangeColumn(id, placeColumn(arrangement.value, id, target.group, target.index, isVisible))
    focusHeader(id)
  },
  onCancel: () => announce('Movimiento cancelado'),
})
const dragGhost = columnDrag.ghost
const dropLine = columnDrag.line

// Width announced once a pointer resize ends.
watch(resizingColumnId, (now, before) => {
  if (before && !now) announce(`Ancho de ${labelOf(before)}: ${columnWidths.value[before]} px`)
})

// Selected count for bulk actions
const selectedCount = computed(() => Object.keys(rowSelection.value).length)

// Handle page index change from pagination component
function handlePageIndexChange(newIndex: number) {
  pagination.value = { ...pagination.value, pageIndex: newIndex }
}

// Handle page size change with smart recalculation
function handlePageSizeChange(newSize: number) {
  const currentFirstItem = pagination.value.pageIndex * pagination.value.pageSize
  const newPageIndex = Math.floor(currentFirstItem / newSize)
  pagination.value = { pageIndex: newPageIndex, pageSize: newSize }
}

// ── Whole-row click (only when `rowOpen` is set) ───────────────────────────
const { onClick: openRowOnClick } = useClickableRow<T>(row => props.rowOpen?.(row), {
  focusable: false,
})
// Body rows only: UTable renders `#expanded` detail rows as extra `tr`s without `data-selected`.
const BODY_ROW_SELECTOR = 'tbody > tr[data-slot="tr"][data-selected]'
const rowMeta = computed(() =>
  props.rowOpen ? { class: { tr: 'hf-clickable-row' } } : undefined,
)
const tableListeners = computed(() => ({
  keydown: onTableKeydown,
  ...(props.rowOpen ? { click: onTableClick } : {}),
}))

function onTableClick(event: MouseEvent) {
  const tr = event.target instanceof Element ? event.target.closest(BODY_ROW_SELECTOR) : null
  const table = event.currentTarget instanceof Element ? event.currentTarget : null
  if (!tr || !table) return
  const index = Array.from(table.querySelectorAll(BODY_ROW_SELECTOR)).indexOf(tr)
  const row = tableApi.value?.getRowModel().rows[index]?.original as T | undefined
  if (row !== undefined) openRowOnClick(event, row)
}

function handleClearSelection() {
  rowSelection.value = {}
}

defineExpose({
  /** The TanStack table (undefined until the table renders). */
  get tableApi() {
    return tableApi.value
  },
  /** Rendered width per visible column, in px. */
  columnWidths,
  /** Default width and bounds per column. */
  columnInfo,
  setColumnWidth,
  resizeColumnBy,
  autofitColumn,
})
</script>

<template>
  <div class="flex w-full min-w-0 max-w-full flex-col gap-4">
    <!-- Toolbar -->
    <DataTableToolbar
      v-if="props.showToolbar"
      :global-filter="globalFilter"
      :search-placeholder="props.searchPlaceholder"
      :show-add-button="props.showAddButton"
      :add-button-text="props.addButtonText"
      :add-button-icon="props.addButtonIcon"
      :show-column-visibility="props.enableColumnVisibility && !isCardsMode"
      :show-refresh="props.showRefresh"
      :fetching="props.fetching"
      :portal-class="props.portalClass"
      :table-api="tableApi"
      :refresh-button-test-id="props.refreshButtonTestId"
      :add-button-test-id="props.addButtonTestId"
      :active-filter-count="props.activeFilterCount"
      @update:global-filter="globalFilter = $event"
      @add="emit('add')"
      @refresh="emit('refresh')"
      @clear-filters="emit('clear-filters')"
    >
      <!-- Forward a slot only when the screen provides it: an always-present wrapper renders an
           empty fragment, which made the toolbar draw a mobile "Filtros" button (and an empty
           actions row) on lists that have neither. -->
      <template v-if="$slots.filters" #filters>
        <slot name="filters" />
      </template>
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </DataTableToolbar>

    <!-- Extra content above table -->
    <slot name="above-table" />

    <!-- Table -->
    <!-- All slots are forwarded to UTable dynamically:
         - Named column slots: #name-cell, #status-cell, #actions-header, etc.
         - Special slots:      #expanded, #empty, #loading, #caption
         This allows the parent to use Vue template syntax instead of h() in column defs -->
    <template v-if="isCardsMode">
      <!-- Error state: wins over BOTH the custom #cards slot and the mobile
           fallback, so a failed request is never masked as an empty card grid.
           (W3 fix — previously the error block lived only in the v-else branch
           below, which is unreachable when a parent provides the #cards slot.) -->
      <EmptyState
        v-if="props.error"
        kind="error"
        :title="props.errorMessage"
        action-label="Reintentar"
        action-test-id="cards-error-retry"
        class="w-full min-w-0 max-w-full"
        data-testid="cards-error-state"
        @action="emit('refresh')"
      />

      <slot
        v-else-if="slots.cards"
        name="cards"
        :data="props.data"
        :loading="isLoading"
        :empty="props.empty"
      />

      <template v-else>
        <div
          v-if="isLoading"
          class="grid w-full min-w-0 max-w-full gap-3"
          aria-busy="true"
          data-testid="mobile-cards-loading"
        >
          <span class="sr-only">Cargando</span>
          <div
            v-for="index in 3"
            :key="`mobile-skeleton-${index}`"
            class="flex animate-pulse flex-col gap-3 rounded-[var(--hf-radius-card)] border border-[var(--hf-border)] bg-[var(--hf-surface-muted)] p-4"
            aria-hidden="true"
            data-testid="mobile-card-skeleton"
          >
            <span
              class="hf-skeleton h-4 w-3/5 rounded"
              data-testid="mobile-card-skeleton-title"
            />
            <span
              class="hf-skeleton h-3 w-2/5 rounded"
              data-testid="mobile-card-skeleton-secondary"
            />
            <span
              class="hf-skeleton h-6 w-20 rounded-full"
              data-testid="mobile-card-skeleton-badge"
            />
            <div
              class="flex items-center justify-between border-t border-[var(--hf-border)] pt-3"
              data-testid="mobile-card-skeleton-footer"
            >
              <span class="hf-skeleton h-3 w-28 rounded" />
              <span class="hf-skeleton h-3 w-12 rounded" />
            </div>
          </div>
        </div>

        <EmptyState
          v-else-if="sharedEmptyKind === 'no-match'"
          kind="no-match"
          :title="noMatchTitleText"
          action-label="Limpiar filtros"
          class="w-full min-w-0 max-w-full"
          data-testid="mobile-empty-state"
          @action="emit('clear-filters')"
        />

        <EmptyState
          v-else-if="sharedEmptyKind === 'empty' && props.emptyState"
          kind="empty"
          :title="props.emptyState.title"
          :description="props.emptyState.description"
          :action-label="props.emptyState.actionLabel"
          :action-icon="props.emptyState.actionIcon"
          class="w-full min-w-0 max-w-full"
          data-testid="mobile-empty-state"
          @action="emit('empty-action')"
        />

        <div
          v-else-if="props.data.length === 0 || !slots['mobile-card']"
          class="flex min-h-32 w-full min-w-0 max-w-full items-center justify-center rounded-lg border border-dashed border-default px-4 py-8 text-sm text-muted"
          data-testid="mobile-empty-state"
        >
          {{ props.empty }}
        </div>

        <div v-else class="grid w-full min-w-0 max-w-full gap-3" data-testid="mobile-cards-list">
          <slot
            v-for="(row, index) in props.data"
            :key="index"
            name="mobile-card"
            :row="row"
            :index="index"
          />
        </div>
      </template>
    </template>

    <template v-else>
      <!-- Error state for the table view: shown instead of UTable so a failed
           request never renders as the generic "No se encontraron resultados"
           empty row inside UTable. -->
      <EmptyState
        v-if="props.error"
        kind="error"
        :title="props.errorMessage"
        action-label="Reintentar"
        action-test-id="table-error-retry"
        class="w-full min-w-0 max-w-full"
        data-testid="table-error-state"
        @action="emit('refresh')"
      />

      <!-- First load with no rows yet: the table's own geometry (real header, same cell classes, the
           primary column floor) with placeholder bars, and no border of its own, so nothing jumps
           when the rows arrive. A background refetch with rows keeps UTable's progress bar. -->
      <div
        v-else-if="showTableSkeleton"
        ref="skeleton"
        class="relative w-full min-w-0 max-w-full flex-1 overflow-auto"
        :style="widthVars"
        aria-busy="true"
        data-testid="table-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <table data-slot="base" class="w-(--hf-table-w) min-w-full table-fixed overflow-clip" aria-hidden="true">
          <thead data-slot="thead" class="relative" inert data-testid="table-skeleton-header">
            <tr data-slot="tr">
              <th
                v-for="column in skeletonColumns"
                :key="`skeleton-heading-${column.key}`"
                data-slot="th"
                class="border-b border-[var(--hf-border)] px-4 py-3.5 text-left text-sm font-semibold"
                :class="column.thClass"
                :style="[
                  column.width ? { width: column.width, minWidth: column.width, maxWidth: column.width } : {},
                  column.select ? 'padding-inline:0.75rem 0' : '',
                ]"
              >
                <span v-if="column.header.kind === 'text'" :class="column.actions ? 'sr-only' : undefined">
                  {{ column.header.text }}
                </span>
                <SkeletonHeaderNode v-else-if="column.header.kind === 'node'" :node="column.header.node" />
                <span
                  v-else-if="!column.select && !column.actions"
                  class="hf-skeleton block h-2.5 w-14 rounded"
                />
              </th>
            </tr>
          </thead>
          <!-- Rows sit straight under the table (the DOM builds them without a tbody): the loading
               state has no body section, which is what "no rows yet" means to the screens' specs. -->
          <tr
            v-for="row in skeletonRowCount"
            :key="`skeleton-row-${row}`"
            data-slot="tr"
            class="h-16"
            data-testid="table-skeleton-row"
          >
            <td
              v-for="column in skeletonColumns"
              :key="`skeleton-cell-${row}-${column.key}`"
              data-slot="td"
              class="border-b border-[var(--hf-border)] p-4 text-sm"
              :class="column.tdClass"
              :style="[
                column.width ? { width: column.width, minWidth: column.width, maxWidth: column.width } : {},
                column.select ? 'padding-inline:0.75rem 0;overflow:visible' : '',
              ]"
            >
              <span
                class="hf-skeleton block animate-pulse"
                :class="
                  column.select
                    ? 'size-4 rounded'
                    : column.actions
                      ? 'ml-auto size-6 rounded-md'
                      : ['h-3 rounded', column.barClass]
                "
              />
            </td>
          </tr>
        </table>
      </div>

      <UTable
        v-else
        ref="table"
        v-model:sorting="sorting"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
        v-model:column-sizing-info="columnSizingInfo"
        :column-order="effectiveOrder"
        :column-pinning="effectivePinning"
        :column-sizing="effectiveSizing"
        :column-pinning-options="{ enableColumnPinning: true }"
        :column-sizing-options="{ enableColumnResizing: true, columnResizeMode: 'onChange' }"
        :row-selection-options="{ enableRowSelection: props.enableRowSelection }"
        :data="props.data"
        :columns="displayColumns"
        :loading="isLoading"
        loading-color="primary"
        loading-animation="carousel"
        :empty="props.empty"
        :meta="rowMeta"
        sticky
        :sorting-options="{
          manualSorting: true,
        }"
        :ui="{ base: 'w-(--hf-table-w) min-w-full table-fixed' }"
        :class="['w-full min-w-0 max-w-full flex-1', surfaceClasses]"
        :style="widthVars"
        :data-density="density"
        data-testid="table-view"
        @update:column-order="setColumnOrder"
        @update:column-pinning="setColumnPinning"
        @update:column-sizing="setColumnSizing"
        v-on="tableListeners"
      >
        <template v-for="name in forwardedTableSlots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
        <template v-for="id in leafIds" #[`${id}-header`]="headerProps">
          <DataTableHeaderCell
            v-if="!isLockedColumn(id)"
            :key="`cell-${id}`"
            :column-id="id"
            :label="labelOf(id)"
            :name="headerName(id)"
            :sortable="isSortable(id)"
            :pinned="pinnedSide(id)"
            :items="columnMenuItems(id)"
            :open="openMenuId === id"
            @update:open="onMenuOpen(id, $event)"
            @pointerdown="columnDrag.onPointerDown($event, id)"
            @activate="onHeaderClick(id)"
            @menu-closed="onMenuClosed(id)"
          >
            <slot v-if="slots[`${id}-header`]" :name="`${id}-header`" v-bind="headerProps" />
            <FlexRender
              v-else-if="!headerProps.header.isPlaceholder"
              :render="headerProps.column.columnDef.header"
              :props="headerProps"
            />
          </DataTableHeaderCell>
          <template v-else>
            <slot v-if="slots[`${id}-header`]" :name="`${id}-header`" v-bind="headerProps" />
            <FlexRender
              v-else-if="!headerProps.header.isPlaceholder"
              :key="`header-${id}`"
              :render="headerProps.column.columnDef.header"
              :props="headerProps"
            />
          </template>
          <span
            v-if="headerProps.column.getCanResize()"
            :key="`resize-${id}`"
            role="separator"
            aria-orientation="vertical"
            :aria-label="`Cambiar ancho de ${labelOf(id)}`"
            :aria-valuenow="columnWidths[id]"
            :aria-valuemin="columnInfo.get(id)?.bounds.min"
            :aria-valuemax="columnInfo.get(id)?.bounds.max"
            tabindex="-1"
            title="Arrastra para cambiar el ancho; doble clic para ajustarlo al contenido"
            data-resize-handle
            :data-column-id="id"
            :data-resizing="resizingColumnId === id || undefined"
            class="absolute inset-y-0 right-0 z-[2] w-2 cursor-col-resize touch-none"
            @mousedown.stop="onResizeStart($event, headerProps.header)"
            @click.stop
            @dblclick.stop.prevent="autofitColumn(id)"
          />
        </template>
        <template v-if="sharedEmptyKind && !slots.empty" #empty>
          <EmptyState
            v-if="sharedEmptyKind === 'no-match'"
            kind="no-match"
            :title="noMatchTitleText"
            action-label="Limpiar filtros"
            @action="emit('clear-filters')"
          />
          <EmptyState
            v-else-if="props.emptyState"
            kind="empty"
            :title="props.emptyState.title"
            :description="props.emptyState.description"
            :action-label="props.emptyState.actionLabel"
            :action-icon="props.emptyState.actionIcon"
            @action="emit('empty-action')"
          />
        </template>
      </UTable>
    </template>

    <!-- Column drag: the ghost under the pointer and the drop line between the target columns -->
    <div
      v-if="dragGhost"
      class="hf-table-drag-ghost"
      :style="{ left: `${dragGhost.x}px`, top: `${dragGhost.y}px` }"
      aria-hidden="true"
      data-testid="table-drag-ghost"
    >
      <UIcon name="i-lucide-grip-vertical" class="size-3.5" />{{ dragGhost.label }}
    </div>
    <div
      v-if="dropLine"
      class="hf-table-drop-line"
      :style="{ left: `${dropLine.x - 1}px`, top: `${dropLine.top}px`, height: `${dropLine.height}px` }"
      aria-hidden="true"
      data-testid="table-drop-line"
    />

    <!-- Announcements of column moves, pins, widths and sorting -->
    <div class="sr-only" aria-live="polite" aria-atomic="true" data-testid="table-announcer">
      <span :key="announcementKey">{{ announcement }}</span>
    </div>

    <!-- Width while dragging a column edge -->
    <div
      v-if="resizeTip"
      class="pointer-events-none fixed z-50 -translate-y-full rounded px-2 py-1 text-xs font-semibold tabular-nums"
      style="background-color: var(--hf-ink); color: var(--hf-surface)"
      :style="{ left: `${resizeTip.left + 8}px`, top: `${resizeTip.top - 4}px` }"
      aria-hidden="true"
      data-testid="table-resize-tip"
    >
      {{ resizeTip.text }}
    </div>

    <!-- Pagination -->
    <DataTablePagination
      v-if="props.totalCount > 0"
      :page-index="pagination.pageIndex"
      :page-size="pagination.pageSize"
      :page-count="props.pageCount"
      :total-count="props.totalCount"
      :showing-from="props.showingFrom"
      :showing-to="props.showingTo"
      :page-size-options="props.pageSizeOptions"
      :fetching="props.fetching"
      :portal-class="props.paginationPortalClass"
      @update:page-index="handlePageIndexChange"
      @update:page-size="handlePageSizeChange"
    />

    <!-- Bulk Actions -->
    <DataTableBulkActions
      v-if="props.bulkActions.length > 0 && props.enableRowSelection"
      :selected-count="selectedCount"
      :total-count="props.totalCount"
      :actions="props.bulkActions"
      @clear-selection="handleClearSelection"
    />
  </div>
</template>
