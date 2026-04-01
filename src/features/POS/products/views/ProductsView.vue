<script setup lang="ts">
import { computed, ref } from 'vue'
import { AppDataTable, SortableHeader, SelectColumn } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { productApi } from '../api/product.api'
import { useProductColumns } from '../composables/useProductColumns'
import type { Product } from '../interfaces/product.types'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import CreateProductSlideover from '../components/CreateProductSlideover.vue'
import type { CreateProductDto } from '../interfaces/Dtos/createProduct.dto'
import {
  getProductRowItems,
  getStockColor,
  productStatusConfig,
} from '../utils/productStatusConfig.utils'

const { columns, currencyFormatter } = useProductColumns()
const authStore = useAuthStore()

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

const isCreateOpen = ref<boolean>(false)

const canCreateProduct = computed(() => authStore.userCan('create', 'Product'))
const canUpdateProduct = computed(() => authStore.userCan('update', 'Product'))
const canDeleteProduct = computed(() => authStore.userCan('delete', 'Product'))
const canManageProductActions = computed(() => canUpdateProduct.value || canDeleteProduct.value)

function handleAdd() {
  if (!canCreateProduct.value) return
  isCreateOpen.value = true
}

function handleCreateProduct(data: CreateProductDto) {
  console.log('Producto a crear:', data)
  // TODO: Llamar a la API real para crear el producto
  // Después de crear, refrescar la tabla:
  // refresh()
}

const bulkActions = computed<BulkAction<Product>[]>(() => {
  const actions: BulkAction<Product>[] = []

  if (canDeleteProduct.value) {
    actions.push({
      id: 'delete',
      label: 'Eliminar',
      icon: 'i-lucide-trash-2',
      variant: 'destructive',
      onClick: (rows) => console.log('Delete selected:', rows),
    })
  }

  actions.push({
    id: 'export',
    label: 'Exportar',
    icon: 'i-lucide-download',
    onClick: (rows) => console.log('Export selected:', rows),
  })

  return actions
})
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
          :show-add-button="canCreateProduct"
          search-placeholder="Buscar productos..."
          add-button-text="Nuevo Producto"
          add-button-icon="i-lucide-package-plus"
          enable-column-visibility
          :enable-row-selection="bulkActions.length > 0"
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
              :color="productStatusConfig[(row.original as Product).status].color"
              variant="outline"
              size="sm"
            >
              {{ productStatusConfig[(row.original as Product).status].label }}
            </UBadge>
          </template>

          <!-- ── Acciones ───────────────────────────────────────── -->
          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManageProductActions"
              :items="
                getProductRowItems(row.original, {
                  canUpdate: canUpdateProduct,
                  canDelete: canDeleteProduct,
                })
              "
              :content="{ align: 'end' }"
            >
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
