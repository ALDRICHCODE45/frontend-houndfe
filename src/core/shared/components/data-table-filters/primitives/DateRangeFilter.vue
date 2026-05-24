<script setup lang="ts">
import { CalendarDate, parseDate } from '@internationalized/date'
import { computed, shallowRef, watch } from 'vue'
import { endOfDayUTC } from '@/features/POS/sales/utils/saleDate.utils'

const props = defineProps<{
  modelValue: { from?: string; to?: string }
  label: string
  includeNullOption?: string
  includeNullValue?: boolean
  error?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: { from?: string; to?: string }): void
  (event: 'update:includeNullValue', value: boolean): void
}>()

function toDateInput(value?: string): string {
  if (!value) return ''
  return value.slice(0, 10)
}

type CalendarRange = { start?: CalendarDate; end?: CalendarDate }

function startOfDayUTC(value: string): string {
  return `${value}T00:00:00.000Z`
}

function toCalendarRange(value: { from?: string; to?: string }): CalendarRange | undefined {
  const start = value.from ? parseDate(toDateInput(value.from)) : undefined
  const end = value.to ? parseDate(toDateInput(value.to)) : undefined
  if (!start && !end) return undefined
  return { start, end }
}

function fromCalendarDate(value?: CalendarDate): string | undefined {
  if (!value) return undefined
  const month = String(value.month).padStart(2, '0')
  const day = String(value.day).padStart(2, '0')
  return `${value.year}-${month}-${day}`
}

const selectedRange = shallowRef<CalendarRange | undefined>(toCalendarRange(props.modelValue))

watch(() => props.modelValue, (next) => {
  selectedRange.value = toCalendarRange(next)
}, { deep: true })

const localError = computed(() => {
  const from = fromCalendarDate(selectedRange.value?.start)
  const to = fromCalendarDate(selectedRange.value?.end)
  if (from && to && from > to) {
    return 'El rango está invertido'
  }

  return undefined
})

const resolvedError = computed(() => props.error ?? localError.value)

function emitRange() {
  const payload: { from?: string; to?: string } = {}

  const from = fromCalendarDate(selectedRange.value?.start)
  const to = fromCalendarDate(selectedRange.value?.end)

  if (from) {
    payload.from = startOfDayUTC(from)
  }

  if (to) {
    payload.to = endOfDayUTC(to)
  }

  emit('update:modelValue', payload)
}

function updateRange(value: unknown) {
  selectedRange.value = (value as CalendarRange | undefined) ?? undefined
  emitRange()
}

const rangeLabel = computed(() => {
  const from = fromCalendarDate(selectedRange.value?.start)
  const to = fromCalendarDate(selectedRange.value?.end)
  if (!from && !to) return 'Seleccionar fechas'

  const formatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
  const fromText = from ? formatter.format(new Date(`${from}T00:00:00.000Z`)) : '—'
  const toText = to ? formatter.format(new Date(`${to}T00:00:00.000Z`)) : '—'
  return `${fromText} - ${toText}`
})
</script>

<template>
  <UFormField :label="props.label" :error="resolvedError" data-testid="date-range-filter">
    <UPopover :content="{ align: 'start', side: 'bottom', sideOffset: 8 }">
      <UButton
        data-testid="date-range-trigger"
        variant="outline"
        color="neutral"
        class="w-full justify-start"
      >
        {{ rangeLabel }}
      </UButton>

      <template #content>
        <UCalendar
          data-testid="date-range-calendar"
          range
          :model-value="selectedRange"
          @update:model-value="updateRange"
        />
      </template>
    </UPopover>

    <div v-if="props.includeNullOption" class="mt-2 flex items-center gap-2">
      <UCheckbox
        :model-value="props.includeNullValue"
        @update:model-value="(value: unknown) => emit('update:includeNullValue', Boolean(value))"
      />
      <span class="text-sm text-muted">{{ props.includeNullOption }}</span>
    </div>
  </UFormField>
</template>
