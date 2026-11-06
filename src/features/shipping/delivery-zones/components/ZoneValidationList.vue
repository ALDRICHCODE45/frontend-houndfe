<script setup lang="ts">
/**
 * ZoneValidationList — the pending queue, earliest deadline first (server
 * order): postal code and place, live urgency and countdown, requesters and
 * the customer's last message. The whole row opens the validation.
 */
import { computed } from 'vue'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { TableColumn } from '@/core/shared/types/table.types'
import type { ZoneValidation } from '../interfaces/delivery-zone.types'
import { formatCountdown, liveUrgencyLevel, urgencyBadge } from '../utils/urgency'

const props = defineProps<{
  validations: readonly ZoneValidation[]
  now: number
  loading?: boolean
  fetching?: boolean
  error?: boolean
  totalCount: number
  pageCount: number
}>()
const emit = defineEmits<{ open: [validation: ZoneValidation]; refresh: [] }>()
const pagination = defineModel<{ pageIndex: number; pageSize: number }>('pagination', { required: true })

const data = computed(() => [...props.validations])
const showingFrom = computed(() => (data.value.length ? pagination.value.pageIndex * pagination.value.pageSize + 1 : 0))
const showingTo = computed(() => (data.value.length ? showingFrom.value + data.value.length - 1 : 0))
const emptyState = {
  title: 'No hay validaciones pendientes',
  description: 'Cuando un cliente pida envío a un código postal nuevo, aparecerá aquí.',
}

const columns: TableColumn<ZoneValidation, unknown>[] = [
  { accessorKey: 'zipCode', header: 'Código postal', enableSorting: false },
  { id: 'urgency', header: 'Plazo', enableSorting: false },
  { accessorKey: 'requesterCount', header: 'Clientes', enableSorting: false, meta: { class: { th: 'text-right', td: 'text-right' } } },
  { accessorKey: 'lastCustomerMessageAt', header: 'Último mensaje', enableSorting: false },
]

const place = (validation: ZoneValidation) =>
  [validation.neighborhood, validation.municipality].filter(Boolean).join(', ')
const requesters = (count: number) => (count === 1 ? '1 cliente' : `${count} clientes`)
const badgeOf = (validation: ZoneValidation) => {
  const level = liveUrgencyLevel(validation.urgency, props.now)
  return level ? urgencyBadge(level) : null
}
const countdownOf = (validation: ZoneValidation) =>
  validation.urgency && liveUrgencyLevel(validation.urgency, props.now) !== 'EXPIRED'
    ? formatCountdown(validation.urgency.deadlineAt, props.now)
    : ''

const clickable = useClickableRow<ZoneValidation>((validation) => emit('open', validation), { focusable: false })
</script>

<template>
  <AppDataTable
    v-model:pagination="pagination"
    :columns="columns"
    :data="data"
    :loading="loading"
    :fetching="fetching"
    :error="error"
    error-message="No se pudieron cargar las validaciones"
    :empty-state="emptyState"
    :row-open="(validation: ZoneValidation) => emit('open', validation)"
    :page-count="pageCount"
    :total-count="totalCount"
    :showing-from="showingFrom"
    :showing-to="showingTo"
    :page-size-options="[20, 50, 100]"
    :show-toolbar="false"
    display-mode="auto"
    mobile-render="cards"
    pagination-portal-class="hf-theme hf-ui zone-validations-portal"
    class="hf-data-table"
    @refresh="emit('refresh')"
  >
    <template #zipCode-cell="{ row }">
      <button type="button" class="hf-row-primary validation-zip" @click="emit('open', row.original)">
        {{ row.original.zipCode }}
      </button>
      <span v-if="place(row.original)" class="hf-row-secondary">{{ place(row.original) }}</span>
    </template>
    <template #urgency-cell="{ row }">
      <span class="validation-urgency">
        <StatusBadge
          v-if="badgeOf(row.original)"
          :label="badgeOf(row.original)!.label"
          :tone="badgeOf(row.original)!.tone"
          :urgent="badgeOf(row.original)!.urgent"
          aria-prefix="Plazo:"
        />
        <span v-if="countdownOf(row.original)" class="validation-countdown">{{ countdownOf(row.original) }}</span>
      </span>
    </template>
    <template #requesterCount-cell="{ row }"><span class="hf-figure">{{ requesters(row.original.requesterCount) }}</span></template>
    <template #lastCustomerMessageAt-cell="{ row }">
      <span class="validation-meta">{{ formatShortDateTime(row.original.lastCustomerMessageAt) }}</span>
    </template>

    <template #mobile-card="{ row }">
      <article v-bind="clickable.rowProps(row)" class="validation-card">
        <div class="validation-card-title">
          <button type="button" class="hf-row-primary validation-zip" @click="emit('open', row)">{{ row.zipCode }}</button>
          <span v-if="place(row)" class="hf-row-secondary">{{ place(row) }}</span>
        </div>
        <span class="validation-urgency">
          <StatusBadge v-if="badgeOf(row)" :label="badgeOf(row)!.label" :tone="badgeOf(row)!.tone" :urgent="badgeOf(row)!.urgent" aria-prefix="Plazo:" />
          <span v-if="countdownOf(row)" class="validation-countdown">{{ countdownOf(row) }}</span>
        </span>
        <div class="validation-card-footer">
          <span>{{ requesters(row.requesterCount) }}</span>
          <span>{{ formatShortDateTime(row.lastCustomerMessageAt) }}</span>
        </div>
      </article>
    </template>
  </AppDataTable>
</template>

<style scoped>
.validation-zip { text-align: left; font-variant-numeric: tabular-nums; }
.validation-urgency { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.validation-countdown { color: var(--hf-ink); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.validation-meta { color: var(--hf-muted); font-size: 13px; white-space: nowrap; }
.validation-card { display: grid; gap: 12px; min-width: 0; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 16px; }
.validation-card-title { display: grid; min-width: 0; }
.validation-card-footer { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--hf-border); padding-top: 12px; color: var(--hf-muted); font-size: 13px; }
button:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
</style>
