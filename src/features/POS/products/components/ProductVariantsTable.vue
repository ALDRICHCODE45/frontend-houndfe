<script setup lang="ts">
import '../styles/products-plain-table.css'
/**
 * ProductVariantsTable — The variants of a product, as pending rows while
 * creating and as saved rows otherwise: name with SKU and barcode under it,
 * stock, public price and the ⋮ menu. Presentational: the owner keeps the
 * values and runs every action.
 *
 * Events:
 *   update-quantity(id, value) / commit-quantity(id) — pending rows only: a
 *   saved variant's stock is read-only (O1 S1) and changes by adjustment
 *   update-price(id, text) / commit-price(id, text)  — inline public price edit
 *   action(key, id) — photos | details | edit | delete (delete is confirmed by the owner)
 */
import { computed } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import ReadOnlyStock from './ReadOnlyStock.vue'

export interface ProductVariantRow {
  id: string
  label: string
  sku: string
  barcode: string
  quantity: number | undefined
  price: string
  /** Name used in the owner's delete confirmation. */
  deleteName: string
}

const props = defineProps<{
  rows: ProductVariantRow[]
  /** Create mode: rows are still local, so they have no photos. */
  pending: boolean
  showStock: boolean
  loading?: boolean
  canUpdate: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  'update-quantity': [id: string, value: number | undefined]
  'commit-quantity': [id: string]
  'update-price': [id: string, value: string]
  'commit-price': [id: string, value: string]
  action: [key: string, id: string]
}>()

const columnCount = computed(() => (props.showStock ? 4 : 3))
const emptyText = computed(() =>
  props.pending
    ? 'Sin variantes agregadas. Usa «Agregar variante».'
    : 'Sin variantes registradas.',
)
// Pending rows are local, so their inputs and actions are always editable.
const locked = computed(() => !props.pending && !props.canUpdate)

function actionsFor(): RowAction[] {
  return [
    ...(props.pending
      ? []
      : [{ key: 'photos', label: 'Elegir fotos', icon: 'i-lucide-image', disabled: !props.canUpdate }]),
    { key: 'details', label: 'Más datos', icon: 'i-lucide-list-plus' },
    { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil', disabled: locked.value },
    {
      key: 'delete',
      label: 'Eliminar…',
      icon: 'i-lucide-trash-2',
      destructive: true,
      disabled: !props.pending && !props.canDelete,
    },
  ]
}

function priceFromEvent(event: Event): string {
  return (event.target as HTMLInputElement).value
}
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-default" data-testid="product-variants-table">
    <table class="products-plain-table min-w-full divide-y divide-default text-sm">
      <thead>
        <tr>
          <th class="px-4 py-3 text-left font-semibold">Variante</th>
          <th v-if="showStock" class="px-4 py-3 text-right font-semibold">Existencias</th>
          <th class="px-4 py-3 text-right font-semibold">Precio público</th>
          <th class="w-16 px-4 py-3"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-if="loading">
          <td :colspan="columnCount" class="px-4 py-3 text-muted">Actualizando variantes...</td>
        </tr>
        <tr v-else-if="rows.length === 0">
          <td :colspan="columnCount" class="px-4 py-3 text-muted">{{ emptyText }}</td>
        </tr>
        <tr v-for="row in rows" :key="row.id">
          <td class="px-4 py-3">
            <div class="font-semibold text-highlighted">{{ row.label }}</div>
            <div class="text-xs text-muted">
              SKU: {{ row.sku || '—' }} · Código: {{ row.barcode || '—' }}
            </div>
          </td>
          <td v-if="showStock" class="px-4 py-3 text-right">
            <ReadOnlyStock
              v-if="!pending"
              :value="row.quantity ?? 0"
              :label="`Existencias de ${row.label}`"
              compact
              data-testid="variant-stock-readonly"
            />
            <UInputNumber
              v-else
              :model-value="row.quantity"
              :min="0"
              class="ml-auto w-28"
              :disabled="locked"
              :aria-label="`Existencias de ${row.label}`"
              @update:model-value="emit('update-quantity', row.id, $event)"
              @blur="emit('commit-quantity', row.id)"
              @keyup.enter="emit('commit-quantity', row.id)"
            />
          </td>
          <td class="px-4 py-3 text-right">
            <div class="relative ml-auto max-w-[8rem]">
              <span
                class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
                >$</span
              >
              <UInput
                :model-value="row.price"
                class="w-full"
                inputmode="decimal"
                placeholder="0.00"
                :ui="{ base: 'hf-figure pl-7 text-right' }"
                :disabled="locked"
                :aria-label="`Precio público de ${row.label}`"
                @update:model-value="emit('update-price', row.id, String($event))"
                @blur="emit('commit-price', row.id, priceFromEvent($event))"
                @keyup.enter="emit('commit-price', row.id, priceFromEvent($event))"
              />
            </div>
          </td>
          <td class="px-4 py-3 text-right">
            <RowActionsMenu
              :actions="actionsFor()"
              :row-label="`la variante ${row.label}`"
              @select="emit('action', $event, row.id)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
