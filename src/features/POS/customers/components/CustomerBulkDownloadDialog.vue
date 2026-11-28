<script setup lang="ts">
/**
 * CustomerBulkDownloadDialog.vue — the dialog of the customers bulk downloads (customers-bulk-actions
 * S3, handoff 33). Presentational: the run lives in `useCustomerBulkDownload` (CustomersView).
 *
 * - «Estados de cuenta PDF»: the period picker of the single statement (same presets, calendar and
 *   1-366-day validation from `customerStatementPeriod.ts`), then «Descargar ZIP».
 * - While running (statements take ~10 s for 50): progress and «Cancelar», which aborts the request.
 * - A failure: its Spanish message and the next step — «Reintentar sin ellos» (404 missingIds),
 *   «Reintentar» (enabled once a 429 wait is over), the period picker again with the error inline
 *   (INVALID_PERIOD), or «Volver» where nothing can be retried as is: back to the picker after a
 *   statements timeout (`back`), else back to the table (TOO_LARGE / EMPTY: the selection must
 *   change; the CSV has no picker). Never a dead end with only «Cerrar».
 * One primary action per state; the CSV has no picker (it starts as soon as it is chosen).
 */
import { computed, shallowRef, useId, watch } from 'vue'
import type { CalendarDate } from '@internationalized/date'
import { parseMexicoCityCalendarDate } from '@/core/shared/utils/mexicoCityCalendar'
import {
  CUSTOMER_STATEMENT_DEFAULT_PRESET,
  CUSTOMER_STATEMENT_PRESETS,
  customerStatementPresetRange,
  customerStatementRangeFromDays,
  formatCustomerStatementPeriod,
  validateCustomerStatementRange,
  type CustomerStatementPresetId,
  type CustomerStatementRange,
} from '../statement/customerStatementPeriod'
import type { CustomerBulkFailure } from '../bulk/customerBulkErrors'
import type { CustomerBulkKind } from '../bulk/customerBulkSelection'

const props = defineProps<{
  open: boolean
  kind: CustomerBulkKind
  /** Customers in the selection. */
  count: number
  running: boolean
  error: CustomerBulkFailure | null
  canRetry: boolean
  canRetryWithoutMissing: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [range: CustomerStatementRange]
  cancel: []
  retry: []
  'retry-without-missing': []
  /** «Volver» to the period picker: the screen forgets the error. */
  back: []
}>()

type CalendarRange = { start?: CalendarDate; end?: CalendarDate }

const uid = useId()
const calendarId = `${uid}-calendar`

const customOpen = shallowRef(false)
const preset = shallowRef<CustomerStatementPresetId | null>(CUSTOMER_STATEMENT_DEFAULT_PRESET)
const range = shallowRef<CustomerStatementRange>(customerStatementPresetRange(CUSTOMER_STATEMENT_DEFAULT_PRESET))
const calendarModel = shallowRef<CalendarRange | undefined>(calendarRangeOf(range.value))

const formatCount = (value: number) => value.toLocaleString('en-US')
const customersLabel = computed(() =>
  props.count === 1 ? '1 cliente seleccionado' : `${formatCount(props.count)} clientes seleccionados`,
)
const title = computed(() => (props.kind === 'statements' ? 'Estados de cuenta PDF' : 'Exportar CSV'))
const progressLabel = computed(() =>
  props.kind === 'statements'
    ? `Generando ${formatCount(props.count)} ${props.count === 1 ? 'estado' : 'estados'} de cuenta…`
    : `Exportando ${formatCount(props.count)} ${props.count === 1 ? 'cliente' : 'clientes'}…`,
)
const periodLabel = computed(() => formatCustomerStatementPeriod(range.value.from, range.value.to) ?? 'Sin periodo')
const validationMessage = computed(() => validateCustomerStatementRange(range.value))
const showPicker = computed(
  () => props.kind === 'statements' && !props.running && (!props.error || props.error.code === 'INVALID_PERIOD'),
)
/** A failure nothing can retry as is: «Volver» instead of a dead end. */
const showBack = computed(
  () =>
    !!props.error &&
    !props.running &&
    !showPicker.value &&
    !props.canRetryWithoutMissing &&
    !props.error.canRetry,
)
/** «Volver» returns to the picker only where another try of the same selection makes sense. */
const backToPicker = computed(() => props.kind === 'statements' && props.error?.code === 'BULK_EXPORT_TIMEOUT')

function goBack() {
  if (backToPicker.value) emit('back')
  else close()
}

function calendarRangeOf(value: CustomerStatementRange): CalendarRange | undefined {
  const start = parseMexicoCityCalendarDate(value.from) ?? undefined
  const end = parseMexicoCityCalendarDate(value.to)?.subtract({ days: 1 })
  return start ? { start, end } : undefined
}

function choosePreset(id: CustomerStatementPresetId) {
  preset.value = id
  range.value = customerStatementPresetRange(id)
  calendarModel.value = calendarRangeOf(range.value)
}

function pickDays(value: unknown) {
  const picked = (value ?? undefined) as CalendarRange | undefined
  calendarModel.value = picked
  preset.value = null
  range.value = customerStatementRangeFromDays(picked?.start, picked?.end)
}

// A preset follows today's date each time the dialog opens.
watch(
  () => props.open,
  (open) => {
    if (open && preset.value) choosePreset(preset.value)
  },
)

function submit() {
  if (props.running || validationMessage.value !== null) return
  emit('submit', { ...range.value })
}

function close() {
  if (props.running) emit('cancel')
  emit('update:open', false)
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :dismissible="!running"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
    @update:open="(value: boolean) => (value ? emit('update:open', true) : close())"
  >
    <template #body>
      <div class="flex min-w-0 flex-col gap-4" data-testid="bulk-dialog">
        <p data-testid="bulk-dialog-summary" class="text-sm text-(--hf-muted)">
          {{ customersLabel }}<template v-if="kind === 'statements'"> · un PDF por cliente en un ZIP</template>
        </p>

        <template v-if="showPicker">
          <div role="group" aria-label="Periodos rápidos" class="flex min-w-0 flex-wrap gap-2">
            <UButton
              v-for="option in CUSTOMER_STATEMENT_PRESETS"
              :key="option.id"
              data-testid="bulk-statement-preset"
              type="button"
              size="sm"
              :variant="preset === option.id ? 'soft' : 'outline'"
              :color="preset === option.id ? 'primary' : 'neutral'"
              :aria-pressed="preset === option.id ? 'true' : 'false'"
              class="min-h-11 justify-center"
              :class="preset === option.id ? 'font-semibold' : 'font-medium'"
              @click="choosePreset(option.id)"
            >
              {{ option.label }}
            </UButton>
          </div>

          <UButton
            type="button"
            size="sm"
            color="neutral"
            variant="ghost"
            icon="i-lucide-calendar"
            :trailing-icon="customOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="min-h-11 w-full justify-start"
            :aria-expanded="customOpen ? 'true' : 'false'"
            :aria-controls="calendarId"
            @click="customOpen = !customOpen"
          >
            Elegir fechas
          </UButton>

          <div v-if="customOpen" :id="calendarId" class="min-w-0 overflow-x-hidden">
            <UCalendar class="w-full min-w-0" range :model-value="calendarModel" @update:model-value="pickDays" />
          </div>

          <p class="text-[13px] text-(--hf-muted)">
            Periodo:
            <b data-testid="bulk-statement-period" class="hf-figure font-semibold text-(--hf-ink)">{{ periodLabel }}</b>
            <span> · ambos días incluidos</span>
          </p>

          <p
            v-if="validationMessage"
            role="alert"
            class="flex items-start gap-1.5 text-xs font-medium text-error"
          >
            <UIcon name="i-lucide-circle-alert" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{{ validationMessage }}</span>
          </p>
        </template>

        <div
          v-if="running"
          data-testid="bulk-dialog-progress"
          role="status"
          class="flex items-center gap-3 text-sm text-(--hf-ink)"
        >
          <UIcon name="i-lucide-loader-circle" class="size-5 shrink-0 animate-spin text-(--hf-active)" aria-hidden="true" />
          <span class="min-w-0">
            {{ progressLabel }}
            <span v-if="kind === 'statements'" class="block text-[13px] text-(--hf-muted)">Puede tardar unos segundos.</span>
          </span>
        </div>

        <div
          v-if="error && !running"
          data-testid="bulk-dialog-error"
          role="alert"
          class="flex min-w-0 items-start gap-2 rounded-lg border border-(--hf-danger-border) bg-(--hf-danger-soft) px-3 py-2 text-[13px] text-(--hf-danger)"
        >
          <UIcon name="i-lucide-circle-alert" class="mt-px size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1">{{ error.message }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <UButton
          v-if="running"
          data-testid="bulk-dialog-cancel"
          label="Cancelar"
          color="neutral"
          variant="outline"
          class="min-h-11 justify-center sm:min-h-0"
          @click="emit('cancel')"
        />
        <template v-else>
          <UButton
            v-if="!showBack || backToPicker"
            data-testid="bulk-dialog-close"
            label="Cerrar"
            color="neutral"
            variant="outline"
            class="min-h-11 justify-center sm:min-h-0"
            @click="close"
          />
          <UButton
            v-if="error && canRetryWithoutMissing"
            data-testid="bulk-dialog-retry-without"
            label="Reintentar sin ellos"
            color="primary"
            class="hf-primary-control min-h-11 justify-center sm:min-h-0"
            @click="emit('retry-without-missing')"
          />
          <UButton
            v-else-if="error && error.canRetry"
            data-testid="bulk-dialog-retry"
            label="Reintentar"
            color="primary"
            :disabled="!canRetry"
            class="hf-primary-control min-h-11 justify-center sm:min-h-0"
            @click="emit('retry')"
          />
          <UButton
            v-else-if="showPicker"
            data-testid="bulk-dialog-submit"
            label="Descargar ZIP"
            icon="i-lucide-download"
            color="primary"
            :disabled="validationMessage !== null"
            class="hf-primary-control min-h-11 justify-center sm:min-h-0"
            @click="submit"
          />
          <UButton
            v-else-if="showBack"
            data-testid="bulk-dialog-back"
            label="Volver"
            icon="i-lucide-arrow-left"
            color="primary"
            class="hf-primary-control min-h-11 justify-center sm:min-h-0"
            @click="goBack"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
