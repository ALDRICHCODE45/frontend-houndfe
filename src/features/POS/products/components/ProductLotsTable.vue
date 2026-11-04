<script setup lang="ts">
import '../styles/products-plain-table.css'
/**
 * ProductLotsTable — The lots of a product: pending lots while creating,
 * saved lots otherwise. Presentational only; the owner confirms and deletes.
 *
 * Events:
 *   edit(lot)   — saved lots only (the owner decides what editing means)
 *   delete(lot) — opens the owner's confirmation
 */
import { computed } from 'vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'

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
  canDelete: boolean
}>()

const emit = defineEmits<{
  edit: [lot: ProductLotRow]
  delete: [lot: ProductLotRow]
}>()

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
        <tr v-if="loading">
          <td colspan="4" class="px-4 py-3 text-muted">Actualizando lotes...</td>
        </tr>
        <tr v-else-if="lots.length === 0">
          <td colspan="4" class="px-4 py-3 text-muted">{{ emptyText }}</td>
        </tr>
        <tr v-for="lot in lots" :key="lot.id">
          <td class="px-4 py-3 font-semibold">{{ lot.lotNumber }}</td>
          <td class="px-4 py-3 text-muted">{{ lot.expirationDate || 'Sin fecha' }}</td>
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
