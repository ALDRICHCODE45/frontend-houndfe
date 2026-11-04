<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { AdjustmentResult } from '../interfaces/inventory.types'
import { useInventoryContext } from '../composables/useInventoryAccess'
import { useProductStock } from '../composables/useProductStock'
import { useStockMovements } from '../composables/useStockMovements'
import { adjustmentTargetFor, bucketRows, kardexFilters, type BucketRow } from '../utils/stock'
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
const kardexError = computed(() => Boolean(movements.error.value) && movements.items.value.length === 0)
const number = (value: number) => value.toLocaleString('es-MX')

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
        description="Activa «Usar stock» en el producto para llevar sus existencias."
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
        <div class="stock-scroll">
          <table class="stock-table" aria-label="Existencias por ubicación">
            <thead>
              <tr>
                <th scope="col">Ubicación</th>
                <th v-if="hasLots" scope="col" class="stock-when-col">Vence</th>
                <th scope="col" class="stock-num">Existencias</th>
                <th scope="col"><span class="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.kind + (row.id ?? '')" data-testid="stock-row">
                <td>
                  <span class="stock-label">
                    <span data-testid="stock-label" class="hf-row-primary">{{ row.label }}</span>
                    <StatusBadge v-if="row.expired" label="Vencido" tone="danger" aria-prefix="Lote:" />
                  </span>
                  <span v-if="row.expired" class="hf-row-secondary">No se vende</span>
                  <span v-if="row.expiration" class="hf-row-secondary stock-expires">Vence {{ row.expiration }}</span>
                </td>
                <td v-if="hasLots" class="stock-when stock-when-col">{{ row.expiration ?? '—' }}</td>
                <td class="stock-num"><span data-testid="stock-quantity" class="hf-figure">{{ number(row.quantity) }}</span></td>
                <td class="stock-action">
                  <UButton
                    v-if="context.canAdjust" data-testid="stock-adjust" size="sm" color="neutral" variant="outline"
                    label="Ajustar" :aria-label="`Ajustar stock de ${row.label}`" @click="selected = row"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="stock-block">
        <h3 class="stock-title">Movimientos</h3>
        <StockKardex
          v-model:filter="kardexFilter" :items="movements.items.value" :loading="movements.isLoading.value"
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
.stock-scroll { overflow-x: auto; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
.stock-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.stock-table th { height: 40px; padding: 0 12px; text-align: left; font-size: 13px; font-weight: 600; color: var(--hf-muted); background: color-mix(in srgb, var(--hf-ink) 4%, var(--hf-surface)); }
.stock-table td { padding: 10px 12px; border-top: 1px solid var(--hf-border); vertical-align: middle; }
.stock-num { text-align: right; }
.stock-action { width: 1%; text-align: right; white-space: nowrap; }
.stock-when { color: var(--hf-muted); white-space: nowrap; }
.stock-label { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; min-width: 0; }
/* Below 480px the four columns do not fit the card, and «Ajustar» ended up behind a scroll:
 * the expiry moves under the lot name instead of taking a column. */
.stock-expires { display: none; }
@media (max-width: 480px) {
  .stock-when-col { display: none; }
  .stock-expires { display: block; }
}
.stock-skeleton { display: grid; gap: 12px; }
.stock-skeleton-figures { display: flex; justify-content: flex-end; gap: 24px; }
.stock-skeleton-figures span { width: 72px; height: 36px; border-radius: 6px; }
.stock-skeleton-row { height: 44px; border-radius: 6px; }
</style>
