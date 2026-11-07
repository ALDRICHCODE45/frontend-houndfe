<script setup lang="ts">
/**
 * DeliveryZoneList — the zones table (cards below md): postal code with its
 * place, type badge, surcharge in pesos, delivery days and who saved it.
 * Row actions only with manage:DeliveryZone; otherwise the list is read-only.
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { DeliveryZone, DeliveryZoneType } from '../interfaces/delivery-zone.types'
import { formatEtaDays, ZONE_TYPE_LABELS } from '../utils/zoneForm'

const props = defineProps<{
  zones: readonly DeliveryZone[]
  canManage: boolean
  loading?: boolean
  fetching?: boolean
  error?: boolean
  filtered?: boolean
  totalCount: number
  pageCount: number
  activeFilterCount?: number
}>()
const emit = defineEmits<{
  edit: [zone: DeliveryZone]
  deactivate: [zone: DeliveryZone]
  create: []
  refresh: []
  'clear-filters': []
}>()
const search = defineModel<string>('search', { default: '' })
const pagination = defineModel<{ pageIndex: number; pageSize: number }>('pagination', { required: true })

const data = computed(() => [...props.zones])
const showingFrom = computed(() => (data.value.length ? pagination.value.pageIndex * pagination.value.pageSize + 1 : 0))
const showingTo = computed(() => (data.value.length ? showingFrom.value + data.value.length - 1 : 0))
const emptyState = computed(() => ({
  title: 'Aún no hay zonas de entrega',
  description: 'Los códigos postales que configures o apruebes aparecerán aquí.',
  ...(props.canManage ? { actionLabel: 'Nueva zona' } : {}),
}))

const columns = computed<TableColumn<DeliveryZone, unknown>[]>(() => [
  { accessorKey: 'zipCode', header: 'Código postal', enableSorting: false },
  { accessorKey: 'type', header: 'Tipo', enableSorting: false },
  { accessorKey: 'surchargeCents', header: 'Cargo', enableSorting: false, meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'etaDays', header: 'Entrega', enableSorting: false },
  { accessorKey: 'approvedBy', header: 'Guardada por', enableSorting: false },
  ...(props.canManage
    ? [{ id: 'actions', header: 'Acciones', enableSorting: false, meta: { class: { th: 'w-16', td: 'w-16 text-right' } } }]
    : []),
])

// Premium tables T9: the user's column layout (order, pinning, widths, visibility, density) is kept per table.
const { columnOrder, columnPinning, columnSizing, columnVisibility, density, reset: resetLayout } = useTablePreferences({
  persistKey: 'shipping-delivery-zones',
  columnIds: () => columns.value.map(column => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')),
})

const TYPE_TONES: Record<DeliveryZoneType, 'success' | 'info' | 'neutral'> = {
  FREE: 'success',
  SURCHARGE: 'info',
  CARRIER_ONLY: 'neutral',
  DENIED: 'neutral',
}

const typeLabel = (zone: DeliveryZone) => ZONE_TYPE_LABELS[zone.type]
const typeTone = (zone: DeliveryZone) => TYPE_TONES[zone.type]
const place = (zone: DeliveryZone) => [zone.neighborhood, zone.municipality].filter(Boolean).join(', ')
const fullPlace = (zone: DeliveryZone) => [zone.neighborhood, zone.municipality, zone.state].filter(Boolean).join(', ')
const surcharge = (zone: DeliveryZone) => (zone.surchargeCents === null ? '—' : formatCentsMXN(zone.surchargeCents))
const savedWhen = (zone: DeliveryZone) => (zone.approvedAt ? formatShortDateTime(zone.approvedAt) : '')
const rowLabel = (zone: DeliveryZone) => `la zona ${zone.zipCode}${place(zone) ? `, ${place(zone)}` : ''}`

function actionsFor(zone: DeliveryZone): RowAction[] {
  if (!zone.isActive) return [{ key: 'edit', label: 'Reactivar…', icon: 'i-lucide-rotate-ccw' }]
  return [
    { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' },
    { key: 'deactivate', label: 'Desactivar…', icon: 'i-lucide-power-off', destructive: true },
  ]
}
function onAction(key: string, zone: DeliveryZone) {
  if (key === 'edit') emit('edit', zone)
  else if (key === 'deactivate') emit('deactivate', zone)
}
function open(zone: DeliveryZone) {
  if (props.canManage) emit('edit', zone)
}
const clickable = useClickableRow<DeliveryZone>(open, { focusable: false })
</script>

<template>
  <AppDataTable
    v-model:column-order="columnOrder"
    v-model:column-pinning="columnPinning"
    v-model:column-sizing="columnSizing"
    v-model:column-visibility="columnVisibility"
    v-model:density="density"
    :persist-layout="true"
    v-model:global-filter="search"
    v-model:pagination="pagination"
    :columns="columns"
    :data="data"
    :loading="loading"
    :fetching="fetching"
    :error="error"
    error-message="No se pudieron cargar las zonas"
    :empty-state="emptyState"
    :filtered="filtered"
    no-match-title="Ninguna zona con estos filtros"
    :row-open="canManage ? open : undefined"
    :page-count="pageCount"
    :total-count="totalCount"
    :showing-from="showingFrom"
    :showing-to="showingTo"
    :page-size-options="[20, 50, 100]"
    display-mode="auto"
    mobile-render="cards"
    search-placeholder="Buscar por código postal o colonia..."
    portal-class="hf-theme hf-ui delivery-zones-portal"
    pagination-portal-class="hf-theme hf-ui delivery-zones-portal"
    :active-filter-count="activeFilterCount"
    class="hf-data-table"
    @refresh="emit('refresh')"
    @empty-action="emit('create')"
    @clear-filters="emit('clear-filters')"
    @reset-columns="resetLayout"
  >
    <template #filters><slot name="filters" /></template>
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>

    <template #zipCode-cell="{ row }">
      <button
        v-if="canManage"
        type="button"
        class="hf-row-primary zone-zip"
        :title="fullPlace(row.original)"
        @click="emit('edit', row.original)"
      >
        {{ row.original.zipCode }}
      </button>
      <span v-else class="hf-row-primary zone-zip">{{ row.original.zipCode }}</span>
      <span v-if="place(row.original)" class="hf-row-secondary" :title="fullPlace(row.original)">{{ place(row.original) }}</span>
    </template>
    <template #type-cell="{ row }">
      <span class="zone-badges">
        <StatusBadge :label="typeLabel(row.original)" :tone="typeTone(row.original)" aria-prefix="Tipo:" />
        <StatusBadge v-if="!row.original.isActive" label="Inactiva" tone="neutral" />
      </span>
    </template>
    <template #surchargeCents-cell="{ row }"><span class="hf-figure">{{ surcharge(row.original) }}</span></template>
    <template #etaDays-cell="{ row }">{{ formatEtaDays(row.original.etaDays) }}</template>
    <template #approvedBy-cell="{ row }">
      <span v-if="row.original.approvedBy" class="zone-who">{{ row.original.approvedBy.displayName }}</span>
      <span v-if="savedWhen(row.original)" class="hf-row-secondary">{{ savedWhen(row.original) }}</span>
    </template>
    <template #actions-header><span class="sr-only">Acciones</span></template>
    <template #actions-cell="{ row }">
      <RowActionsMenu
        :actions="actionsFor(row.original)"
        :row-label="rowLabel(row.original)"
        portal-class="delivery-zones-portal"
        @select="onAction($event, row.original)"
      />
    </template>

    <template #mobile-card="{ row }">
      <article v-bind="canManage ? clickable.rowProps(row) : {}" class="zone-card">
        <div class="zone-card-heading">
          <div class="zone-card-title">
            <button v-if="canManage" type="button" class="hf-row-primary zone-zip" @click="emit('edit', row)">{{ row.zipCode }}</button>
            <span v-else class="hf-row-primary zone-zip">{{ row.zipCode }}</span>
            <span v-if="place(row)" class="hf-row-secondary">{{ place(row) }}</span>
          </div>
          <RowActionsMenu
            v-if="canManage"
            class="zone-card-menu"
            :actions="actionsFor(row)"
            :row-label="rowLabel(row)"
            portal-class="delivery-zones-portal"
            @select="onAction($event, row)"
          />
        </div>
        <div class="zone-badges">
          <StatusBadge :label="typeLabel(row)" :tone="typeTone(row)" aria-prefix="Tipo:" />
          <StatusBadge v-if="!row.isActive" label="Inactiva" tone="neutral" />
        </div>
        <div class="zone-card-footer">
          <span>{{ formatEtaDays(row.etaDays) }}</span>
          <span class="hf-figure zone-card-money">{{ surcharge(row) }}</span>
        </div>
      </article>
    </template>
  </AppDataTable>
</template>

<style scoped>
.zone-zip { text-align: left; font-variant-numeric: tabular-nums; }
.zone-badges { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.zone-who { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.zone-card { min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; display: grid; gap: 12px; }
.zone-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.zone-card-title { display: grid; min-width: 0; }
.zone-card-menu { margin: -8px -8px 0 0; flex-shrink: 0; }
.zone-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--hf-border); padding-top: 12px; color: var(--hf-muted); font-size: 13px; }
.zone-card-money { color: var(--hf-ink); font-weight: 600; }
button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
</style>
