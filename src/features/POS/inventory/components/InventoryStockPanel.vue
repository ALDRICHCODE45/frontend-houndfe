<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { AdjustmentResult } from '../interfaces/inventory.types'
import { useInventoryContext } from '../composables/useInventoryAccess'
import { useProductStock } from '../composables/useProductStock'
import { useStockMovements } from '../composables/useStockMovements'
import { adjustmentTargetFor, bucketKind, bucketRows, kardexFilters, untrackedLabel, type BucketRow } from '../utils/stock'
import StockAdjustmentDialog from './StockAdjustmentDialog.vue'
import StockKardex from './StockKardex.vue'

const props = defineProps<{ productId: string }>()
const context = useInventoryContext()
const { stock, apply, refresh: refreshStock, isFetching, error } = useProductStock(() => props.productId, context)

const kardexFilter = shallowRef<{ kind: 'lot' | 'variant'; id: string } | null>(null)
watch(() => props.productId, () => { kardexFilter.value = null })
const movements = useStockMovements(() => ({
  productId: props.productId,
  ...(kardexFilter.value?.kind === 'lot' && { lotId: kardexFilter.value.id }),
  ...(kardexFilter.value?.kind === 'variant' && { variantId: kardexFilter.value.id }),
}), context)

const rows = computed(() => stock.value ? bucketRows(stock.value) : [])
const hasLots = computed(() => Boolean(stock.value?.lots.length))
const filters = computed(() => stock.value ? kardexFilters(stock.value) : [])
const tracksStock = computed(() => stock.value?.product.useStock ?? false)
// A lot or a presentation is not a place: the buckets are named for what they are. A product
// with neither has one bucket, its own stock («Existencias»).
const bucket = computed(() => (stock.value ? bucketKind(stock.value) : 'lot'))
const bucketHeading = computed(() => ({ variant: 'Presentación', lot: 'Lote', product: 'Producto' })[bucket.value])
const tableLabel = computed(() =>
  bucket.value === 'product' ? 'Existencias del producto' : `Existencias por ${bucketHeading.value.toLowerCase()}`,
)
const untracked = computed(() => (stock.value ? untrackedLabel(stock.value) : undefined))
const kardexError = computed(() => Boolean(movements.error.value) && movements.items.value.length === 0)
const number = (value: number) => value.toLocaleString('es-MX')

// The buckets on the shared AppDataTable (premium tables S7). «Vence» exists only next to lots and
// Acciones only for a role that adjusts; the layout is one for every product. Acciones holds the
// labelled «Ajustar» button, wider than the locked 64px `actions` column (sized for a ⋮), so it is
// its own column pinned to the right edge by default.
const COLUMN_IDS = ['bucket', 'expiration', 'quantity', 'adjust'] as const
const right = { class: { th: 'text-right', td: 'text-right' } }
const columns = computed<TableColumn<BucketRow, unknown>[]>(() => [
  { id: 'bucket', header: bucketHeading.value, enableSorting: false },
  ...(hasLots.value ? [{ id: 'expiration', header: 'Vence', size: 144, enableSorting: false }] : []),
  { id: 'quantity', header: 'Existencias', size: 128, enableSorting: false, meta: right },
  ...(context.value.canAdjust
    ? [{ id: 'adjust', header: 'Acciones', size: 112, minSize: 104, enableSorting: false, meta: { class: { th: 'stock-action', td: 'stock-action' } } }]
    : []),
])
const layout = useTablePreferences({
  persistKey: 'pos-inventory-stock',
  columnIds: COLUMN_IDS,
  defaultPinning: { left: [], right: ['adjust'] },
})
const { columnOrder, columnPinning, columnSizing, columnVisibility, density } = layout

// The dialog always reads its bucket from the current snapshot: after a reload it
// gets the new quantity and version, and it closes if the bucket is gone.
const selected = shallowRef<BucketRow | null>(null)
const target = computed(() => selected.value && stock.value ? adjustmentTargetFor(stock.value, selected.value) : null)
watch(target, (value) => { if (!value) selected.value = null })
const dialogOpen = computed({
  get: () => target.value !== null,
  set: (value) => { if (!value) selected.value = null },
})

function onApplied(result: AdjustmentResult) {
  apply(result.stock)
  void movements.refresh()
}
function reload() {
  void refreshStock()
  void movements.refresh()
}
</script>

<template>
  <section data-testid="stock-panel" aria-label="Inventario" class="stock-panel">
    <EmptyState
      v-if="context.ready && !context.canRead" kind="forbidden" title="No tienes acceso al inventario"
      description="Tu rol no puede ver las existencias de esta sucursal."
    />
    <div v-else-if="!stock && !error" data-testid="stock-skeleton" aria-busy="true" class="stock-skeleton">
      <div class="stock-skeleton-figures"><span class="hf-skeleton" /><span class="hf-skeleton" /></div>
      <span v-for="index in 3" :key="index" class="hf-skeleton stock-skeleton-row" />
    </div>
    <div v-else-if="!stock" data-testid="stock-state">
      <EmptyState
        kind="error" title="No se pudo cargar el stock" action-label="Reintentar" :action-loading="isFetching"
        @action="refreshStock"
      />
    </div>
    <div v-else-if="!tracksStock" data-testid="stock-state">
      <EmptyState
        title="Este producto no lleva control de stock"
        description="Activa «Controlar inventario» en Presentaciones para llevar sus existencias."
      />
    </div>
    <template v-else>
      <div class="stock-block">
        <div class="stock-head">
          <h3 class="stock-title">Existencias</h3>
          <dl class="stock-figures">
            <div><dt>Total</dt><dd data-testid="stock-total" class="hf-figure">{{ number(stock.product.quantity) }}</dd></div>
            <div v-if="stock.product.sellable !== null">
              <dt>Vendible</dt><dd data-testid="stock-sellable" class="hf-figure">{{ number(stock.product.sellable) }}</dd>
            </div>
          </dl>
        </div>
        <div class="stock-surface" data-testid="stock-table">
          <AppDataTable
            v-model:column-order="columnOrder"
            v-model:column-pinning="columnPinning"
            v-model:column-sizing="columnSizing"
            v-model:column-visibility="columnVisibility"
            v-model:density="density"
            :persist-layout="true"
            :show-toolbar="false"
            :columns="columns"
            :data="rows"
            display-mode="auto"
            mobile-render="cards"
            class="hf-data-table"
            @reset-columns="layout.reset"
          >
            <template #caption>{{ tableLabel }}</template>
            <template #bucket-cell="{ row }">
              <span class="stock-label">
                <span data-testid="stock-label" class="hf-row-primary">{{ row.original.label }}</span>
                <StatusBadge v-if="row.original.expired" label="Vencido" tone="danger" aria-prefix="Lote:" />
              </span>
              <span v-if="row.original.expired" class="hf-row-secondary">No se vende</span>
            </template>
            <template #expiration-cell="{ row }">
              <span class="stock-when">{{ row.original.expiration ?? '—' }}</span>
            </template>
            <template #quantity-cell="{ row }">
              <span data-testid="stock-quantity" class="hf-figure">{{ number(row.original.quantity) }}</span>
            </template>
            <template #adjust-header><span class="sr-only">Acciones</span></template>
            <template #adjust-cell="{ row }">
              <UButton
                data-testid="stock-adjust" size="sm" color="neutral" variant="outline"
                label="Ajustar" :aria-label="`Ajustar stock de ${row.original.label}`" @click="selected = row.original"
              />
            </template>
            <template #mobile-card="{ row }">
              <article data-testid="stock-card" class="stock-card">
                <div class="stock-card-text">
                  <span class="stock-label">
                    <span data-testid="stock-label" class="hf-row-primary">{{ row.label }}</span>
                    <StatusBadge v-if="row.expired" label="Vencido" tone="danger" aria-prefix="Lote:" />
                  </span>
                  <span v-if="row.expired" class="hf-row-secondary">No se vende</span>
                  <span v-if="row.expiration" class="hf-row-secondary stock-expires">{{ row.expired ? 'Venció' : 'Vence' }} {{ row.expiration }}</span>
                </div>
                <span data-testid="stock-quantity" class="hf-figure stock-card-quantity">{{ number(row.quantity) }}</span>
                <UButton
                  v-if="context.canAdjust" data-testid="stock-adjust" size="sm" color="neutral" variant="outline"
                  label="Ajustar" :aria-label="`Ajustar stock de ${row.label}`" @click="selected = row"
                />
              </article>
            </template>
          </AppDataTable>
        </div>
      </div>
      <div class="stock-block">
        <h3 class="stock-title">Movimientos</h3>
        <StockKardex
          v-model:filter="kardexFilter" :bucket="bucket" :untracked="untracked" :items="movements.items.value" :loading="movements.isLoading.value"
          :fetching="movements.isFetching.value" :error="kardexError" :has-more="movements.hasMore.value"
          :loading-more="movements.isFetchingMore.value" :load-more-error="movements.loadMoreError.value" :filters="filters"
          @load-more="movements.loadMore" @refresh="movements.refresh"
        />
      </div>
      <StockAdjustmentDialog
        v-if="context.canAdjust && target" v-model:open="dialogOpen" :target="target" @applied="onApplied" @reload="reload"
      />
    </template>
  </section>
</template>

<style scoped>
.stock-panel { display: grid; gap: 24px; min-width: 0; color: var(--hf-ink); }
.stock-block { display: grid; gap: 12px; min-width: 0; }
.stock-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 24px; }
.stock-title { margin: 0; font-size: 16px; font-weight: 600; color: var(--hf-heading); }
.stock-figures { display: flex; gap: 24px; margin: 0; }
.stock-figures > div { display: grid; gap: 2px; justify-items: end; }
.stock-figures dt { font-size: 13px; color: var(--hf-muted); }
.stock-figures dd { margin: 0; font-size: 22px; font-weight: 600; color: var(--hf-heading); }
/* From md the table sits in the same bordered card as the kardex; phone cards keep their own. */
@media (min-width: 768px) {
  .stock-surface { overflow: hidden; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
}
.stock-surface :deep(.stock-action) { text-align: right; }
.stock-when { color: var(--hf-muted); white-space: nowrap; }
.stock-label { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
.stock-card { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px 16px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
.stock-card-text { display: grid; flex: 1; min-width: 0; }
.stock-card-quantity { color: var(--hf-heading); font-size: 14px; font-weight: 600; }
.stock-skeleton { display: grid; gap: 12px; }
.stock-skeleton-figures { display: flex; justify-content: flex-end; gap: 24px; }
.stock-skeleton-figures span { width: 72px; height: 36px; border-radius: 6px; }
.stock-skeleton-row { height: 44px; border-radius: 6px; }
</style>
