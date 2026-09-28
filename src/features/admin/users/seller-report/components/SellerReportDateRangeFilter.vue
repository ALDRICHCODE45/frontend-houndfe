<script setup lang="ts">
/**
 * SellerReportDateRangeFilter.vue — report-local Nuxt UI calendar controls for
 * the seller report `[from, to)` window.
 *
 * Why this is local instead of the shared analytics filter: the owner asked for
 * Nuxt UI date controls rather than native HTML date inputs, and the shared
 * branch-summary filter still renders `<input type="date">`. Changing it would
 * alter shared analytics behavior, so this component restates the same
 * controlled contract (`from` inclusivo / `to` exclusivo + preset intent) with
 * `UPopover` + `UInputDate` + `UCalendar`.
 *
 * Boundary semantics are preserved verbatim:
 *   - Props and emits keep the exact `YYYY-MM-DD` Mexico City calendar strings,
 *     so the caller's `[from, to)` query contract is untouched.
 *   - A boundary string is parsed with `parseMexicoCityCalendarDate` and handed
 *     to the calendar as a `CalendarDate`, and the calendar's selection is
 *     serialized back with `CalendarDate.toString()`. No JS `Date` is ever
 *     constructed, so no timezone conversion can shift a chosen day.
 *   - Incomplete or invalid input (`undefined`, `null`, a partial object) never
 *     emits: it cannot silently change the window. The field keeps showing the
 *     last committed boundary.
 *   - A manual edit clears only the local preset intent; the caller owns the
 *     active preset, so a click emits `preset` without selecting locally.
 *
 * Presentational only: it owns no transport, calls no composable and never
 * resolves a preset's dates.
 */
import { computed, ref, useId, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import {
  parseMexicoCityCalendarDate,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'

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

const uid = useId()
const fromId = `${uid}-from`
const toId = `${uid}-to`
const fromLabelId = `${uid}-from-label`
const toLabelId = `${uid}-to-label`
const hintId = `${uid}-hint`
const validationId = `${uid}-validation`

const isDisabled = computed(() => props.disabled || props.loading)
const hasValidationMessage = computed(() => Boolean(props.validationMessage))
const describedBy = computed(() =>
  hasValidationMessage.value ? `${hintId} ${validationId}` : hintId,
)

// Nuxt UI's Popover has no `disabled` prop, so the calendars are opened through a
// caller-guarded controlled state: while disabled/loading a trigger click can
// never mount a calendar.
const fromOpen = ref(false)
const toOpen = ref(false)

watch(isDisabled, (next) => {
  if (next) {
    fromOpen.value = false
    toOpen.value = false
  }
})

function setFromOpen(value: boolean) {
  fromOpen.value = !isDisabled.value && value
}

function setToOpen(value: boolean) {
  toOpen.value = !isDisabled.value && value
}

/** Exact calendar string -> `CalendarDate` for Nuxt UI; never a JS `Date`. */
function toCalendarDate(value: string): CalendarDate | undefined {
  return parseMexicoCityCalendarDate(value) ?? undefined
}

/**
 * Serialize a Nuxt UI calendar selection back to the committed boundary string.
 *
 * Returns `null` for anything that is not a complete, real calendar date
 * (cleared field, partial object, string) so the caller's window can never be
 * changed by an invalid edit.
 *
 * The original numeric parts are re-assembled into a canonical string and
 * validated by the shared calendar parser BEFORE any `CalendarDate` is built:
 * that constructor silently constrains impossible input (`2025-02-30` ->
 * `2025-02-28`, month `0` -> January, month `13` -> December), which would
 * change the requested window instead of refusing it. The shared parser stays
 * the single source of leap-year and month-length truth; no local date
 * arithmetic is duplicated here.
 */
function toBoundaryString(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const { year, month, day } = value as {
    year?: unknown
    month?: unknown
    day?: unknown
  }
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const candidate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = parseMexicoCityCalendarDate(candidate)
  return parsed?.toString() === candidate ? candidate : null
}

// Controlled calendar models: the props stay the source of truth, and this
// mirror only exists so a refused edit can visibly snap back to the committed
// boundary instead of leaving an empty field behind.
const fromModel = ref<CalendarDate | undefined>(toCalendarDate(props.from))
const toModel = ref<CalendarDate | undefined>(toCalendarDate(props.to))

watch(
  () => props.from,
  (next) => {
    fromModel.value = toCalendarDate(next)
  },
)
watch(
  () => props.to,
  (next) => {
    toModel.value = toCalendarDate(next)
  },
)

/** Commit a picked inclusive boundary, or restore the committed one. */
function commitFrom(value: unknown) {
  const boundary = toBoundaryString(value)
  if (boundary === null) {
    fromModel.value = toCalendarDate(props.from)
    return
  }
  fromModel.value = toCalendarDate(boundary)
  emit('update:from', boundary)
}

/** Commit a picked exclusive boundary, or restore the committed one. */
function commitTo(value: unknown) {
  const boundary = toBoundaryString(value)
  if (boundary === null) {
    toModel.value = toCalendarDate(props.to)
    return
  }
  toModel.value = toCalendarDate(boundary)
  emit('update:to', boundary)
}

/** The caller owns selection; this component only reflects the prop. */
function isPresetActive(id: MexicoCityRangePresetId): boolean {
  return props.activePreset === id
}
</script>

<template>
  <section
    data-testid="seller-report-date-range-filter"
    :aria-busy="props.loading ? 'true' : undefined"
    class="flex min-w-0 flex-col gap-3 rounded-xl border border-default bg-default p-3 lg:p-4"
  >
    <h2 class="text-sm font-semibold text-highlighted">Periodo del reporte</h2>

    <div
      data-testid="seller-report-filter-boundaries"
      class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <div class="flex min-w-0 flex-col gap-1.5">
        <label :id="fromLabelId" :for="fromId" class="text-xs font-medium text-muted"
          >Desde (incluyente)</label
        >
        <UPopover
          :open="fromOpen"
          :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
          @update:open="setFromOpen"
        >
          <UInputDate
            :id="fromId"
            data-testid="seller-report-filter-from"
            class="w-full min-w-0"
            :ui="{ base: 'min-h-11' }"
            :model-value="fromModel"
            :disabled="isDisabled"
            :aria-labelledby="fromLabelId"
            :aria-invalid="hasValidationMessage ? 'true' : undefined"
            :aria-describedby="describedBy"
            @update:model-value="commitFrom"
          />
          <template #content>
            <UCalendar
              data-testid="seller-report-filter-from-calendar"
              class="p-2"
              :model-value="fromModel"
              :disabled="isDisabled"
              @update:model-value="commitFrom"
            />
          </template>
        </UPopover>
      </div>

      <div class="flex min-w-0 flex-col gap-1.5">
        <label :id="toLabelId" :for="toId" class="text-xs font-medium text-muted"
          >Hasta (excluyente)</label
        >
        <UPopover
          :open="toOpen"
          :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
          @update:open="setToOpen"
        >
          <UInputDate
            :id="toId"
            data-testid="seller-report-filter-to"
            class="w-full min-w-0"
            :ui="{ base: 'min-h-11' }"
            :model-value="toModel"
            :disabled="isDisabled"
            :aria-labelledby="toLabelId"
            :aria-invalid="hasValidationMessage ? 'true' : undefined"
            :aria-describedby="describedBy"
            @update:model-value="commitTo"
          />
          <template #content>
            <UCalendar
              data-testid="seller-report-filter-to-calendar"
              class="p-2"
              :model-value="toModel"
              :disabled="isDisabled"
              @update:model-value="commitTo"
            />
          </template>
        </UPopover>
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
        :variant="isPresetActive(preset.id) ? 'solid' : 'outline'"
        :color="isPresetActive(preset.id) ? 'primary' : 'neutral'"
        :aria-pressed="isPresetActive(preset.id) ? 'true' : 'false'"
        data-testid="seller-report-filter-preset"
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
      data-testid="seller-report-filter-validation"
      role="alert"
      class="text-xs font-medium text-error"
    >
      {{ props.validationMessage }}
    </p>
  </section>
</template>
