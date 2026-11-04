<script setup lang="ts" generic="T extends Record<string, any>">
import { useTemplateRef, computed, useSlots, defineComponent, type PropType, type VNode } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import type {
  TableColumn,
  SortingState,
  PaginationState,
  ColumnPinningState,
  VisibilityState,
  RowSelectionState,
} from '../../types/table.types'
import type { BulkAction } from '../../types/table.types'
import DataTableToolbar from './DataTableToolbar.vue'
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
const displayColumns = computed(() => withPrimaryColumn(props.columns, primaryKey.value))

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
        barClass: index === 0 || primary ? 'w-2/3' : 'w-1/2',
      }
    })
})

const forwardedTableSlots = computed(() =>
  Object.keys(slots).filter((name) => !SLOTS_NOT_FORWARDED_TO_TABLE.has(name)),
)

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
const rowListeners = computed(() => (props.rowOpen ? { click: onTableClick } : {}))

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
        class="relative w-full min-w-0 max-w-full flex-1 overflow-auto"
        aria-busy="true"
        data-testid="table-skeleton"
      >
        <span class="sr-only">Cargando</span>
        <table data-slot="base" class="min-w-full overflow-clip" aria-hidden="true">
          <thead data-slot="thead" class="relative" inert data-testid="table-skeleton-header">
            <tr data-slot="tr">
              <th
                v-for="column in skeletonColumns"
                :key="`skeleton-heading-${column.key}`"
                data-slot="th"
                class="border-b border-[var(--hf-border)] px-4 py-3.5 text-left text-sm font-semibold"
                :class="column.thClass"
                :style="column.select ? 'width:3rem;min-width:3rem;max-width:3rem;padding-inline:0.75rem 0' : undefined"
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
              :style="column.select ? 'width:3rem;min-width:3rem;max-width:3rem;padding-inline:0.75rem 0;overflow:visible' : undefined"
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
        v-model:column-pinning="columnPinning"
        v-model:column-visibility="columnVisibility"
        v-model:row-selection="rowSelection"
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
        class="w-full min-w-0 max-w-full flex-1"
        data-testid="table-view"
        v-on="rowListeners"
      >
        <template v-for="name in forwardedTableSlots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps ?? {}" />
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
