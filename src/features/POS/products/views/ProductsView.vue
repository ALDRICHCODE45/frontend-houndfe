<script setup lang="ts">
import { AppDataTable } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import { productApi } from '../api/product.api'
import { useProductColumns } from '../composables/useProductColumns'
import type { Product } from '../interfaces/product.types'

const { columns } = useProductColumns()

const {
  // State (v-model for AppDataTable)
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  // Derived data
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  // Actions
  refresh,
  // Info
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useServerTable<Product>({
  queryKey: productQueryKeys.paginated(),
  queryFn: (params) => productApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'pos-products',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

function handleAdd() {
  // TODO: open create product modal
  console.log('Add product clicked')
}

const bulkActions: BulkAction<Product>[] = [
  {
    id: 'delete',
    label: 'Eliminar',
    icon: 'i-lucide-trash-2',
    variant: 'destructive',
    onClick: (rows) => {
      console.log('Delete selected:', rows)
    },
  },
  {
    id: 'export',
    label: 'Exportar',
    icon: 'i-lucide-download',
    onClick: (rows) => {
      console.log('Export selected:', rows)
    },
  },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Productos</h1>
      <p class="text-muted mt-1">Gestión de inventario y catálogo de productos</p>
    </div>

    <!-- DataTable -->
    <AppDataTable
      v-model:sorting="sorting"
      v-model:pagination="pagination"
      v-model:global-filter="globalFilter"
      v-model:column-pinning="columnPinning"
      v-model:column-visibility="columnVisibility"
      v-model:row-selection="rowSelection"
      :columns="columns"
      :data="data"
      :loading="isLoading"
      :fetching="isFetching"
      :page-count="pageCount"
      :total-count="totalCount"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      :page-size-options="pageSizeOptions"
      :bulk-actions="bulkActions"
      search-placeholder="Buscar productos..."
      show-add-button
      add-button-text="Nuevo Producto"
      add-button-icon="i-lucide-package-plus"
      enable-column-visibility
      enable-row-selection
      empty="No se encontraron productos"
      @add="handleAdd"
      @refresh="refresh"
    />
  </div>
</template>
