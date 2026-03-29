<script setup lang="ts" generic="T extends Record<string, any>">
import { useTemplateRef, computed } from 'vue'
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
    searchPlaceholder?: string
    showAddButton?: boolean
    addButtonText?: string
    addButtonIcon?: string
    showRefresh?: boolean
    // Bulk actions
    bulkActions?: BulkAction<T>[]
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
    searchPlaceholder: 'Buscar...',
    showAddButton: false,
    addButtonText: 'Agregar',
    addButtonIcon: 'i-lucide-plus',
    showRefresh: true,
    bulkActions: () => [],
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
      :global-filter="globalFilter"
      :search-placeholder="searchPlaceholder"
      :show-add-button="showAddButton"
      :add-button-text="addButtonText"
      :add-button-icon="addButtonIcon"
      :show-column-visibility="enableColumnVisibility"
      :show-refresh="showRefresh"
      :fetching="fetching"
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
    <UTable
      ref="table"
      v-model:sorting="sorting"
      v-model:column-pinning="columnPinning"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      :data="data"
      :columns="columns"
      :loading="loading"
      :empty="empty"
      sticky
      :sorting-options="{
        manualSorting: true,
      }"
      class="flex-1"
    >
      <template v-if="$slots.expanded" #expanded="slotProps">
        <slot name="expanded" v-bind="slotProps" />
      </template>

      <template v-if="$slots.empty" #empty>
        <slot name="empty" />
      </template>
    </UTable>

    <!-- Fetching overlay indicator -->
    <div v-if="fetching && !loading" class="flex justify-center">
      <UIcon name="i-lucide-loader-2" class="text-primary size-4 animate-spin" />
    </div>

    <!-- Pagination -->
    <DataTablePagination
      v-if="totalCount > 0"
      :page-index="pagination.pageIndex"
      :page-size="pagination.pageSize"
      :page-count="pageCount"
      :total-count="totalCount"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      :page-size-options="pageSizeOptions"
      :fetching="fetching"
      @update:page-index="handlePageIndexChange"
      @update:page-size="handlePageSizeChange"
    />

    <!-- Bulk Actions -->
    <DataTableBulkActions
      v-if="bulkActions.length > 0 && enableRowSelection"
      :selected-count="selectedCount"
      :total-count="totalCount"
      :actions="bulkActions"
      @clear-selection="handleClearSelection"
    />
  </div>
</template>
