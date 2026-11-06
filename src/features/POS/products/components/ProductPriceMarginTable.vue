<script setup lang="ts">
import '../styles/products-plain-table.css'
/**
 * ProductPriceMarginTable — Price lists with their sale price, margin and
 * gain over the purchase cost, for the prices the owner holds locally
 * (a new product, or a variant being edited in its modal). Presentational:
 * the owner stores the price and opens the tier-prices modal.
 *
 * Events:
 *   update-price(id, cents) — the price input was left with a new valid
 *                             amount (InlinePriceInput)
 *   action(key, id)         — tiers (Precios por cantidad) | remove (Quitar)
 */
import InlinePriceInput from './InlinePriceInput.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import ProductMarginFigure from './ProductMarginFigure.vue'

export interface ProductPriceRow {
  id: string
  name: string
  priceCents: number
  /** The default list cannot be removed. */
  removable: boolean
}

defineProps<{
  rows: ProductPriceRow[]
  /** Purchase cost used for the margin; 0 when unknown. */
  costCents: number
}>()

const emit = defineEmits<{
  'update-price': [id: string, cents: number]
  action: [key: string, id: string]
}>()

function actionsFor(row: ProductPriceRow): RowAction[] {
  return [
    { key: 'tiers', label: 'Precios por cantidad', icon: 'i-lucide-layers' },
    ...(row.removable
      ? [{ key: 'remove', label: 'Quitar', icon: 'i-lucide-trash-2', destructive: true }]
      : []),
  ]
}
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-default" data-testid="product-price-margin-table">
    <table class="products-plain-table products-price-table min-w-full divide-y divide-default text-sm" data-stack>
      <thead>
        <tr>
          <th class="px-4 py-3 text-left font-semibold">Lista de precios</th>
          <th class="px-4 py-3 text-right font-semibold">
            Precio de venta
            <span class="block text-xs font-normal text-muted">Con impuestos</span>
          </th>
          <th class="px-4 py-3 text-right font-semibold">Margen</th>
          <th class="px-4 py-3 text-right font-semibold">Ganancia</th>
          <th class="w-16 px-4 py-3"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="row in rows" :key="row.id">
          <td class="px-4 py-3 font-semibold text-highlighted" data-area="name">{{ row.name }}</td>
          <td class="px-4 py-3 text-right" data-area="price" data-label="Precio de venta con impuestos">
            <InlinePriceInput
              class="ml-auto max-w-[10rem]"
              :price-cents="row.priceCents"
              :label="`Precio de venta de ${row.name}, con impuestos incluidos`"
              @commit="emit('update-price', row.id, $event)"
            />
          </td>
          <td class="px-4 py-3 text-right" data-area="margin" data-label="Margen">
            <ProductMarginFigure :price-cents="row.priceCents" :cost-cents="costCents" kind="percent" />
          </td>
          <td class="px-4 py-3 text-right" data-area="gain" data-label="Ganancia">
            <ProductMarginFigure :price-cents="row.priceCents" :cost-cents="costCents" kind="gain" />
          </td>
          <td class="px-4 py-3 text-right" data-area="actions">
            <RowActionsMenu
              :actions="actionsFor(row)"
              :row-label="`la lista ${row.name}`"
              @select="emit('action', $event, row.id)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
