<script setup lang="ts">
/**
 * EligibleSalesPicker — Multi-select picker for confirmed sales that are
 * eligible for inclusion in a delivery route (PENDING + SHIPPED).
 *
 * Contract (sdd delivery-routes, design.md §4.1, §6.2):
 *   - Multi-select over `useEligibleSales` (which already filters by
 *     `deliveryStatus: ['PENDING', 'SHIPPED']` server-side).
 *   - v-model + update:selected emit shape (string[]).
 *   - Renders sales verbatim — the SHIPPED row passes through (REQ-SALES-DR-001
 *     regression pin against the S1a SHIPPED addition).
 *   - Empty state: "No hay ventas pendientes o enviadas".
 *   - Loading + error states are surfaced via dedicated elements.
 *
 * The picker is a thin presentation layer — eligibility is owned by the inner
 * `useEligibleSales` composable (S4a). The backend re-validates eligibility
 * on create (DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE → 422 inline, design §7.2).
 *
 * Selected sales are also surfaced as explicit chips below the trigger (with
 * clear buttons) so the slideover can render "N ventas seleccionadas" without
 * depending on USelectMenu internals, AND so tests can assert SHIPPED row
 * passthrough via the chip label without navigating the dropdown.
 */
import { computed } from 'vue'
import { useEligibleSales } from '../composables/useEligibleSales'

interface EligibleSaleRow {
  id: string
  folio: string
  totalCents: number
  customer: { id: string, name: string } | null
  deliveryStatus: string
}

const props = withDefaults(
  defineProps<{
    /** Selected sale ids, or `[]` when no selection. */
    modelValue: readonly string[]
    /** Visual required marker — does not gate validation (slideover owns zod). */
    required?: boolean
    /** Whether the picker is disabled. */
    disabled?: boolean
    /** Optional placeholder text. */
    placeholder?: string
    /** Optional inline field error. */
    error?: string
  }>(),
  {
    required: false,
    disabled: false,
    placeholder: 'Selecciona ventas pendientes o enviadas',
    error: '',
  },
)

const emit = defineEmits<{
  'update:selected': [value: string[]]
}>()

const { data, isLoading, isError, error } = useEligibleSales()

const eligibleSales = computed<EligibleSaleRow[]>(() => (data.value ?? []) as EligibleSaleRow[])

/**
 * USelectMenu value-key approach: resolve the selected ids against the
 * eligible sales list and pass the full row objects. USelectMenu's display
 * value derives from the matching item's label.
 */
const selectedRows = computed<EligibleSaleRow[]>(() => {
  if (!props.modelValue.length) return []
  const byId = new Map(eligibleSales.value.map((s) => [s.id, s]))
  return props.modelValue
    .map((id) => byId.get(id))
    .filter((row): row is EligibleSaleRow => row !== undefined)
})

const isEmpty = computed(() => !isLoading.value && !isError.value && eligibleSales.value.length === 0)
const errorMessage = computed(() => {
  const err = error.value
  if (!err) return ''
  return err instanceof Error ? err.message : String(err)
})

function deliveryStatusLabel(status: string): string {
  if (status === 'SHIPPED') return 'Enviada'
  if (status === 'PENDING') return 'Pendiente'
  return status
}

function onUpdate(next: EligibleSaleRow[] | EligibleSaleRow | null) {
  if (Array.isArray(next)) {
    emit('update:selected', next.map((row) => row.id))
    return
  }
  emit('update:selected', next ? [next.id] : [])
}

function removeSale(id: string) {
  emit(
    'update:selected',
    props.modelValue.filter((existing) => existing !== id),
  )
}
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="eligible-sales-picker">
    <USelectMenu
      :model-value="selectedRows"
      :items="eligibleSales"
      value-key="id"
      label-key="folio"
      :loading="isLoading"
      :disabled="disabled"
      :placeholder="placeholder"
      multiple
      ignore-filter
      class="w-full"
      data-testid="eligible-sales-picker-trigger"
      @update:model-value="onUpdate"
    >
      <template #item-label="{ item }">
        <div class="flex flex-col gap-0.5 py-0.5">
          <span class="font-medium text-default">{{ item.folio }}</span>
          <span class="text-xs text-muted">
            {{ item.customer?.name ?? 'Cliente sin nombre' }}
            · {{ deliveryStatusLabel(item.deliveryStatus) }}
          </span>
        </div>
      </template>

      <template #empty>
        <p
          v-if="isEmpty"
          class="p-2 text-center text-sm text-muted"
          data-testid="eligible-sales-picker-empty"
        >
          No hay ventas pendientes o enviadas
        </p>
      </template>
    </USelectMenu>

    <!-- Inline empty-state copy so the empty message is reachable without
         opening the dropdown (matches the contract: the empty copy is a
         visible page-level affordance, not a dropdown-only label). -->
    <p
      v-if="isEmpty"
      class="text-sm text-muted"
      data-testid="eligible-sales-picker-empty-inline"
    >
      No hay ventas pendientes o enviadas
    </p>

    <!-- Selected sales chips (folio + delivery status) so the slideover can
         render a stable "N ventas seleccionadas" summary AND so tests can
         assert SHIPPED passthrough via the chip label without navigating
         USelectMenu internals. -->
    <div
      v-if="selectedRows.length > 0"
      class="flex flex-wrap gap-2"
      data-testid="eligible-sales-picker-chips"
    >
      <span
        v-for="row in selectedRows"
        :key="row.id"
        class="inline-flex items-center gap-1 rounded-full border border-default bg-elevated/50 px-2 py-1 text-xs"
        :data-testid="`eligible-sales-picker-chip-${row.id}`"
      >
        <span :data-testid="`eligible-sales-picker-chip-label-${row.id}`">
          {{ row.folio }} · {{ deliveryStatusLabel(row.deliveryStatus) }}
        </span>
        <button
          type="button"
          :aria-label="`Quitar ${row.folio}`"
          class="inline-flex size-4 items-center justify-center rounded-full hover:bg-elevated"
          :data-testid="`eligible-sales-picker-chip-clear-${row.id}`"
          @click="removeSale(row.id)"
        >
          <UIcon name="i-lucide-x" class="size-3" />
        </button>
      </span>
    </div>

    <div
      v-if="isLoading"
      class="text-xs text-muted"
      data-testid="eligible-sales-picker-loading"
      aria-busy="true"
    >
      Cargando ventas elegibles…
    </div>

    <div
      v-if="isError"
      class="text-xs text-error"
      data-testid="eligible-sales-picker-error"
    >
      {{ errorMessage }}
    </div>

    <p
      v-if="required"
      class="text-xs text-muted"
      data-testid="eligible-sales-picker-required"
    >
      Requerido
    </p>

    <p
      v-if="error"
      class="text-xs text-error"
      data-testid="eligible-sales-picker-error-inline"
    >
      {{ error }}
    </p>
  </div>
</template>
