<script setup lang="ts">
/**
 * CustomerStatementDownload.vue — «Descargar estado de cuenta» (sales history backend data T4,
 * handoff 29). A secondary header action that opens a small period picker: «Este mes» (default),
 * «Mes anterior», «Últimos 3 meses» or custom days on the project calendar (no native date input).
 * The picker reads the LAST INCLUDED day while the request sends `to` exclusive; an empty,
 * reversed or longer-than-366-days range never reaches the backend.
 *
 * Local picker instead of SellerReportDateRangeFilter: that one edits an exclusive «Hasta» field
 * and offers other presets, so it would not fit without changing its behavior.
 */
import { computed, shallowRef, useId } from 'vue'
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
import { useCustomerStatementDownload } from '../statement/useCustomerStatementDownload'

const props = defineProps<{ customerId: string }>()

type CalendarRange = { start?: CalendarDate; end?: CalendarDate }

const uid = useId()
const headingId = `${uid}-heading`
const calendarId = `${uid}-calendar`

const open = shallowRef(false)
const customOpen = shallowRef(false)
const preset = shallowRef<CustomerStatementPresetId | null>(CUSTOMER_STATEMENT_DEFAULT_PRESET)
const range = shallowRef<CustomerStatementRange>(
  customerStatementPresetRange(CUSTOMER_STATEMENT_DEFAULT_PRESET),
)
const calendarModel = shallowRef<CalendarRange | undefined>(calendarRangeOf(range.value))

const { isDownloading, error, download } = useCustomerStatementDownload(() => props.customerId)

const periodLabel = computed(
  () => formatCustomerStatementPeriod(range.value.from, range.value.to) ?? 'Sin periodo',
)
const validationMessage = computed(() => validateCustomerStatementRange(range.value))

/** Half-open range → the inclusive days the calendar shows. */
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

function setOpen(value: boolean) {
  // A preset follows today's date each time the picker opens.
  if (value && preset.value) choosePreset(preset.value)
  open.value = value
}

async function submit() {
  if (await download(range.value)) open.value = false
}
</script>

<template>
  <UPopover
    :open="open"
    :content="{ align: 'end', side: 'bottom', sideOffset: 8, collisionPadding: 16 }"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay' }"
    @update:open="setOpen"
  >
    <UButton
      data-testid="statement-trigger"
      type="button"
      color="neutral"
      variant="outline"
      icon="i-lucide-file-down"
      class="min-h-11 min-w-11 shrink-0 justify-center"
      aria-label="Descargar estado de cuenta"
      :loading="isDownloading"
      :aria-busy="isDownloading ? 'true' : undefined"
    >
      <span class="hidden sm:inline">Estado de cuenta</span>
    </UButton>

    <template #content>
      <div
        data-testid="statement-picker"
        role="group"
        :aria-labelledby="headingId"
        class="grid w-[22rem] min-w-0 max-w-[calc(100vw-2rem)] gap-3 p-3"
      >
        <p :id="headingId" class="text-sm font-semibold text-[var(--hf-heading)]">
          Descargar estado de cuenta
        </p>

        <div role="group" aria-label="Periodos rápidos" class="flex min-w-0 flex-wrap gap-2">
          <UButton
            v-for="option in CUSTOMER_STATEMENT_PRESETS"
            :key="option.id"
            data-testid="statement-preset"
            type="button"
            size="sm"
            :variant="preset === option.id ? 'soft' : 'outline'"
            :color="preset === option.id ? 'primary' : 'neutral'"
            :aria-pressed="preset === option.id ? 'true' : 'false'"
            class="min-h-11 justify-center"
            :class="preset === option.id ? 'font-semibold' : 'font-medium'"
            :disabled="isDownloading"
            @click="choosePreset(option.id)"
          >
            {{ option.label }}
          </UButton>
        </div>

        <UButton
          data-testid="statement-custom-toggle"
          type="button"
          size="sm"
          color="neutral"
          variant="ghost"
          icon="i-lucide-calendar"
          :trailing-icon="customOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          class="min-h-11 w-full justify-start"
          :aria-expanded="customOpen ? 'true' : 'false'"
          :aria-controls="calendarId"
          :disabled="isDownloading"
          @click="customOpen = !customOpen"
        >
          Elegir fechas
        </UButton>

        <div v-if="customOpen" :id="calendarId" class="min-w-0 overflow-x-hidden">
          <UCalendar
            data-testid="statement-calendar"
            class="w-full min-w-0"
            range
            :model-value="calendarModel"
            :disabled="isDownloading"
            @update:model-value="pickDays"
          />
        </div>

        <p class="text-[13px] text-[var(--hf-muted)]">
          Periodo:
          <b data-testid="statement-period" class="hf-figure font-semibold text-[var(--hf-ink)]">{{
            periodLabel
          }}</b>
          <span> · ambos días incluidos</span>
        </p>

        <p
          v-if="validationMessage"
          data-testid="statement-validation"
          role="alert"
          class="flex items-start gap-1.5 text-xs font-medium text-error"
        >
          <UIcon name="i-lucide-circle-alert" class="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{{ validationMessage }}</span>
        </p>

        <div
          v-if="error"
          data-testid="statement-error"
          role="alert"
          class="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[var(--hf-danger-border)] bg-[var(--hf-danger-soft)] px-3 py-2 text-[13px] text-[var(--hf-danger)]"
        >
          <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1">{{ error.message }}</span>
          <UButton
            v-if="error.canRetry"
            data-testid="statement-retry"
            type="button"
            size="sm"
            color="neutral"
            variant="outline"
            class="min-h-11 shrink-0"
            :disabled="isDownloading"
            @click="submit"
          >
            Reintentar
          </UButton>
        </div>

        <UButton
          data-testid="statement-submit"
          type="button"
          color="primary"
          icon="i-lucide-download"
          block
          class="min-h-11"
          :loading="isDownloading"
          :disabled="isDownloading || validationMessage !== null"
          @click="submit"
        >
          {{ isDownloading ? 'Generando PDF…' : 'Descargar PDF' }}
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
