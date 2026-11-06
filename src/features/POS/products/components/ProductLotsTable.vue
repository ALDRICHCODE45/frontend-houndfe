<script setup lang="ts">
import '../styles/products-plain-table.css'
/**
 * ProductLotsTable — The lots of a product: pending lots while creating,
 * saved lots otherwise. Presentational only; the owner confirms and deletes.
 *
 * Events:
 *   edit(lot)   — saved lots only (the owner decides what editing means)
 *   delete(lot) — opens the owner's confirmation
 *   retry()     — the error state's Reintentar
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { formatExpirationDate } from '@/features/POS/inventory/utils/stock'

export interface ProductLotRow {
  id: string
  lotNumber: string
  expirationDate: string | null | undefined
  quantity: number
}

const props = defineProps<{
  lots: ProductLotRow[]
  /** Create mode: lots are still local, so they cannot be edited yet. */
  pending: boolean
  loading?: boolean
  /** The saved lots did not load: say so, with a retry, instead of an empty list. */
  error?: boolean
  canDelete: boolean
}>()

const emit = defineEmits<{
  edit: [lot: ProductLotRow]
  delete: [lot: ProductLotRow]
  retry: []
}>()

// The same short calendar date as Inventario (`31 dic 2026`); a server timestamp keeps only its day.
function expiryText(value: string | null | undefined): string {
  return value ? formatExpirationDate(value.slice(0, 10)) : 'Sin fecha'
}

const emptyText = computed(() =>
  props.pending ? 'Sin lotes agregados. Usa «Agregar lote».' : 'Sin lotes registrados.',
)

function actionsFor(): RowAction[] {
  return [
    ...(props.pending ? [] : [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }]),
    {
      key: 'delete',
      label: 'Eliminar…',
      icon: 'i-lucide-trash-2',
      destructive: true,
      disabled: !props.pending && !props.canDelete,
    },
  ]
}

function onAction(key: string, lot: ProductLotRow) {
  if (key === 'edit') emit('edit', lot)
  else if (key === 'delete') emit('delete', lot)
}
</script>

<template>
  <div class="overflow-x-auto rounded-md border border-default" data-testid="product-lots-table">
    <table class="products-plain-table min-w-full divide-y divide-default text-sm">
      <thead>
        <tr>
          <th class="px-4 py-3 text-left font-semibold">Lote</th>
          <th class="px-4 py-3 text-left font-semibold">Caducidad</th>
          <th class="px-4 py-3 text-right font-semibold">Existencias</th>
          <th class="w-16 px-4 py-3"><span class="sr-only">Acciones</span></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-if="error && lots.length === 0">
          <td colspan="4" class="p-4">
            <EmptyState
              kind="error"
              title="No se pudieron cargar los lotes"
              action-label="Reintentar"
              :action-loading="loading"
              @action="emit('retry')"
            />
          </td>
        </tr>
        <tr v-else-if="loading">
          <td colspan="4" class="px-4 py-3 text-muted">Actualizando lotes...</td>
        </tr>
        <tr v-else-if="lots.length === 0">
          <td colspan="4" class="px-4 py-3 text-muted">{{ emptyText }}</td>
        </tr>
        <tr v-for="lot in lots" :key="lot.id">
          <td class="px-4 py-3 font-semibold">{{ lot.lotNumber }}</td>
          <td class="px-4 py-3 text-muted">{{ expiryText(lot.expirationDate) }}</td>
          <td class="hf-figure px-4 py-3 text-right">{{ lot.quantity }}</td>
          <td class="px-4 py-3 text-right">
            <RowActionsMenu
              :actions="actionsFor()"
              :row-label="`lote ${lot.lotNumber}`"
              @select="onAction($event, lot)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
