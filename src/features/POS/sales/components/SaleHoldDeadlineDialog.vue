<script setup lang="ts">
/**
 * SaleHoldDeadlineDialog — «Cambiar plazo» of a pay-in-store hold (BE handoff 24 §2).
 *
 * One date-time field (the app's calendar field at minute precision) read and written in the
 * sucursal zone (Mexico City), so the field, the «vence …» line and the wire value agree. Only a
 * future deadline is sent, as ISO 8601 with its offset, together with the shown `hold.version`.
 *
 * Errors: HOLD_EXPIRY_NOT_FUTURE goes under the field; HOLD_VERSION_CONFLICT reloads the sale (the
 * composable does) and says so inline, so a retry carries the new version; a hold that ended or a
 * sale that is gone closes the dialog with a toast (the reloaded sale no longer offers the action);
 * anything else stays inline with `saleHoldErrorMessage`.
 */
import { computed, ref, watch } from 'vue'
import {
  fromAbsolute,
  parseAbsolute,
  parseDateTime,
  toCalendarDate,
  toCalendarDateTime,
  toZoned,
  type CalendarDate,
  type CalendarDateTime,
} from '@internationalized/date'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import { calendarPartsToDateString, MEXICO_CITY_TIME_ZONE } from '@/core/shared/utils/mexicoCityCalendar'
import { useSaleHoldDeadline } from '../composables/useSaleHoldDeadline'
import { formatSaleHoldExpiry, saleHoldErrorMessage, type SaleHoldErrorCode } from '../utils/saleHold.utils'
import type { SaleHold } from '../interfaces/sale.types'

declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'success' | 'error' | 'warning' }) => void
}

const props = withDefaults(
  defineProps<{
    open: boolean
    saleId: string
    hold: SaleHold
    portalClass?: string
    /** Injected clock (tests). */
    now?: () => Date
  }>(),
  { portalClass: undefined, now: () => new Date() },
)
const emit = defineEmits<{ 'update:open': [open: boolean] }>()

const toast = useToast()
const { updateDeadline, isPending } = useSaleHoldDeadline(() => props.saleId)

const ZONE = MEXICO_CITY_TIME_ZONE
const NOT_FUTURE = saleHoldErrorMessage('HOLD_EXPIRY_NOT_FUTURE')
// The reloaded sale has no live hold any more (or no sale): nothing left to edit here.
const CLOSING_CODES: ReadonlySet<SaleHoldErrorCode> = new Set([
  'SALE_HOLD_NOT_EDITABLE',
  'SALE_NOT_PAY_IN_STORE',
  'SALE_NOT_FOUND',
])

const pad2 = (value: number) => String(value).padStart(2, '0')

/** An instant as the field's `AAAA-MM-DDTHH:mm` in the sucursal zone. */
function toLocalValue(iso: string): string {
  try {
    return toCalendarDateTime(parseAbsolute(iso, ZONE)).toString().slice(0, 16)
  } catch {
    return ''
  }
}
const toDateTime = (value: string): CalendarDateTime | undefined => {
  if (!value) return undefined
  try {
    return parseDateTime(value)
  } catch {
    return undefined
  }
}

const value = ref('')
const initialValue = ref('')
const fieldError = ref<string | null>(null)
const alert = ref<string | null>(null)
const calendarOpen = ref(false)

// Every opening starts from the current deadline. A reload while open (a conflict) keeps what
// the user chose; only «Fecha límite actual» follows the new hold.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    value.value = toLocalValue(props.hold.expiresAt)
    initialValue.value = value.value
    fieldError.value = null
    alert.value = null
  },
  { immediate: true },
)

const currentLabel = computed(() => formatSaleHoldExpiry(props.hold.expiresAt, { now: props.now() }) ?? '—')
const fieldModel = computed(() => toDateTime(value.value))
const calendarModel = computed<CalendarDate | undefined>(() =>
  fieldModel.value ? toCalendarDate(fieldModel.value) : undefined,
)
const minMoment = computed(() => toCalendarDateTime(fromAbsolute(props.now().getTime(), ZONE)))
const minDay = computed(() => toCalendarDate(minMoment.value))
const canSave = computed(() => !isPending.value && value.value !== initialValue.value)

/** A complete, real date and time commits; anything else empties the field so the form names it. */
function fieldChanged(next: unknown) {
  fieldError.value = null
  alert.value = null
  const date = calendarPartsToDateString(next)
  if (date === null) {
    value.value = ''
    return
  }
  const { hour, minute } = next as { hour?: unknown; minute?: unknown }
  const keep = fieldModel.value
  const hh = Number.isInteger(hour) ? (hour as number) : (keep?.hour ?? 0)
  const mm = Number.isInteger(minute) ? (minute as number) : (keep?.minute ?? 0)
  value.value = `${date}T${pad2(hh)}:${pad2(mm)}`
}
// A day picked in the calendar keeps the time already chosen and closes the calendar.
function dayPicked(next: unknown) {
  fieldChanged(next)
  if (value.value) calendarOpen.value = false
}

async function submit() {
  if (!canSave.value) return
  const local = toDateTime(value.value)
  if (!local) {
    fieldError.value = 'Elige la fecha y hora límite.'
    return
  }
  const zoned = toZoned(local, ZONE)
  if (zoned.toDate().getTime() <= props.now().getTime()) {
    fieldError.value = NOT_FUTURE
    return
  }
  alert.value = null
  const result = await updateDeadline({
    // `…-06:00[America/Mexico_City]` without the zone name: ISO 8601 with its offset.
    expiresAt: zoned.toString().replace(/\[.*\]$/, ''),
    expectedVersion: props.hold.version,
  })
  if (result.ok) {
    emit('update:open', false)
    return
  }
  if (result.code === 'HOLD_EXPIRY_NOT_FUTURE') {
    fieldError.value = NOT_FUTURE
    return
  }
  if (CLOSING_CODES.has(result.code)) {
    toast.add({ title: 'No se cambió la fecha límite', description: saleHoldErrorMessage(result.code), color: 'error' })
    emit('update:open', false)
    return
  }
  alert.value = saleHoldErrorMessage(result.code)
}

const modalUi = computed(() => (props.portalClass ? { content: props.portalClass } : undefined))
</script>

<template>
  <UModal
    :open="open"
    title="Cambiar plazo del apartado"
    description="Le avisamos al cliente la nueva fecha por WhatsApp."
    :content="{ class: 'sm:max-w-md' }"
    :ui="modalUi"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form id="sale-hold-deadline-form" class="space-y-4" data-testid="sale-hold-deadline-dialog" @submit.prevent="submit">
        <p class="text-sm text-(--hf-muted)" data-testid="hold-deadline-current">
          Fecha límite actual: <span class="hf-figure">{{ currentLabel }}</span>
        </p>
        <HfFormField label="Nueva fecha límite" label-id="hold-deadline-label" :error="fieldError ?? undefined">
          <UPopover
            v-model:open="calendarOpen"
            :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
            :ui="{ content: portalClass ?? 'hf-theme hf-ui' }"
          >
            <UInputDate
              id="hold-deadline"
              class="hf-figure w-full"
              granularity="minute"
              :hour-cycle="24"
              :model-value="fieldModel"
              :min-value="minMoment"
              aria-labelledby="hold-deadline-label"
              aria-describedby="hold-deadline-label-message"
              :aria-invalid="fieldError ? 'true' : 'false'"
              @update:model-value="fieldChanged"
            />
            <template #content>
              <UCalendar class="p-2" :model-value="calendarModel" :min-value="minDay" @update:model-value="dayPicked" />
            </template>
          </UPopover>
        </HfFormField>
        <UAlert v-if="alert" color="warning" variant="soft" :description="alert" />
      </form>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton
          type="submit"
          form="sale-hold-deadline-form"
          class="hf-primary-control min-h-11 sm:min-h-0"
          data-testid="hold-deadline-save"
          :disabled="!canSave"
          :loading="isPending"
        >
          Guardar plazo
        </UButton>
      </div>
    </template>
  </UModal>
</template>
