<script setup lang="ts">
import { computed } from 'vue'
import {
  AppDataTable,
  DEFAULT_TABLE_DENSITY,
  SortableHeader,
  type TableDensity,
} from '@/core/shared/components/DataTable'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { ColumnOrderState, ColumnSizingState } from '@tanstack/vue-table'
import type {
  ColumnPinningState,
  PaginationState,
  SortingState,
  VisibilityState,
} from '@/core/shared/types/table.types'
import { useProductColumns } from '../composables/useProductColumns'
import type { Product } from '../interfaces/product.types'
import {
  getProductStockCompactLabel,
  getProductStockDisplay,
  getProductTypeBadge,
  productStatusConfig,
  stockNeedsAttention,
} from '../utils/productStatusConfig.utils'

const props = defineProps<{
  items: Product[]
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
  canCreate: boolean
  loading?: boolean
  fetching?: boolean
  error?: boolean
  errorMessage?: string
  /** Search or filters are active: an empty list reads as "no match", not "nothing yet". */
  filtered?: boolean
  /** The active search text, named in the no-match title. */
  searchTerm?: string
  activeFilterCount?: number
  totalCount?: number
  pageCount?: number
  showingFrom?: number
  showingTo?: number
  pageSizeOptions?: number[]
  /** The bound layout is persisted (ProductsView's `persistKey`): confirms «Guardado en tu vista». */
  persistLayout?: boolean
}>()

const emit = defineEmits<{
  open: [product: Product]
  edit: [product: Product]
  delete: [product: Product]
  add: []
  refresh: []
  'clear-filters': []
  'reset-columns': []
}>()

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
const columnOrder = defineModel<ColumnOrderState>('columnOrder', { default: () => [] })
const columnSizing = defineModel<ColumnSizingState>('columnSizing', { default: () => ({}) })
const density = defineModel<TableDensity>('density', { default: DEFAULT_TABLE_DENSITY })

const { columns } = useProductColumns()

function statusOf(product: Product) {
  return productStatusConfig[product.status]
}

const emptyState = computed(() => ({
  title: 'Aún no hay productos',
  description: 'Aquí aparecerán tus productos y servicios.',
  actionLabel: props.canCreate ? 'Crear producto' : undefined,
  actionIcon: 'i-lucide-package-plus',
}))
const noMatchTitle = computed(() => {
  const term = props.searchTerm?.trim()
  return term ? `Ningún resultado para «${term}»` : 'Ningún resultado'
})

function actionsFor(): RowAction[] {
  return [
    ...(props.canRead ? [{ key: 'open', label: 'Ver detalles', icon: 'i-lucide-eye' }] : []),
    ...(props.canUpdate ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
    ...(props.canDelete
      ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
      : []),
  ]
}

function onAction(key: string, product: Product) {
  if (key === 'open') emit('open', product)
  else if (key === 'edit') emit('edit', product)
  else if (key === 'delete') emit('delete', product)
}

// The whole row opens the details: AppDataTable's `row-open` for table rows,
// `rowProps` for cards. The name button is the tab stop, so neither is focusable.
function open(product: Product) {
  if (props.canRead) emit('open', product)
}
const clickable = useClickableRow<Product>(open, { focusable: false })
const rowOpen = computed(() => (props.canRead ? open : undefined))
</script>

<template>
  <AppDataTable
    v-model:sorting="sorting"
    v-model:pagination="pagination"
    v-model:global-filter="globalFilter"
    v-model:column-pinning="columnPinning"
    v-model:column-visibility="columnVisibility"
    v-model:column-order="columnOrder"
    v-model:column-sizing="columnSizing"
    v-model:density="density"
    :persist-layout="persistLayout"
    :columns="columns"
    :data="items"
    :loading="loading"
    :fetching="fetching"
    :error="error"
    :error-message="errorMessage"
    :empty-state="emptyState"
    :filtered="filtered"
    :no-match-title="noMatchTitle"
    :active-filter-count="activeFilterCount"
    :page-count="pageCount"
    :total-count="totalCount"
    :showing-from="showingFrom"
    :showing-to="showingTo"
    :page-size-options="pageSizeOptions"
    :show-add-button="canCreate"
    :row-open="rowOpen"
    display-mode="auto"
    mobile-render="cards"
    search-placeholder="Buscar productos..."
    add-button-text="Nuevo producto"
    add-button-icon="i-lucide-package-plus"
    enable-column-visibility
    class="hf-data-table"
    portal-class="hf-theme hf-ui hf-shell-products-portal"
    @add="emit('add')"
    @empty-action="emit('add')"
    @refresh="emit('refresh')"
    @clear-filters="emit('clear-filters')"
    @reset-columns="emit('reset-columns')"
  >
    <template #filters><slot name="filters" /></template>

    <template #name-header="{ column }">
      <SortableHeader :column="column" label="Nombre" />
    </template>
    <template #categoryName-header="{ column }">
      <SortableHeader :column="column" label="Categoría" />
    </template>
    <template #brandName-header="{ column }">
      <SortableHeader :column="column" label="Marca" />
    </template>
    <template #priceCents-header="{ column }">
      <SortableHeader :column="column" label="Precio" />
    </template>
    <template #quantity-header="{ column }">
      <SortableHeader :column="column" label="Stock" />
    </template>
    <template #actions-header><span class="sr-only">Acciones</span></template>

    <template #name-cell="{ row }">
      <button
        v-if="canRead"
        type="button"
        class="hf-row-primary text-left"
        @click="open(row.original)"
      >
        {{ row.original.name }}
      </button>
      <span v-else class="hf-row-primary">{{ row.original.name }}</span>
      <span v-if="row.original.sku" class="hf-row-secondary">{{ row.original.sku }}</span>
    </template>

    <template #status-cell="{ row }">
      <StatusBadge
        :label="statusOf(row.original).label"
        :tone="statusOf(row.original).tone"
      />
    </template>

    <template #type-cell="{ row }">
      <span class="inline-flex items-center gap-1.5 text-[var(--hf-muted)]">
        <UIcon :name="getProductTypeBadge(row.original.type).icon" class="size-4" aria-hidden="true" />
        {{ getProductTypeBadge(row.original.type).label }}
      </span>
    </template>

    <template #categoryName-cell="{ row }">{{ row.original.categoryName }}</template>
    <template #brandName-cell="{ row }">{{ row.original.brandName }}</template>

    <template #priceCents-cell="{ row }">
      <span class="hf-figure block font-semibold">{{ formatCentsMXN(row.original.priceCents) }}</span>
    </template>

    <template #quantity-cell="{ row }">
      <StatusBadge
        v-if="stockNeedsAttention(row.original)"
        :label="getProductStockDisplay(row.original).label"
        :tone="getProductStockDisplay(row.original).tone"
        aria-prefix="Stock:"
      />
      <span v-else class="hf-figure block">{{ getProductStockDisplay(row.original).label }}</span>
    </template>

    <template #actions-cell="{ row }">
      <RowActionsMenu
        :actions="actionsFor()"
        :row-label="row.original.name"
        portal-class="hf-shell-products-portal"
        @select="onAction($event, row.original)"
      />
    </template>

    <template #mobile-card="{ row }">
      <article v-bind="clickable.rowProps(row)" class="product-card" data-testid="product-card">
        <div class="product-card-heading">
          <div class="product-card-title">
            <button
              v-if="canRead"
              type="button"
              class="hf-row-primary text-left"
              @click="open(row)"
            >
              {{ row.name }}
            </button>
            <span v-else class="hf-row-primary">{{ row.name }}</span>
            <span v-if="row.sku" class="hf-row-secondary">{{ row.sku }}</span>
          </div>
          <RowActionsMenu
            class="product-card-menu"
            :actions="actionsFor()"
            :row-label="row.name"
            portal-class="hf-shell-products-portal"
            @select="onAction($event, row)"
          />
        </div>
        <div class="product-card-badges">
          <StatusBadge
            :label="statusOf(row).label"
            :tone="statusOf(row).tone"
          />
          <StatusBadge
            v-if="stockNeedsAttention(row)"
            :label="getProductStockCompactLabel(row)"
            :tone="getProductStockDisplay(row).tone"
            aria-prefix="Stock:"
          />
        </div>
        <div class="product-card-footer">
          <span class="hf-figure">
            <span class="font-semibold">{{ formatCentsMXN(row.priceCents) }}</span>
            <template v-if="!stockNeedsAttention(row)">
              · {{ getProductStockCompactLabel(row) }}
            </template>
          </span>
          <span class="product-card-date">{{ formatShortDateTime(row.updatedAt) }}</span>
        </div>
      </article>
    </template>
  </AppDataTable>
</template>

<style scoped>
.product-card {
  min-width: 0;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface);
  padding: 16px;
}
.product-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.product-card-title {
  min-width: 0;
}
/* The name wraps to two lines instead of cutting after one. */
.product-card-title .hf-row-primary {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
  white-space: normal;
}
.product-card-menu {
  margin: -8px -8px 0 0;
  flex-shrink: 0;
}
.product-card-badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.product-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid var(--hf-border);
  margin-top: 12px;
  padding-top: 12px;
  color: var(--hf-text);
  font-size: 13px;
}
.product-card-date {
  color: var(--hf-muted);
  white-space: nowrap;
}
</style>
