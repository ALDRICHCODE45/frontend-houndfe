<script setup lang="ts">
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import DataTableToolbar from '@/core/shared/components/DataTable/DataTableToolbar.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { PurchaseOrderSummary } from '../interfaces/purchase-order.types'
import { avisoLabel, orderRowActions, orderRowLabel, orderTotals, statusLabels, statusTones, type OrderRowActionKey } from '../utils/order-presentation'
const props = defineProps<{ items: readonly PurchaseOrderSummary[]; canEdit: boolean; canDelete: boolean; canConfirm?: boolean; canCancel?: boolean; loading?: boolean; fetching?: boolean; error?: boolean; disabled?: boolean; activeFilterCount?: number }>()
// `origin` is the row's primary button: the element focus returns to when the order it opened is closed.
const emit = defineEmits<{ open: [order: PurchaseOrderSummary, origin: HTMLElement | null]; confirm: [order: PurchaseOrderSummary, origin: HTMLElement | null]; cancel: [order: PurchaseOrderSummary, origin: HTMLElement | null]; discard: [order: PurchaseOrderSummary]; refresh: []; 'clear-filters': [] }>()
const search = defineModel<string>('search', { default: '' })
const data = computed(() => [...props.items])
const right = { class: { th: 'text-right', td: 'text-right' } }
const columns: TableColumn<PurchaseOrderSummary, unknown>[] = [
  { id: 'supplier', header: 'Proveedor', enableSorting: false },
  { id: 'status', header: 'Estado', enableSorting: false },
  { accessorKey: 'lineCount', header: 'Renglones', enableSorting: false, meta: right },
  { id: 'total', header: 'Total', enableSorting: false, meta: right },
  { accessorKey: 'updatedAt', header: 'Actualizada', enableSorting: false },
  { id: 'actions', header: 'Acciones', enableSorting: false },
]
const primaries = new Map<string, HTMLElement>()
function setPrimary(id: string, element: unknown) { if (element instanceof HTMLElement) primaries.set(id, element); else primaries.delete(id) }
const originOf = (order: PurchaseOrderSummary) => primaries.get(order.id) ?? null
function open(order: PurchaseOrderSummary) { if (!props.disabled) emit('open', order, originOf(order)) }
const actionsFor = (order: PurchaseOrderSummary) => orderRowActions(order, { canEdit: props.canEdit, canConfirm: Boolean(props.canConfirm), canCancel: Boolean(props.canCancel), canDelete: props.canDelete, disabled: props.disabled })
function run(key: string, order: PurchaseOrderSummary) {
  const action = key as OrderRowActionKey
  if (props.disabled) return
  if (action === 'open') open(order)
  else if (action === 'confirm') emit('confirm', order, originOf(order))
  else if (action === 'cancel') emit('cancel', order, originOf(order))
  else if (action === 'discard') emit('discard', order)
}
// The whole row opens the order. The primary cell holds a real button (the tab stop), so rows are not focusable themselves.
const { rowProps, onClick } = useClickableRow<PurchaseOrderSummary>(open, { focusable: false })
// AppDataTable does not forward row attributes or UTable's select, so table rows are resolved from one delegated click.
function onTableClick(event: MouseEvent) {
  const row = (event.target as Element | null)?.closest('tbody tr')
  const order = row && props.items[Array.prototype.indexOf.call(row.parentElement?.children ?? [], row)]
  if (order) onClick(event, order)
}
const statusOf = (order: PurchaseOrderSummary) => ({ label: statusLabels[order.status], tone: statusTones[order.status] })
const lines = (count: number) => `${count} ${count === 1 ? 'renglón' : 'renglones'}`
</script>

<template>
  <div class="order-list">
    <!-- AppDataTable always wraps #filters, even when absent. Compose its own
         shared toolbar directly so an empty wrapper cannot create Filtros. -->
    <DataTableToolbar v-model:global-filter="search" search-placeholder="Buscar por proveedor o nota..." portal-class="hf-theme hf-ui" :active-filter-count="activeFilterCount" @clear-filters="emit('clear-filters')">
      <template v-if="$slots.filters" #filters><slot name="filters" /></template>
      <template #actions><slot name="actions" /></template>
    </DataTableToolbar>
    <div class="order-table" @click="onTableClick">
      <AppDataTable :show-toolbar="false" :columns="columns" :data="data" :loading="loading" :fetching="fetching" :error="error"
        error-message="No se pudieron cargar las órdenes. Puedes volver a actualizar."
        empty="No hay órdenes de compra." display-mode="auto" mobile-render="cards"
        class="hf-data-table" @refresh="emit('refresh')">
        <template #supplier-cell="{ row }">
          <div class="order-supplier">
            <span class="order-supplier-line">
              <button :ref="element => setPrimary(row.original.id, element)" type="button" class="hf-row-primary order-row-link" :aria-disabled="disabled ? 'true' : undefined" @click="open(row.original)">{{ row.original.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</button>
              <StatusBadge v-if="row.original.supplierDisplaySnapshot?.status === 'ARCHIVED'" label="Archivado" tone="neutral" aria-prefix="Proveedor:" />
            </span>
            <span v-if="row.original.note" class="hf-row-secondary">{{ row.original.note }}</span>
          </div>
        </template>
        <template #status-cell="{ row }">
          <div class="order-status-cell">
            <StatusBadge data-testid="order-status" v-bind="statusOf(row.original)" />
            <span v-if="row.original.issueCount > 0" data-testid="order-aviso" class="order-aviso"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />{{ avisoLabel(row.original.issueCount) }}</span>
          </div>
        </template>
        <template #total-cell="{ row }">
          <div data-testid="order-total" class="hf-figure order-total">
            <template v-if="orderTotals(row.original).length">
              <span v-for="entry in orderTotals(row.original)" :key="entry.key" class="order-total-entry">{{ entry.text }} <small v-if="entry.label" class="order-total-basis">{{ entry.label }}</small></span>
            </template>
            <span v-else>—</span>
          </div>
        </template>
        <template #updatedAt-cell="{ row }"><span class="order-when">{{ formatShortDateTime(row.original.updatedAt) }}</span></template>
        <template #actions-header><span class="sr-only">Acciones</span></template>
        <template #actions-cell="{ row }">
          <RowActionsMenu :actions="actionsFor(row.original)" :row-label="orderRowLabel(row.original)" portal-class="purchase-orders-portal" @select="run($event, row.original)" />
        </template>
        <template #mobile-card="{ row }">
          <article class="order-card" v-bind="rowProps(row)">
            <div class="order-card-head">
              <button :ref="element => setPrimary(row.id, element)" type="button" class="hf-row-primary order-row-link" :aria-disabled="disabled ? 'true' : undefined" @click="open(row)">{{ row.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</button>
              <RowActionsMenu :actions="actionsFor(row)" :row-label="orderRowLabel(row)" portal-class="purchase-orders-portal" @select="run($event, row)" />
            </div>
            <span v-if="row.note" class="hf-row-secondary">{{ row.note }}</span>
            <div class="order-card-meta">
              <StatusBadge v-if="row.supplierDisplaySnapshot?.status === 'ARCHIVED'" label="Archivado" tone="neutral" aria-prefix="Proveedor:" />
              <StatusBadge data-testid="order-status" v-bind="statusOf(row)" />
              <span v-if="row.issueCount > 0" data-testid="order-aviso" class="order-aviso"><UIcon name="i-lucide-triangle-alert" aria-hidden="true" />{{ avisoLabel(row.issueCount) }}</span>
            </div>
            <div class="order-card-footer">
              <span class="order-card-summary">{{ lines(row.lineCount) }} ·
                <span data-testid="order-total" class="hf-figure order-total">
                  <template v-if="orderTotals(row).length"><span v-for="entry in orderTotals(row)" :key="entry.key" class="order-total-entry">{{ entry.text }} <small v-if="entry.label" class="order-total-basis">{{ entry.label }}</small></span></template>
                  <span v-else>—</span>
                </span>
              </span>
              <span>{{ formatShortDateTime(row.updatedAt) }}</span>
            </div>
          </article>
        </template>
      </AppDataTable>
    </div>
  </div>
</template>

<style scoped>
.order-list { display: grid; gap: 16px; min-width: 0; }
.order-table { min-width: 0; }
.order-supplier { min-width: 0; }
.order-supplier-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.order-row-link { padding: 0; border: 0; background: none; text-align: left; font-size: 14px; cursor: pointer; }
.order-row-link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; border-radius: 4px; }
.order-status-cell { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
.order-aviso { display: inline-flex; align-items: center; gap: 4px; color: var(--hf-warning); font-size: 12px; font-weight: 600; white-space: nowrap; }
.order-total { display: grid; justify-items: end; gap: 2px; }
.order-total-entry { display: block; white-space: nowrap; }
.order-total-basis { color: var(--hf-muted); font-size: 11px; font-weight: 400; }
.order-when { color: var(--hf-muted); white-space: nowrap; }
/* Rows open on click (delegated above), so they look and hover like the shared clickable row. */
:deep(tbody tr[data-slot='tr']) { cursor: pointer; }
:deep(tbody tr[data-slot='tr']:hover), :deep(tbody tr[data-slot='tr']:focus-within) { background-color: color-mix(in srgb, var(--hf-surface-muted) 45%, var(--hf-surface)); }
.order-card { position: relative; min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.order-card-head { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
.order-card-head .order-row-link { flex: 1; min-width: 0; padding-top: 2px; font-size: 15px; line-height: 1.4; white-space: normal; }
.order-card-head > :last-child { margin: -8px -8px 0 0; flex: none; }
.order-card .hf-row-secondary { padding-right: 8px; }
.order-card-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.order-card-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--hf-border); color: var(--hf-muted); font-size: 13px; }
.order-card-summary { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 4px; min-width: 0; }
.order-card-summary .order-total { display: inline-flex; flex-wrap: wrap; gap: 0 8px; justify-items: start; color: var(--hf-ink); font-weight: 600; }
:deep(table[data-slot='base']) { table-layout: fixed; }
:deep(th[data-slot='th']:nth-child(2)) { width: 200px; }
:deep(th[data-slot='th']:nth-child(3)) { width: 104px; }
:deep(th[data-slot='th']:nth-child(4)) { width: 148px; }
:deep(th[data-slot='th']:nth-child(5)) { width: 136px; }
:deep(th[data-slot='th']:nth-child(6)) { width: 72px; }
:deep(td[data-slot='td']) { height: 64px; vertical-align: middle; }
:deep(td[data-slot='td']:last-child) { padding-inline: 8px; }
</style>
