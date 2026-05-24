<script setup lang="ts">
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import { computed, shallowRef, watch } from 'vue'
import { localEndOfDayUTC, localStartOfDayUTC } from '@/core/shared/utils/dateRangeBoundaries'

const props = withDefaults(defineProps<{
  label: string
  includeNullOption?: string
  error?: string
  presets?: boolean
}>(), {
  presets: true,
})

const modelValue = defineModel<{ from?: string; to?: string }>({ default: () => ({}) })
const includeNullValue = defineModel<boolean>('includeNullValue', { default: false })

type CalendarRange = { start?: CalendarDate; end?: CalendarDate }

function isoToLocalCalendarDate(iso: string): CalendarDate | undefined {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return undefined
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  )
}

function toCalendarRange(value: { from?: string; to?: string }): CalendarRange | undefined {
  const start = value.from ? isoToLocalCalendarDate(value.from) : undefined
  const end = value.to ? isoToLocalCalendarDate(value.to) : undefined
  if (!start && !end) return undefined
  return { start, end }
}

function fromCalendarDate(value?: CalendarDate): string | undefined {
  if (!value) return undefined
  const month = String(value.month).padStart(2, '0')
  const day = String(value.day).padStart(2, '0')
  return `${value.year}-${month}-${day}`
}

const selectedRange = shallowRef<CalendarRange | undefined>(toCalendarRange(modelValue.value))

watch(() => modelValue.value, (next) => {
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
    payload.from = localStartOfDayUTC(from)
  }

  if (to) {
    payload.to = localEndOfDayUTC(to)
  }

  modelValue.value = payload
}

function updateRange(value: unknown) {
  selectedRange.value = (value as CalendarRange | undefined) ?? undefined
  emitRange()
}

type Preset = {
  key: string
  label: string
}

const presets: Preset[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'yesterday', label: 'Ayer' },
  { key: 'last7', label: 'Últimos 7 días' },
  { key: 'last30', label: 'Últimos 30 días' },
  { key: 'thisMonth', label: 'Este mes' },
  { key: 'lastMonth', label: 'Mes pasado' },
]

function applyPreset(key: Preset['key']) {
  const todayDate = today(getLocalTimeZone())
  let start: CalendarDate = todayDate
  let end: CalendarDate = todayDate

  if (key === 'yesterday') {
    start = todayDate.subtract({ days: 1 })
    end = start
  }
  else if (key === 'last7') {
    start = todayDate.subtract({ days: 6 })
    end = todayDate
  }
  else if (key === 'last30') {
    start = todayDate.subtract({ days: 29 })
    end = todayDate
  }
  else if (key === 'thisMonth') {
    start = todayDate.set({ day: 1 })
    end = todayDate
  }
  else if (key === 'lastMonth') {
    const firstOfThis = todayDate.set({ day: 1 })
    start = firstOfThis.subtract({ months: 1 })
    end = firstOfThis.subtract({ days: 1 })
  }

  selectedRange.value = { start, end }

  emitRange()
}

const rangeLabel = computed(() => {
  const from = fromCalendarDate(selectedRange.value?.start)
  const to = fromCalendarDate(selectedRange.value?.end)
  if (!from && !to) return 'Seleccionar fechas'

  const formatter = new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' })
  const fromText = from ? formatter.format(new Date(`${from}T12:00:00`)) : '—'
  const toText = to ? formatter.format(new Date(`${to}T12:00:00`)) : '—'
  return `${fromText} - ${toText}`
})
</script>

<template>
  <UFormField :label="props.label" :error="resolvedError" class="w-full" data-testid="date-range-filter">
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
        <div class="flex max-w-full flex-col gap-3 p-2 sm:min-w-[540px] sm:flex-row">
          <div v-if="props.presets" class="-mx-1 flex gap-1 overflow-x-auto px-1 sm:mx-0 sm:w-44 sm:flex-col sm:overflow-visible sm:px-0">
            <UButton
              v-for="preset in presets"
              :key="preset.key"
              variant="ghost"
              color="neutral"
              class="justify-start whitespace-nowrap"
              data-testid="date-preset"
              @click="applyPreset(preset.key)"
            >
              {{ preset.label }}
            </UButton>
          </div>

          <UCalendar
            data-testid="date-range-calendar"
            class="w-full"
            range
            :model-value="selectedRange"
            @update:model-value="updateRange"
          />
        </div>

        <template v-if="props.includeNullOption">
          <USeparator />
          <label class="flex cursor-pointer items-center gap-2 p-3 text-sm text-muted">
            <UCheckbox
              v-model="includeNullValue"
              :data-testid="`include-null-${props.label}`"
            />
            <span>{{ props.includeNullOption }}</span>
          </label>
        </template>
      </template>
    </UPopover>
  </UFormField>
</template>
