<script setup lang="ts">
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { Supplier } from '../interfaces/supplier.types'
const props = defineProps<{ items: readonly Supplier[]; canEdit: boolean; canDelete?: boolean; loading?: boolean; fetching?: boolean; error?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ open: [supplier: Supplier]; changeStatus: [supplier: Supplier]; delete: [supplier: Supplier]; refresh: [] }>()
const search = defineModel<string>('search', { default: '' })
const data = computed(() => [...props.items])
const columns = computed<TableColumn<Supplier, unknown>[]>(() => [
  { accessorKey: 'displayName', header: 'Proveedor', enableSorting: false },
  { accessorKey: 'termsText', header: 'Condiciones', enableSorting: false },
  { accessorKey: 'status', header: 'Estado', enableSorting: false },
  ...(props.canEdit || props.canDelete ? [{ id: 'actions', header: 'Acciones', enableSorting: false }] : []),
])
</script>

<template>
  <AppDataTable
    v-model:global-filter="search"
    :columns="columns" :data="data" :loading="loading" :fetching="fetching" :error="error"
    error-message="No se pudieron cargar los proveedores. Puedes volver a actualizar."
    empty="No hay proveedores para esta búsqueda."
    display-mode="auto" mobile-render="cards" search-placeholder="Buscar proveedor..."
    refresh-button-test-id="refresh-suppliers"
    portal-class="hf-theme hf-ui suppliers-list-portal"
    class="hf-data-table" @refresh="emit('refresh')"
  >
    <template #filters><slot name="filters" /></template>
    <template #actions><slot name="actions" /></template>
    <template #displayName-cell="{ row }">
      <button type="button" data-testid="supplier-detail" class="supplier-name" :disabled="disabled" @click="emit('open', row.original)">{{ row.original.displayName }}</button>
    </template>
    <template #termsText-cell="{ row }"><p class="supplier-terms">{{ row.original.termsText || 'Sin condiciones registradas' }}</p></template>
    <template #status-cell="{ row }"><span class="supplier-badge" :class="{ archived: row.original.status === 'ARCHIVED' }">{{ row.original.status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</span></template>
    <template #actions-cell="{ row }">
      <div class="supplier-actions">
        <button v-if="canEdit" type="button" class="supplier-status" data-testid="supplier-status" :disabled="disabled" :aria-label="`${row.original.status === 'ACTIVE' ? 'Archivar' : 'Reactivar'} ${row.original.displayName}`" @click="emit('changeStatus', row.original)">{{ row.original.status === 'ACTIVE' ? 'Archivar' : 'Reactivar' }}</button>
        <button v-if="canDelete" type="button" class="supplier-status supplier-delete" data-testid="supplier-delete" :disabled="disabled" :aria-label="`Eliminar ${row.original.displayName}`" @click="emit('delete', row.original)"><UIcon name="i-lucide-trash-2" aria-hidden="true" />Eliminar</button>
      </div>
    </template>
    <template #mobile-card="{ row }">
      <article class="supplier-card">
        <div class="supplier-card-heading">
          <button type="button" data-testid="supplier-detail" class="supplier-name" :disabled="disabled" @click="emit('open', row)">{{ row.displayName }}</button>
          <span class="supplier-badge" :class="{ archived: row.status === 'ARCHIVED' }">{{ row.status === 'ACTIVE' ? 'Activo' : 'Archivado' }}</span>
        </div>
        <dl class="supplier-card-details"><dt>Condiciones</dt><dd>{{ row.termsText || 'Sin condiciones registradas' }}</dd></dl>
        <div v-if="canEdit || canDelete" class="supplier-card-actions">
          <button v-if="canEdit" type="button" class="supplier-status" data-testid="supplier-status" :disabled="disabled" :aria-label="`${row.status === 'ACTIVE' ? 'Archivar' : 'Reactivar'} ${row.displayName}`" @click="emit('changeStatus', row)">{{ row.status === 'ACTIVE' ? 'Archivar' : 'Reactivar' }}</button>
          <button v-if="canDelete" type="button" class="supplier-status supplier-delete" data-testid="supplier-delete" :disabled="disabled" :aria-label="`Eliminar ${row.displayName}`" @click="emit('delete', row)"><UIcon name="i-lucide-trash-2" aria-hidden="true" />Eliminar</button>
        </div>
      </article>
    </template>
  </AppDataTable>
</template>

<style scoped>
.supplier-name { color: var(--hf-heading); font-size: 14px; font-weight: 600; min-height: 44px; text-align: left; overflow-wrap: anywhere; white-space: normal; }
.supplier-terms { color: var(--hf-muted); max-width: 40ch; overflow: hidden; text-overflow: ellipsis; }
.supplier-badge { flex-shrink: 0; border-radius: 6px; background: var(--hf-active-soft); color: var(--hf-active); padding: 4px 8px; font-size: 12px; font-weight: 600; }
.supplier-badge.archived { background: var(--hf-surface-muted); color: var(--hf-muted); }
.supplier-status { min-height: 44px; padding: 8px 12px; color: var(--hf-ink); border: 1px solid var(--hf-field-border); border-radius: 6px; background: var(--hf-surface); }
.supplier-card { min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.supplier-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.supplier-card-details { border-top: 1px solid var(--hf-border); margin-top: 12px; padding-top: 12px; font-size: 13px; overflow-wrap: anywhere; }
.supplier-card-details dt { color: var(--hf-muted); margin-bottom: 4px; }
.supplier-card-actions, .supplier-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.supplier-card-actions { margin-top: 12px; }
.supplier-actions { justify-content: flex-start; }
.supplier-delete { display: inline-flex; align-items: center; gap: 6px; color: var(--ui-error); border-color: currentColor; }
button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button:disabled { opacity: .6; cursor: not-allowed; }
</style>
