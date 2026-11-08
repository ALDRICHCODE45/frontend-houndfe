<script setup lang="ts">
/**
 * ProductLotsTable — The lots of a product: pending lots while creating,
 * saved lots otherwise. Presentational only; the owner confirms and deletes.
 * A list on the shared AppDataTable (premium tables S7): reorder, pin, resize and
 * density from the column menus, saved per user for every product.
 *
 * Events:
 *   edit(lot)   — saved lots only (the owner decides what editing means)
 *   delete(lot) — opens the owner's confirmation
 *   retry()     — the error state's Reintentar
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import type { TableColumn } from '@/core/shared/types/table.types'
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

const emptyState = computed(() =>
  props.pending
    ? { title: 'Sin lotes agregados', description: 'Usa «Agregar lote» para registrar el primero.' }
    : { title: 'Sin lotes registrados' },
)

const right = { class: { th: 'text-right', td: 'text-right' } }
const columns: TableColumn<ProductLotRow>[] = [
  { id: 'lotNumber', header: 'Lote', enableSorting: false },
  { id: 'expirationDate', header: 'Caducidad', size: 160, enableSorting: false },
  { id: 'quantity', header: 'Existencias', size: 128, enableSorting: false, meta: right },
  { id: 'actions', header: 'Acciones', meta: { class: { th: 'w-16', td: 'w-16 text-right' } } },
]

// Column layout saved per user in this browser, one for the lots of every product.
const layout = useTablePreferences({
  persistKey: 'pos-product-lots',
  columnIds: columns.map((column) => column.id ?? ''),
})
const { columnOrder, columnPinning, columnSizing, columnVisibility, density } = layout

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
  <div class="product-lots" data-testid="product-lots-table">
    <AppDataTable
      v-model:column-order="columnOrder"
      v-model:column-pinning="columnPinning"
      v-model:column-sizing="columnSizing"
      v-model:column-visibility="columnVisibility"
      v-model:density="density"
      :persist-layout="true"
      :show-toolbar="false"
      :columns="columns"
      :data="lots"
      :loading="loading"
      :error="error && lots.length === 0"
      error-message="No se pudieron cargar los lotes"
      :empty-state="emptyState"
      display-mode="auto"
      mobile-render="cards"
      class="hf-data-table"
      @refresh="emit('retry')"
      @reset-columns="layout.reset"
    >
      <template #lotNumber-cell="{ row }">
        <span class="hf-row-primary">{{ row.original.lotNumber }}</span>
      </template>
      <template #expirationDate-cell="{ row }">
        <span class="product-lots-muted">{{ expiryText(row.original.expirationDate) }}</span>
      </template>
      <template #quantity-cell="{ row }">
        <span class="hf-figure">{{ row.original.quantity }}</span>
      </template>
      <template #actions-header><span class="sr-only">Acciones</span></template>
      <template #actions-cell="{ row }">
        <RowActionsMenu
          :actions="actionsFor()"
          :row-label="`lote ${row.original.lotNumber}`"
          @select="onAction($event, row.original)"
        />
      </template>
      <template #mobile-card="{ row }">
        <article class="product-lot-card" data-testid="product-lot-card">
          <div class="product-lot-card__text">
            <span class="hf-row-primary">{{ row.lotNumber }}</span>
            <span class="hf-row-secondary">Caduca: {{ expiryText(row.expirationDate) }}</span>
          </div>
          <span class="product-lot-card__stock">
            <span class="hf-figure">{{ row.quantity }}</span>
            <span class="product-lots-muted">existencias</span>
          </span>
          <RowActionsMenu
            :actions="actionsFor()"
            :row-label="`lote ${row.lotNumber}`"
            @select="onAction($event, row)"
          />
        </article>
      </template>
    </AppDataTable>
  </div>
</template>

<style scoped>
.product-lots { min-width: 0; }
/* From md the table sits in a bordered card like the other tables of the detail; phone cards keep their own. */
@media (min-width: 768px) {
  .product-lots { overflow: hidden; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
}
.product-lots-muted { color: var(--hf-muted); }
.product-lot-card { display: flex; align-items: center; gap: 12px; min-width: 0; padding: 12px 8px 12px 16px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); }
.product-lot-card__text { display: grid; flex: 1; min-width: 0; }
.product-lot-card__stock { display: grid; justify-items: end; font-size: 13px; }
.product-lot-card__stock .hf-figure { color: var(--hf-heading); font-size: 14px; font-weight: 600; }
</style>
