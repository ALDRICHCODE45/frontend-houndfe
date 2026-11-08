<script setup lang="ts">
/**
 * ShippingBoxList — the boxes as a table on desktop and cards on mobile
 * (handoff §5). Sizes in cm, weights in kg (S4); never an id (S6). Row actions
 * exist only with update:ShippingSettings: Editar, Retirar or Reactivar, and
 * Eliminar… last (S5). Presentational: the panel owns the data and commands.
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { useTablePreferences } from '@/core/shared/composables/useTablePreferences'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { ShippingBox } from '../interfaces/shipping-settings.types'
import { formatCm, formatKg } from '../utils/shippingUnits'

export type BoxRowAction = 'edit' | 'retire' | 'reactivate' | 'delete'

const props = defineProps<{
  boxes: readonly ShippingBox[]
  loading?: boolean
  fetching?: boolean
  error?: boolean
  canUpdate: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  action: [action: BoxRowAction, box: ShippingBox]
  create: []
  refresh: []
}>()

const data = computed(() => [...props.boxes])
const emptyState = computed(() => ({
  title: 'Aún no hay cajas',
  description: 'Las cotizaciones de paquetería usan la caja activa más chica donde quepa el pedido.',
  ...(props.canUpdate ? { actionLabel: 'Crear caja' } : {}),
}))

const columns = computed<TableColumn<ShippingBox, unknown>[]>(() => [
  { accessorKey: 'name', header: 'Caja', enableSorting: false },
  { id: 'weight', header: 'Peso de la caja', enableSorting: false },
  { id: 'capacity', header: 'Carga hasta', enableSorting: false },
  { accessorKey: 'isActive', header: 'Estado', enableSorting: false },
  ...(props.canUpdate
    ? [{ id: 'actions', header: 'Acciones', enableSorting: false, meta: { class: { th: 'w-16', td: 'w-16 text-right' } } }]
    : []),
])

// Premium tables T9: the user's column layout (order, pinning, widths, visibility, density) is kept per table.
const { columnOrder, columnPinning, columnSizing, columnVisibility, density, reset: resetLayout } = useTablePreferences({
  persistKey: 'shipping-boxes',
  columnIds: () => columns.value.map(column => column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')),
})

const size = (box: ShippingBox) =>
  `${formatCm(box.innerLengthCm)} × ${formatCm(box.innerWidthCm)} × ${formatCm(box.innerHeightCm)} cm`
const kg = (grams: number) => `${formatKg(grams)} kg`
const status = (box: ShippingBox) =>
  box.isActive ? { label: 'Activa', tone: 'success' as const } : { label: 'Retirada', tone: 'neutral' as const }

function actionsFor(box: ShippingBox): RowAction[] {
  const disabled = props.disabled
  return [
    { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil', disabled },
    box.isActive
      ? { key: 'retire', label: 'Retirar', icon: 'i-lucide-archive', disabled }
      : { key: 'reactivate', label: 'Reactivar', icon: 'i-lucide-archive-restore', disabled },
    { key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true, disabled },
  ]
}

function open(box: ShippingBox) {
  if (props.canUpdate && !props.disabled) emit('action', 'edit', box)
}
const clickable = useClickableRow<ShippingBox>(open, { focusable: false })
</script>

<template>
  <AppDataTable
    v-model:column-order="columnOrder"
    v-model:column-pinning="columnPinning"
    v-model:column-sizing="columnSizing"
    v-model:column-visibility="columnVisibility"
    v-model:density="density"
    :persist-layout="true"
    :show-toolbar="false"
    :columns="columns"
    :data="data"
    :loading="loading"
    :fetching="fetching"
    :error="error"
    error-message="No se pudieron cargar las cajas"
    :empty-state="emptyState"
    :row-open="canUpdate ? open : undefined"
    display-mode="auto"
    mobile-render="cards"
    class="hf-data-table"
    @refresh="emit('refresh')"
    @empty-action="emit('create')"
    @reset-columns="resetLayout"
  >
    <template #name-cell="{ row }">
      <button
        v-if="canUpdate"
        type="button"
        class="hf-row-primary box-name"
        :disabled="disabled"
        @click="emit('action', 'edit', row.original)"
      >
        {{ row.original.name }}
      </button>
      <span v-else class="hf-row-primary box-name">{{ row.original.name }}</span>
      <span class="hf-row-secondary box-size">Interior {{ size(row.original) }}</span>
    </template>
    <template #weight-cell="{ row }"><span class="hf-figure">{{ kg(row.original.weightG) }}</span></template>
    <template #capacity-cell="{ row }"><span class="hf-figure">{{ kg(row.original.maxContentWeightG) }}</span></template>
    <template #isActive-cell="{ row }">
      <StatusBadge :label="status(row.original).label" :tone="status(row.original).tone" />
    </template>
    <template #actions-header><span class="sr-only">Acciones</span></template>
    <template #actions-cell="{ row }">
      <RowActionsMenu
        :actions="actionsFor(row.original)"
        :row-label="row.original.name"
        portal-class="shipping-settings-portal"
        @select="emit('action', $event as BoxRowAction, row.original)"
      />
    </template>
    <template #mobile-card="{ row }">
      <article v-bind="canUpdate ? clickable.rowProps(row) : {}" class="box-card">
        <div class="box-card__heading">
          <div class="box-card__title">
            <button
              v-if="canUpdate"
              type="button"
              class="hf-row-primary box-name"
              :disabled="disabled"
              @click="emit('action', 'edit', row)"
            >
              {{ row.name }}
            </button>
            <span v-else class="hf-row-primary box-name">{{ row.name }}</span>
            <span class="hf-row-secondary box-size">Interior {{ size(row) }}</span>
          </div>
          <RowActionsMenu
            v-if="canUpdate"
            class="box-card__menu"
            :actions="actionsFor(row)"
            :row-label="row.name"
            portal-class="shipping-settings-portal"
            @select="emit('action', $event as BoxRowAction, row)"
          />
        </div>
        <div class="box-card__footer">
          <StatusBadge :label="status(row).label" :tone="status(row).tone" />
          <span class="box-card__weights hf-figure">Pesa {{ kg(row.weightG) }} · carga {{ kg(row.maxContentWeightG) }}</span>
        </div>
      </article>
    </template>
  </AppDataTable>
</template>

<style scoped>
.box-name { text-align: left; }
.box-size { display: block; text-align: left; font-variant-numeric: tabular-nums; }
.box-card { min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.box-card__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.box-card__title { display: grid; min-width: 0; gap: 2px; }
.box-card__menu { flex-shrink: 0; margin: -8px -8px 0 0; }
.box-card__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin-top: 12px; border-top: 1px solid var(--hf-border); padding-top: 12px; }
.box-card__weights { color: var(--hf-muted); font-size: 13px; }
button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
</style>
