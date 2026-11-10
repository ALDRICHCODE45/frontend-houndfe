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
 *   commit-price(id, cents) — the public price was left with a new valid
 *                             amount (InlinePriceInput)
 *   action(key, id) — photos | details | packaging | edit | delete (delete is confirmed by the owner)
 *   retry() — the error state's Reintentar
 *
 * Slots:
 *   photo({ row }) — saved rows only: the variant's photo thumbnail (VariantImagesPopover), first column
 */
import { computed, useSlots } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import InlinePriceInput from './InlinePriceInput.vue'
import ReadOnlyStock, { STOCK_ADJUST_HINT } from './ReadOnlyStock.vue'

export interface ProductVariantRow {
  id: string
  label: string
  sku: string
  barcode: string
  quantity: number | undefined
  priceCents: number
  /** Name used in the owner's delete confirmation. */
  deleteName: string
}

const props = defineProps<{
  rows: ProductVariantRow[]
  /** Create mode: rows are still local, so they have no photos. */
  pending: boolean
  showStock: boolean
  loading?: boolean
  /** The saved variants did not load: say so, with a retry, instead of an empty list. */
  error?: boolean
  canUpdate: boolean
  canDelete: boolean
  /** The product ships (not a service): saved rows offer «Empaque», readable without update rights. */
  packaging?: boolean
}>()

const emit = defineEmits<{
  'update-quantity': [id: string, value: number | undefined]
  'commit-quantity': [id: string]
  'commit-price': [id: string, cents: number]
  action: [key: string, id: string]
  retry: []
}>()

const slots = useSlots()
/** The photo column: saved variants only (a pending one has nowhere to keep photos yet). */
const showPhoto = computed(() => !props.pending && Boolean(slots.photo))
const columnCount = computed(() => (props.showStock ? 4 : 3) + (showPhoto.value ? 1 : 0))
/** Below 640px the rows stack as cards and the heading (with the stock hint) is visually hidden: say it once
 * above them (aria-hidden, since screen readers still read the heading). */
const showPhoneStockHint = computed(() => props.showStock && !props.pending && props.rows.length > 0)
const emptyText = computed(() =>
  props.pending
    ? 'Sin variantes agregadas. Usa «Agregar variante».'
    : 'Sin variantes registradas.',
)
// Only the codes a variant has, so a row never reads «SKU: — · Código: —».
function codesOf(row: ProductVariantRow): string {
  return [row.sku && `SKU: ${row.sku}`, row.barcode && `Código: ${row.barcode}`].filter(Boolean).join(' · ')
}

// Pending rows are local, so their inputs and actions are always editable.
const locked = computed(() => !props.pending && !props.canUpdate)

function actionsFor(): RowAction[] {
  return [
    ...(props.pending
      ? []
      : [{ key: 'photos', label: 'Fotos', icon: 'i-lucide-image' }]),
    { key: 'details', label: 'Más datos', icon: 'i-lucide-list-plus' },
    ...(props.packaging && !props.pending
      ? [{ key: 'packaging', label: 'Empaque', icon: 'i-lucide-package' }]
      : []),
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
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-default" data-testid="product-variants-table">
    <p
      v-if="showPhoneStockHint"
      class="px-4 pt-3 text-xs text-muted sm:hidden"
      aria-hidden="true"
      data-testid="variants-stock-hint-phone"
    >
      <span class="font-medium text-toned">Existencias</span> · {{ STOCK_ADJUST_HINT }}
    </p>
    <table
      class="hf-plain-table hf-plain-table--hover products-plain-table products-variants-table min-w-full divide-y divide-default text-sm"
      :class="{ 'products-variants-table--photos': showPhoto }"
      data-stack
    >
      <thead>
        <tr>
          <th v-if="showPhoto" class="w-[72px] px-4 py-3"><span class="sr-only">Foto</span></th>
          <th class="px-4 py-3 text-left font-semibold">Variante</th>
          <th v-if="showStock" class="px-4 py-3 text-right font-semibold">
            Existencias
            <span v-if="!pending" class="block text-xs font-normal text-muted">{{ STOCK_ADJUST_HINT }}</span>
          </th>
          <th class="px-4 py-3 text-right font-semibold">Precio público</th>
          <th class="w-16 px-4 py-3"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-if="error && rows.length === 0">
          <td :colspan="columnCount" class="p-4">
            <EmptyState
              kind="error"
              title="No se pudieron cargar las variantes"
              action-label="Reintentar"
              :action-loading="loading"
              @action="emit('retry')"
            />
          </td>
        </tr>
        <tr v-else-if="loading">
          <td :colspan="columnCount" class="px-4 py-3 text-muted">Actualizando variantes...</td>
        </tr>
        <tr v-else-if="rows.length === 0">
          <td :colspan="columnCount" class="px-4 py-3 text-muted">{{ emptyText }}</td>
        </tr>
        <tr v-for="row in rows" :key="row.id">
          <td v-if="showPhoto" class="px-4 py-2 align-middle" data-area="photo">
            <slot name="photo" :row="row" />
          </td>
          <td class="px-4 py-3" data-area="name">
            <div class="font-semibold text-highlighted">{{ row.label }}</div>
            <div v-if="codesOf(row)" class="text-xs text-muted" data-testid="variant-codes">{{ codesOf(row) }}</div>
          </td>
          <td v-if="showStock" class="px-4 py-3 text-right" data-area="stock" data-label="Existencias">
            <ReadOnlyStock
              v-if="!pending"
              :value="row.quantity ?? 0"
              :label="`Existencias de ${row.label}`"
              compact
              hide-hint
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
          <td class="px-4 py-3 text-right" data-area="price" data-label="Precio público">
            <InlinePriceInput
              class="ml-auto max-w-[8rem]"
              :price-cents="row.priceCents"
              :disabled="locked"
              :label="`Precio público de ${row.label}`"
              @commit="emit('commit-price', row.id, $event)"
            />
          </td>
          <td class="px-4 py-3 text-right" data-area="actions">
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
