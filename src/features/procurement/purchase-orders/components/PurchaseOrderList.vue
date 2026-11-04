<script setup lang="ts">
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import DataTableToolbar from '@/core/shared/components/DataTable/DataTableToolbar.vue'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { PurchaseOrderSummary } from '../interfaces/purchase-order.types'
const props = defineProps<{ items: readonly PurchaseOrderSummary[]; canEdit: boolean; canDelete: boolean; loading?: boolean; fetching?: boolean; error?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ open: [order: PurchaseOrderSummary]; discard: [order: PurchaseOrderSummary]; refresh: [] }>()
const search = defineModel<string>('search', { default: '' })
const data = computed(() => [...props.items])
const columns: TableColumn<PurchaseOrderSummary, unknown>[] = [
  { id: 'supplier', header: 'Proveedor', enableSorting: false },
  { id: 'status', header: 'Estado', enableSorting: false },
  { accessorKey: 'lineCount', header: 'Renglones', enableSorting: false },
  { accessorKey: 'issueCount', header: 'Avisos', enableSorting: false },
  { accessorKey: 'note', header: 'Nota', enableSorting: false },
  { accessorKey: 'updatedAt', header: 'Actualizado', enableSorting: false },
  { id: 'actions', header: 'Acciones', enableSorting: false },
]
const statusLabels: Record<string, string> = { DRAFT: 'Borrador', CONFIRMED: 'Confirmada', CANCELLED: 'Cancelada' }
const editable = (order: PurchaseOrderSummary) => order.status === 'DRAFT' && props.canEdit
const date = (value: string) => new Date(value).toLocaleString('es-MX')
</script>

<template>
  <div class="order-list">
    <!-- AppDataTable always wraps #filters, even when absent. Compose its own
         shared toolbar directly so an empty wrapper cannot create Filtros. -->
    <DataTableToolbar v-model:global-filter="search" search-placeholder="Buscar por proveedor o nota..." :show-refresh="true" :fetching="fetching" refresh-button-test-id="refresh-orders" portal-class="hf-theme hf-ui" @refresh="emit('refresh')">
      <template v-if="$slots.filters" #filters><slot name="filters" /></template>
      <template #actions><slot name="actions" /></template>
    </DataTableToolbar>
    <AppDataTable :show-toolbar="false" :columns="columns" :data="data" :loading="loading" :fetching="fetching" :error="error"
      error-message="No se pudieron cargar las órdenes. Puedes volver a actualizar."
      empty="No hay órdenes de compra." display-mode="auto" mobile-render="cards"
      class="hf-data-table" @refresh="emit('refresh')">
    <template #supplier-cell="{ row }"><span class="order-name">{{ row.original.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</span><span v-if="row.original.supplierDisplaySnapshot?.status === 'ARCHIVED'" class="order-badge">Archivado</span></template>
    <template #status-cell="{ row }"><span data-testid="order-status" class="order-badge">{{ statusLabels[row.original.status] }}</span></template>
    <template #note-cell="{ row }"><p class="order-note">{{ row.original.note || 'Sin nota' }}</p></template>
    <template #updatedAt-cell="{ row }">{{ date(row.original.updatedAt) }}</template>
    <template #actions-cell="{ row }">
      <div class="order-actions">
        <UButton type="button" color="neutral" variant="outline" :disabled="disabled" @click="emit('open', row.original)">{{ editable(row.original) ? 'Continuar' : 'Ver orden' }}</UButton>
        <UButton v-if="canDelete && row.original.status === 'DRAFT'" type="button" data-testid="discard-order" color="error" variant="outline" icon="i-lucide-trash-2" :disabled="disabled" @click="emit('discard', row.original)">Descartar</UButton>
      </div>
    </template>
    <template #mobile-card="{ row }">
      <article class="order-card">
        <div class="order-card-heading"><span class="order-name">{{ row.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</span><span v-if="row.supplierDisplaySnapshot?.status === 'ARCHIVED'" class="order-badge">Archivado</span><span data-testid="order-status" class="order-badge">{{ statusLabels[row.status] }}</span></div>
        <dl class="order-card-details"><dt>Renglones</dt><dd>{{ row.lineCount }}</dd><dt>Avisos</dt><dd>{{ row.issueCount }}</dd><dt>Nota</dt><dd class="order-note">{{ row.note || 'Sin nota' }}</dd><dt>Actualizado</dt><dd>{{ date(row.updatedAt) }}</dd></dl>
        <div class="order-actions order-card-actions">
          <UButton type="button" color="neutral" variant="outline" :disabled="disabled" @click="emit('open', row)">{{ editable(row) ? 'Continuar' : 'Ver orden' }}</UButton>
          <UButton v-if="canDelete && row.status === 'DRAFT'" type="button" data-testid="discard-order" color="error" variant="outline" icon="i-lucide-trash-2" :disabled="disabled" @click="emit('discard', row)">Descartar</UButton>
        </div>
      </article>
    </template>
    </AppDataTable>
  </div>
</template>

<style scoped>
.order-list { display: grid; gap: 16px; min-width: 0; }
.order-name { color: var(--hf-heading); font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.order-note { color: var(--hf-muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.order-badge { flex-shrink: 0; border-radius: 6px; background: var(--hf-surface-muted); color: var(--hf-muted); padding: 4px 8px; font-size: 12px; }
.order-card { min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.order-card-heading { display: flex; justify-content: space-between; gap: 12px; }
.order-card-details { border-top: 1px solid var(--hf-border); margin-top: 12px; padding-top: 12px; font-size: 13px; overflow-wrap: anywhere; }
.order-card-details dt { color: var(--hf-muted); margin-top: 6px; }
.order-actions { display: flex; flex-wrap: nowrap; gap: 8px; }
.order-card-actions { justify-content: flex-end; margin-top: 12px; }
.order-actions :deep(button) { min-height: var(--hf-control-height); white-space: nowrap; flex-shrink: 0; }
:deep(table[data-slot='base']) { table-layout: fixed; }
:deep(th[data-slot='th']:nth-child(1)) { width: 22%; }
:deep(th[data-slot='th']:nth-child(2)) { width: 120px; }
:deep(th[data-slot='th']:nth-child(3)) { width: 88px; }
:deep(th[data-slot='th']:nth-child(4)) { width: 72px; }
:deep(th[data-slot='th']:nth-child(6)) { width: 180px; }
:deep(th[data-slot='th']:nth-child(7)) { width: 244px; }
:deep(td[data-slot='td']) { white-space: normal; overflow-wrap: anywhere; }
</style>
