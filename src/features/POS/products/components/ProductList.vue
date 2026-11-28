<script setup lang="ts">
import { computed } from 'vue'
import {
  AppDataTable,
  DEFAULT_TABLE_DENSITY,
  SortableHeader,
  type TableDensity,
} from '@/core/shared/components/DataTable'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import ReservedStockLabel from '@/core/shared/components/ReservedStockLabel.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { ColumnOrderState, ColumnSizingState } from '@tanstack/vue-table'
import type {
  ColumnPinningState,
  PaginationState,
  SortingState,
  TableMobileField,
  TableSortOption,
  VisibilityState,
} from '@/core/shared/types/table.types'
import { useProductColumns } from '../composables/useProductColumns'
import type { Product } from '../interfaces/product.types'
import {
  getProductReservedStock,
  getProductStockCompactLabel,
  getProductStockDisplay,
  getProductStockTone,
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

// Phones (mobile-tables S4, A · Lista densa): type icon · full name · SKU and category · the price
// with the stock under it (a warning when it runs low). Desktop ignores `meta.mobile`.
const PRODUCT_MOBILE: Record<string, TableMobileField<Product>[]> = {
  name: [
    { role: 'lead', icon: (product) => getProductTypeBadge(product.type).icon },
    { role: 'primary', value: (product) => product.name },
    { role: 'secondary', value: (product) => product.sku },
  ],
  categoryName: [{ role: 'secondary', value: (product) => product.categoryName }],
  priceCents: [{ role: 'figure', value: (product) => formatCentsMXN(product.priceCents) }],
  quantity: [{ role: 'figureNote', value: (product) => stockNote(product), tone: (product) => stockNoteTone(product) }],
}
function stockNote(product: Product): string {
  const label = getProductStockCompactLabel(product)
  return getProductStockTone(product) === 'warning' ? `Quedan ${label}` : label
}
function stockNoteTone(product: Product) {
  const tone = getProductStockTone(product)
  if (tone === 'error') return 'danger' as const
  return tone === 'warning' ? ('warning' as const) : undefined
}
const columns = useProductColumns().columns.map((column) => {
  const id = column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')
  const mobile = PRODUCT_MOBILE[id]
  return mobile ? { ...column, meta: { ...column.meta, mobile } } : column
})

// The phone «Ordenar» menu: the orderings of the sortable columns.
const SORT_OPTIONS: TableSortOption[] = [
  { label: 'Nombre · A–Z', value: 'name:asc' },
  { label: 'Nombre · Z–A', value: 'name:desc' },
  { label: 'Precio · menor a mayor', value: 'priceCents:asc' },
  { label: 'Precio · mayor a menor', value: 'priceCents:desc' },
  { label: 'Stock · menor a mayor', value: 'quantity:asc' },
  { label: 'Stock · mayor a menor', value: 'quantity:desc' },
]

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

// The whole row (table or phone) opens the details through AppDataTable's `row-open`. The name
// button is the tab stop, so the row itself is not focusable.
function open(product: Product) {
  if (props.canRead) emit('open', product)
}
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
    mobile-render="rows"
    :sort-options="SORT_OPTIONS"
    :item-label="{ one: 'producto', other: 'productos' }"
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
      <ReservedStockLabel
        v-if="getProductReservedStock(row.original)"
        class="block"
        v-bind="getProductReservedStock(row.original)!"
      />
      <!-- Owner S13: the low-stock alert stays next to the reserved label. -->
      <StatusBadge
        v-if="stockNeedsAttention(row.original)"
        :label="getProductStockDisplay(row.original).label"
        :tone="getProductStockDisplay(row.original).tone"
        aria-prefix="Stock:"
      />
      <span
        v-else-if="!getProductReservedStock(row.original)"
        class="hf-figure block"
      >{{ getProductStockDisplay(row.original).label }}</span>
    </template>

    <template #actions-cell="{ row }">
      <RowActionsMenu
        :actions="actionsFor()"
        :row-label="row.original.name"
        portal-class="hf-shell-products-portal"
        @select="onAction($event, row.original)"
      />
    </template>

    <!-- Phone row (A): only what the price column cannot say — an inactive or out-of-stock status
         and the reserved split. No ⋮: the product's actions live in its detail. -->
    <template #mobile-status="{ row }">
      <StatusBadge
        v-if="row.status !== 'active'"
        :label="statusOf(row).label"
        :tone="statusOf(row).tone"
      />
      <ReservedStockLabel v-if="getProductReservedStock(row)" v-bind="getProductReservedStock(row)!" />
    </template>
  </AppDataTable>
</template>
