<script setup lang="ts" generic="T extends Record<string, any>">
import { useTemplateRef, computed, useSlots } from 'vue'
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

const props = withDefaults(
  defineProps<{
    columns: TableColumn<T, unknown>[]
    data: T[]
    loading?: boolean
    fetching?: boolean
    empty?: string
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
    showRefresh?: boolean
    // Bulk actions
    bulkActions?: BulkAction<T>[]
    // Mobile rendering
    displayMode?: 'auto' | 'table' | 'cards'
    mobileRender?: 'table' | 'cards'
    mobileBreakpoint?: 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  {
    loading: false,
    fetching: false,
    empty: 'No se encontraron resultados',
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
    showRefresh: true,
    bulkActions: () => [],
    displayMode: 'auto',
    mobileRender: 'table',
    mobileBreakpoint: 'md',
  },
)

const emit = defineEmits<{
  add: []
  refresh: []
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

function handleClearSelection() {
  rowSelection.value = {}
}
</script>

<template>
  <div class="flex flex-col gap-4">
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
      :table-api="tableApi"
      @update:global-filter="globalFilter = $event"
      @add="emit('add')"
      @refresh="emit('refresh')"
    >
      <template #filters>
        <slot name="filters" />
      </template>
      <template #actions>
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
      <slot
        v-if="slots.cards"
        name="cards"
        :data="props.data"
        :loading="isLoading"
        :empty="props.empty"
      />

      <template v-else>
        <div
          v-if="isLoading"
          class="grid gap-3"
          data-testid="mobile-cards-loading"
        >
          <div
            v-for="index in 3"
            :key="`mobile-skeleton-${index}`"
            class="h-28 animate-pulse rounded-lg border border-default bg-elevated"
            data-testid="mobile-card-skeleton"
          />
        </div>

        <div
          v-else-if="props.data.length === 0 || !slots['mobile-card']"
          class="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-default px-4 py-8 text-sm text-muted"
          data-testid="mobile-empty-state"
        >
          {{ props.empty }}
        </div>

        <div
          v-else
          class="grid gap-3"
          data-testid="mobile-cards-list"
        >
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

    <UTable
      v-else
      ref="table"
      v-model:sorting="sorting"
      v-model:column-pinning="columnPinning"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      :data="props.data"
      :columns="props.columns"
      :loading="isLoading"
      loading-color="primary"
      loading-animation="carousel"
      :empty="props.empty"
      sticky
      :sorting-options="{
        manualSorting: true,
      }"
      class="flex-1"
      data-testid="table-view"
    >
      <template v-for="name in forwardedTableSlots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </UTable>

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
