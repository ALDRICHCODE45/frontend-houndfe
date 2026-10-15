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
 *
 * Selection is controlled too (OI-3): `activePreset` arrives as an explicit prop
 * and a click emits intent without selecting locally. The active control exposes
 * `aria-pressed` and a feature-owned semantic selection (no hardcoded colors),
 * so the selected state is visible in both light and dark themes.
 */
import { computed, useId } from 'vue'
import {
  parseMexicoCityCalendarDate,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import '../styles/dashboard-visual.css'

const props = withDefaults(
  defineProps<{
    /** Inclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
    from: string
    /** Exclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
    to: string
    /** Caller-owned active preset; `null` means the range is a custom selection. */
    activePreset?: MexicoCityRangePresetId | null
    disabled?: boolean
    loading?: boolean
    /** Caller-owned validation text; this component invents no validation logic. */
    validationMessage?: string
  }>(),
  { activePreset: null, disabled: false, loading: false, validationMessage: undefined },
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

const activeIndex = computed(() => PRESETS.findIndex((preset) => preset.id === props.activePreset))
const indicatorStyle = computed(() => ({
  transform: `translateX(${Math.max(0, activeIndex.value) * 100}%)`,
  opacity: activeIndex.value < 0 ? 0 : 1,
}))

// Calendar-only display: the exclusive boundary is shown as the last included
// day, without changing the exact strings used by fields, events or queries.
const periodLabel = computed(() => {
  const from = parseMexicoCityCalendarDate(props.from)
  const to = parseMexicoCityCalendarDate(props.to)
  if (!from || !to || from.compare(to) >= 0) return `${props.from} → ${props.to}`
  const last = to.subtract({ days: 1 })
  const format = (date: typeof from, year: boolean) =>
    new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      ...(year ? { year: 'numeric' } as const : {}),
      timeZone: 'America/Mexico_City',
    })
      .format(date.toDate('America/Mexico_City'))
      .replace(/\./g, '')
  return `${format(from, from.year !== last.year)} – ${format(last, true)}`
})

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

/** The caller owns selection; this component only reflects the prop. */
function isPresetActive(id: MexicoCityRangePresetId): boolean {
  return props.activePreset === id
}
</script>

<template>
  <section
    data-testid="branch-summary-filters"
    :aria-busy="props.loading ? 'true' : undefined"
    class="dashboard-period-controls"
    aria-label="Periodo de análisis"
  >
    <div class="dashboard-period-meta">
      <UIcon name="i-lucide-calendar-days" class="size-4 shrink-0" aria-hidden="true" />
      <span>{{ periodLabel }}</span>
      <span class="dashboard-period-dot" aria-hidden="true" />
      <span>Periodo seleccionado</span>
    </div>
    <div class="dashboard-period-actions">
      <div class="dashboard-preset-scroll">
        <div role="group" aria-label="Periodos rápidos" class="dashboard-presets">
          <span class="dashboard-preset-indicator" :style="indicatorStyle" aria-hidden="true" />
          <button
            v-for="preset in PRESETS"
            :key="preset.id"
            type="button"
            :aria-pressed="isPresetActive(preset.id) ? 'true' : 'false'"
            data-testid="branch-summary-preset"
            :data-preset-id="preset.id"
            class="dashboard-preset min-h-11 focus-visible:outline-2"
            :class="{ 'dashboard-preset-active': isPresetActive(preset.id) }"
            :disabled="isDisabled"
            @click="emit('preset', preset.id)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>
      <UPopover
        :content="{ align: 'end', sideOffset: 8 }"
        :ui="{ content: 'hf-theme hf-ui dashboard-range-portal' }"
      >
        <button
          type="button"
          class="dashboard-range-trigger"
          aria-label="Personalizar periodo"
          :disabled="isDisabled"
        >
          <UIcon name="i-lucide-calendar-days" class="size-4" aria-hidden="true" />
          <UIcon name="i-lucide-chevron-down" class="size-3" aria-hidden="true" />
        </button>
        <template #content>
          <div class="dashboard-range-fields">
            <h2 class="text-sm font-semibold text-highlighted">Periodo de análisis</h2>
            <div class="grid min-w-0 grid-cols-1 gap-3">
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
          </div>
        </template>
      </UPopover>
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
