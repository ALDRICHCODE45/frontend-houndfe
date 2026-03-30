<script setup lang="ts">
import { ref } from 'vue'
import { AppDataTable, SortableHeader, SelectColumn } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import { productApi } from '../api/product.api'
import { useProductColumns } from '../composables/useProductColumns'
import type { Product, CreateProductData } from '../interfaces/product.types'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import CreateProductSlideover from '../components/CreateProductSlideover.vue'

const { columns, currencyFormatter } = useProductColumns()

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  refresh,
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

const statusConfig = {
  active: { color: 'success' as const, label: 'Activo' },
  inactive: { color: 'neutral' as const, label: 'Inactivo' },
  out_of_stock: { color: 'error' as const, label: 'Sin Stock' },
} as const

function getStockColor(stock: number) {
  if (stock === 0) return 'error' as const
  if (stock < 10) return 'warning' as const
  return 'success' as const
}

function getRowItems(product: Product) {
  return [
    [{ label: 'Editar', onSelect: () => console.log('edit', product.id) }],
    [
      {
        label: 'Eliminar',
        color: 'error',
        onSelect: () => console.log('delete', product.id),
      },
    ],
  ]
}

const isCreateOpen = ref(false)

function handleAdd() {
  isCreateOpen.value = true
}

function handleCreateProduct(data: CreateProductData) {
  console.log('Producto a crear:', data)
  // TODO: Llamar a la API real para crear el producto
  // Después de crear, refrescar la tabla:
  // refresh()
}

const bulkActions: BulkAction<Product>[] = [
  {
    id: 'delete',
    label: 'Eliminar',
    icon: 'i-lucide-trash-2',
    variant: 'destructive',
    onClick: (rows) => console.log('Delete selected:', rows),
  },
  {
    id: 'export',
    label: 'Exportar',
    icon: 'i-lucide-download',
    onClick: (rows) => console.log('Export selected:', rows),
  },
]
</script>

<template>
  <div class="flex flex-col gap-6 px-10">
    <!-- SlideOver de creación -->
    <CreateProductSlideover v-model:open="isCreateOpen" @submit="handleCreateProduct" />

    <!-- Card wrapper — tabla envuelta como en PF2 -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <TableHeaderDescription
          description="Gestión de inventario y catálogo de productos"
          title="Productos"
        />
      </template>
      <div class="px-6 py-5">
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
        >
          <!-- ── Select Header & Cell ─────────────────────────────── -->
          <template #select-header="{ table }">
            <SelectColumn mode="header" :table="table" />
          </template>

          <template #select-cell="{ row }">
            <SelectColumn mode="cell" :row="row" />
          </template>

          <!-- ── Sortable Headers ─────────────────────────────────── -->
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #category-header="{ column }">
            <SortableHeader :column="column" label="Categoría" />
          </template>

          <template #price-header="{ column }">
            <SortableHeader :column="column" label="Precio" />
          </template>

          <template #stock-header="{ column }">
            <SortableHeader :column="column" label="Stock" />
          </template>

          <!-- ── Nombre ─────────────────────────────────────────── -->
          <template #name-cell="{ row }">
            <span>{{ row.original.name }}</span>
          </template>

          <!-- ── SKU ───────────────────────────────────────────── -->
          <template #sku-cell="{ row }">
            <span class="font-mono text-xs text-muted">{{ row.original.sku }}</span>
          </template>

          <!-- ── Precio ─────────────────────────────────────────── -->
          <template #price-cell="{ row }">
            <span class="font-medium tabular-nums">
              {{ currencyFormatter.format(row.original.price) }}
            </span>
          </template>

          <!-- ── Stock ──────────────────────────────────────────── -->
          <template #stock-cell="{ row }">
            <UBadge
              :color="getStockColor(row.original.stock)"
              variant="subtle"
              size="sm"
              class="font-mono font-semibold"
            >
              {{ row.original.stock }}
            </UBadge>
          </template>

          <!-- ── Estado ─────────────────────────────────────────── -->
          <template #status-cell="{ row }">
            <UBadge
              :color="statusConfig[(row.original as Product).status].color"
              variant="outline"
              size="sm"
            >
              {{ statusConfig[(row.original as Product).status].label }}
            </UBadge>
          </template>

          <!-- ── Acciones ───────────────────────────────────────── -->
          <template #actions-cell="{ row }">
            <UDropdownMenu :items="getRowItems(row.original)" :content="{ align: 'end' }">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="size-7"
              />
            </UDropdownMenu>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
