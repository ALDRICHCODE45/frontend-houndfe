<script setup lang="ts">
/**
 * SellerReportDateRangeFilter.vue — report-local Nuxt UI calendar controls for
 * the seller report `[from, to)` window.
 *
 * The owner asked for Nuxt UI date controls rather than native HTML date
 * inputs. This report keeps its own visible filter panel, while the dashboard's
 * `BranchSalesSummaryFilters` places the same controlled contract (`from`
 * inclusivo / `to` exclusivo + preset intent) in a header popover; both use
 * `UPopover` + `UInputDate` + `UCalendar`.
 *
 * Boundary semantics are preserved verbatim:
 *   - Props and emits keep the exact `YYYY-MM-DD` Mexico City calendar strings,
 *     so the caller's `[from, to)` query contract is untouched.
 *   - A boundary string is parsed with `parseMexicoCityCalendarDate` and handed
 *     to the calendar as a `CalendarDate`, and the calendar's selection is
 *     serialized back with the shared `calendarPartsToDateString`. No JS `Date`
 *     is ever constructed, so no timezone conversion can shift a chosen day.
 *   - Incomplete or invalid input (`undefined`, `null`, a partial object) never
 *     emits: it cannot silently change the window. The field keeps showing the
 *     last committed boundary.
 *   - A manual edit clears only the local preset intent; the caller owns the
 *     active preset, so a click emits `preset` without selecting locally.
 *
 * Sales history redesign T2 (design 01/04): the presets sit in one row with a period button that
 * reads the LAST INCLUDED day («1 – 30 nov 2026»); the button folds the two date fields away until
 * it is used (or a validation message needs them). Display only: the props and emits keep the
 * exclusive `to`. The caller may open the fields with the exposed `openPeriod()` (row-limit error).
 *
 * Presentational only: it owns no transport, calls no composable and never
 * resolves a preset's dates.
 */
import { computed, ref, useId, useTemplateRef, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import {
  calendarPartsToDateString,
  parseMexicoCityCalendarDate,
  type MexicoCityRangePresetId,
} from '@/core/shared/utils/mexicoCityCalendar'
import { formatSellerReportPeriod } from '../utils/sellerReportPresentation'

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
const panelId = `${uid}-boundaries`

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
  const boundary = calendarPartsToDateString(value)
  if (boundary === null) {
    fromModel.value = toCalendarDate(props.from)
    return
  }
  fromModel.value = toCalendarDate(boundary)
  emit('update:from', boundary)
}

/** Commit a picked exclusive boundary, or restore the committed one. */
function commitTo(value: unknown) {
  const boundary = calendarPartsToDateString(value)
  if (boundary === null) {
    toModel.value = toCalendarDate(props.to)
    return
  }
  toModel.value = toCalendarDate(boundary)
  emit('update:to', boundary)
}

const periodLabel = computed(
  () => formatSellerReportPeriod(props.from, props.to) ?? 'Periodo no válido',
)
const fieldsOpen = ref(false)
const showFields = computed(() => fieldsOpen.value || hasValidationMessage.value)
const toggleButton = useTemplateRef<HTMLButtonElement>('toggleButton')

function toggleFields() {
  fieldsOpen.value = !showFields.value
}

/** Caller intent (e.g. the row-limit error's «Cambiar periodo»): show the fields and focus here. */
function openPeriod() {
  fieldsOpen.value = true
  toggleButton.value?.focus()
}

defineExpose({ openPeriod })

/** The caller owns selection; this component only reflects the prop. */
function isPresetActive(id: MexicoCityRangePresetId): boolean {
  return props.activePreset === id
}
</script>

<template>
  <section
    data-testid="seller-report-date-range-filter"
    :aria-busy="props.loading ? 'true' : undefined"
    class="flex min-w-0 flex-col gap-3"
  >
    <h2 class="sr-only">Periodo del reporte</h2>

    <div class="flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
      <div
        role="group"
        aria-label="Periodos rápidos"
        class="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap"
      >
        <UButton
          v-for="preset in PRESETS"
          :key="preset.id"
          type="button"
          :variant="isPresetActive(preset.id) ? 'soft' : 'outline'"
          :color="isPresetActive(preset.id) ? 'primary' : 'neutral'"
          :aria-pressed="isPresetActive(preset.id) ? 'true' : 'false'"
          data-testid="seller-report-filter-preset"
          :data-preset-id="preset.id"
          class="min-h-11 justify-center md:min-h-9"
          :class="isPresetActive(preset.id) ? 'font-semibold' : 'font-medium'"
          :disabled="isDisabled"
          @click="emit('preset', preset.id)"
        >
          {{ preset.label }}
        </UButton>
      </div>

      <button
        ref="toggleButton"
        type="button"
        data-testid="seller-report-period-toggle"
        class="inline-flex min-h-11 w-full min-w-0 items-center gap-2 rounded-[var(--hf-radius-control)] border border-[var(--hf-field-border)] bg-[var(--hf-field)] px-3 text-left text-sm font-medium text-[var(--hf-ink)] hover:bg-[var(--hf-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
        :aria-expanded="showFields ? 'true' : 'false'"
        :aria-controls="panelId"
        :aria-label="`Cambiar fechas del periodo: ${periodLabel}, ambos días incluidos`"
        :disabled="isDisabled"
        @click="toggleFields"
      >
        <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-[var(--hf-muted)]" aria-hidden="true" />
        <span class="hf-figure min-w-0 flex-1 truncate">{{ periodLabel }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 shrink-0 text-[var(--hf-muted)] transition-transform motion-reduce:transition-none"
          :class="{ 'rotate-180': showFields }"
          aria-hidden="true"
        />
      </button>
    </div>

    <div
      v-show="showFields"
      :id="panelId"
      data-testid="seller-report-filter-boundaries-panel"
      class="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface)] p-3"
    >
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
            :ui="{ content: 'hf-theme hf-ui hf-form-overlay users-form-portal' }"
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
            :ui="{ content: 'hf-theme hf-ui hf-form-overlay users-form-portal' }"
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

      <p
        v-if="hasValidationMessage"
        :id="validationId"
        data-testid="seller-report-filter-validation"
        role="alert"
        class="flex items-start gap-1.5 text-xs font-medium text-error"
      >
        <UIcon name="i-lucide-circle-alert" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ props.validationMessage }}</span>
      </p>
    </div>
  </section>
</template>
