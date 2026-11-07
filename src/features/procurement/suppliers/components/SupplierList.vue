<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { Supplier } from '../interfaces/supplier.types'
const props = defineProps<{ items: readonly Supplier[]; canEdit: boolean; canDelete?: boolean; canCreate?: boolean; filtered?: boolean; loading?: boolean; fetching?: boolean; error?: boolean; disabled?: boolean; activeFilterCount?: number }>()
// `invoker` is the control focus returns to when the overlay it opens closes.
const emit = defineEmits<{ open: [supplier: Supplier, invoker?: HTMLElement | null]; changeStatus: [supplier: Supplier, invoker?: HTMLElement | null]; delete: [supplier: Supplier, invoker?: HTMLElement | null]; refresh: []; create: []; 'clear-filters': [] }>()
const search = defineModel<string>('search', { default: '' })
const root = useTemplateRef<HTMLElement>('root')
const data = computed(() => [...props.items])
// "Nada todavía" vs "sin resultados": the table picks by `filtered`; the create action only shows with permission.
const emptyState = computed(() => ({
  title: 'Aún no hay proveedores',
  description: 'Los proveedores que registres aparecerán aquí.',
  ...(props.canCreate ? { actionLabel: 'Crear proveedor' } : {}),
}))
const hasActions = computed(() => props.canEdit || !!props.canDelete)
const columns = computed<TableColumn<Supplier, unknown>[]>(() => [
  { accessorKey: 'displayName', header: 'Proveedor', enableSorting: false },
  { accessorKey: 'status', header: 'Estado', enableSorting: false },
  { accessorKey: 'updatedAt', header: 'Actualizado', enableSorting: false },
  ...(hasActions.value ? [{ id: 'actions', header: 'Acciones', enableSorting: false, meta: { class: { th: 'w-16', td: 'w-16 text-right' } } }] : []),
])
// Premium tables T9: the user's column layout (order, pinning, widths, visibility, density) is kept per table.
const { columnOrder, columnPinning, columnSizing, columnVisibility, density, reset: resetLayout } = useTablePreferences({
  persistKey: 'procurement-suppliers',
  columnIds: () => columns.value.map(column => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')),
})
// The one useful second line: the first filled line of the terms, if any.
const terms = (supplier: Supplier) => supplier.termsText?.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ''
const archived = (supplier: Supplier) => supplier.status === 'ARCHIVED'
function actionsFor(supplier: Supplier): RowAction[] {
  const disabled = props.disabled
  return [
    ...(props.canEdit ? [
      { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil', disabled },
      { key: 'status', label: archived(supplier) ? 'Reactivar' : 'Archivar', icon: archived(supplier) ? 'i-lucide-archive-restore' : 'i-lucide-archive', disabled },
    ] : []),
    ...(props.canDelete ? [{ key: 'delete', label: 'Eliminar', icon: 'i-lucide-trash-2', destructive: true, disabled }] : []),
  ]
}
const detailButtons = () => Array.from(root.value?.querySelectorAll<HTMLElement>('[data-supplier-id]') ?? [])
const nameButton = (supplier: Supplier) => detailButtons().find(button => button.dataset.supplierId === supplier.id) ?? null
// While a row menu is open its trigger is the only expanded menu button; it is
// where focus belongs once the action's overlay closes.
const menuTrigger = () => root.value?.querySelector<HTMLElement>('button[aria-haspopup="menu"][aria-expanded="true"]') ?? null
function onAction(key: string, supplier: Supplier) {
  const invoker = menuTrigger()
  if (key === 'edit') emit('open', supplier, invoker)
  else if (key === 'status') emit('changeStatus', supplier, invoker)
  else if (key === 'delete') emit('delete', supplier, invoker)
}
// The whole row opens the supplier: AppDataTable's `row-open` for table rows, `rowProps` for cards. The name button is the tab stop, so neither is focusable itself.
function open(supplier: Supplier) {
  if (!props.disabled) emit('open', supplier, nameButton(supplier))
}
const clickable = useClickableRow<Supplier>(open, { focusable: false })
</script>

<template>
  <div ref="root" class="supplier-list">
    <AppDataTable
      v-model:global-filter="search"
      v-model:column-order="columnOrder"
      v-model:column-pinning="columnPinning"
      v-model:column-sizing="columnSizing"
      v-model:column-visibility="columnVisibility"
      v-model:density="density"
      :persist-layout="true"
      :columns="columns" :data="data" :loading="loading" :fetching="fetching" :error="error"
      error-message="No se pudieron cargar los proveedores"
      :empty-state="emptyState" :filtered="filtered" no-match-title="Ningún proveedor con estos filtros"
      :row-open="open" display-mode="auto" mobile-render="cards" search-placeholder="Buscar proveedor..."
      portal-class="hf-theme hf-ui suppliers-list-portal"
      :active-filter-count="activeFilterCount"
      class="hf-data-table" @refresh="emit('refresh')" @empty-action="emit('create')" @clear-filters="emit('clear-filters')"
      @reset-columns="resetLayout"
    >
      <template #filters><slot name="filters" /></template>
      <template #actions><slot name="actions" /></template>
      <template #displayName-cell="{ row }">
        <button type="button" data-testid="supplier-detail" class="hf-row-primary supplier-name" :data-supplier-id="row.original.id" :disabled="disabled" @click="emit('open', row.original, $event.currentTarget as HTMLElement)">{{ row.original.displayName }}</button>
        <span v-if="terms(row.original)" class="hf-row-secondary">{{ terms(row.original) }}</span>
      </template>
      <template #status-cell="{ row }"><StatusBadge :label="archived(row.original) ? 'Archivado' : 'Activo'" :tone="archived(row.original) ? 'neutral' : 'success'" /></template>
      <template #updatedAt-cell="{ row }"><span class="supplier-date">{{ formatShortDateTime(row.original.updatedAt) }}</span></template>
      <template #actions-header><span class="sr-only">Acciones</span></template>
      <template #actions-cell="{ row }">
        <RowActionsMenu :actions="actionsFor(row.original)" :row-label="row.original.displayName" portal-class="suppliers-portal" @select="onAction($event, row.original)" />
      </template>
      <template #mobile-card="{ row }">
        <article v-bind="clickable.rowProps(row)" class="supplier-card">
          <div class="supplier-card-heading">
            <div class="supplier-card-title">
              <button type="button" data-testid="supplier-detail" class="hf-row-primary supplier-name" :data-supplier-id="row.id" :disabled="disabled" @click="emit('open', row, $event.currentTarget as HTMLElement)">{{ row.displayName }}</button>
              <span v-if="terms(row)" class="hf-row-secondary">{{ terms(row) }}</span>
            </div>
            <RowActionsMenu class="supplier-card-menu" :actions="actionsFor(row)" :row-label="row.displayName" portal-class="suppliers-portal" @select="onAction($event, row)" />
          </div>
          <div class="supplier-card-footer">
            <StatusBadge :label="archived(row) ? 'Archivado' : 'Activo'" :tone="archived(row) ? 'neutral' : 'success'" />
            <span class="supplier-date">{{ formatShortDateTime(row.updatedAt) }}</span>
          </div>
        </article>
      </template>
    </AppDataTable>
  </div>
</template>

<style scoped>
.supplier-name { text-align: left; }
.supplier-card .supplier-name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; white-space: normal; }
.supplier-date { color: var(--hf-muted); font-size: 13px; white-space: nowrap; }
.supplier-card { min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.supplier-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.supplier-card-menu { margin: -8px -8px 0 0; flex-shrink: 0; }
.supplier-card-title { min-width: 0; }
.supplier-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--hf-border); margin-top: 12px; padding-top: 12px; }
button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
button:disabled { opacity: .6; cursor: not-allowed; }
</style>
