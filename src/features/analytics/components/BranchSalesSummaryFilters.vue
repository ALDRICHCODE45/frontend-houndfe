<script setup lang="ts">
/**
 * BranchSalesSummaryFilters — controlled `[from, to)` boundary + preset controls
 * for the branch sales summary screen.
 *
 * Presentational only: it owns no transport, never calls the analytics composable,
 * and never recalculates preset dates. Boundaries stay exact `YYYY-MM-DD` Mexico
 * City calendar strings and are handed back verbatim through `update:from` /
 * `update:to`; a preset click emits only its committed `MexicoCityRangePresetId`
 * so the route view resolves the range through the shared calendar helpers.
 */
import { computed, useId } from 'vue'
import type { MexicoCityRangePresetId } from '@/core/shared/utils/mexicoCityCalendar'

const props = withDefaults(
  defineProps<{
    /** Inclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
    from: string
    /** Exclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
    to: string
    disabled?: boolean
    loading?: boolean
    /** Caller-owned validation text; this component invents no validation logic. */
    validationMessage?: string
  }>(),
  { disabled: false, loading: false, validationMessage: undefined },
)

const emit = defineEmits<{
  'update:from': [value: string]
  'update:to': [value: string]
  preset: [id: MexicoCityRangePresetId]
}>()

/** Preset id -> visible Spanish label, in display order. Dates are NOT computed here. */
const PRESETS: ReadonlyArray<{ id: MexicoCityRangePresetId; label: string }> = [
  { id: 'today', label: 'Hoy' },
  { id: 'last7Days', label: 'Últimos 7 días' },
  { id: 'thisMonth', label: 'Este mes' },
  { id: 'previousMonth', label: 'Mes anterior' },
]

const uid = useId()
const fromId = `${uid}-from`
const toId = `${uid}-to`
const hintId = `${uid}-hint`
const validationId = `${uid}-validation`

const isDisabled = computed(() => props.disabled || props.loading)
const hasValidationMessage = computed(() => Boolean(props.validationMessage))
const describedBy = computed(() =>
  hasValidationMessage.value ? `${hintId} ${validationId}` : hintId,
)

/** Pass the edited string straight through; never parse it into an instant. */
function toBoundary(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '')
}
</script>

<template>
  <section
    data-testid="branch-summary-filters"
    :aria-busy="props.loading ? 'true' : undefined"
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-default bg-default p-3 lg:p-4"
  >
    <h2 class="text-sm font-semibold text-highlighted">Periodo de análisis</h2>

    <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="flex min-w-0 flex-col gap-1.5">
        <label :for="fromId" class="text-xs font-medium text-muted">Desde (incluyente)</label>
        <UInput
          :id="fromId"
          data-testid="branch-summary-from"
          type="date"
          class="w-full min-w-0"
          :ui="{ base: 'min-h-11' }"
          :model-value="props.from"
          :disabled="isDisabled"
          :aria-invalid="hasValidationMessage ? 'true' : undefined"
          :aria-describedby="describedBy"
          @update:model-value="emit('update:from', toBoundary($event))"
        />
      </div>

      <div class="flex min-w-0 flex-col gap-1.5">
        <label :for="toId" class="text-xs font-medium text-muted">Hasta (excluyente)</label>
        <UInput
          :id="toId"
          data-testid="branch-summary-to"
          type="date"
          class="w-full min-w-0"
          :ui="{ base: 'min-h-11' }"
          :model-value="props.to"
          :disabled="isDisabled"
          :aria-invalid="hasValidationMessage ? 'true' : undefined"
          :aria-describedby="describedBy"
          @update:model-value="emit('update:to', toBoundary($event))"
        />
      </div>
    </div>

    <p :id="hintId" class="text-xs text-muted">
      El rango incluye el día «Desde» y excluye el día «Hasta».
    </p>

    <div role="group" aria-label="Periodos rápidos" class="flex flex-wrap gap-2">
      <UButton
        v-for="preset in PRESETS"
        :key="preset.id"
        type="button"
        variant="outline"
        color="neutral"
        data-testid="branch-summary-preset"
        :data-preset-id="preset.id"
        class="min-h-11"
        :disabled="isDisabled"
        @click="emit('preset', preset.id)"
      >
        {{ preset.label }}
      </UButton>
    </div>

    <p
      v-if="hasValidationMessage"
      :id="validationId"
      data-testid="branch-summary-validation"
      role="alert"
      class="text-xs font-medium text-error"
    >
      {{ props.validationMessage }}
    </p>
  </section>
</template>
