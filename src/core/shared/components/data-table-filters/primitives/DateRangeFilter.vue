<script setup lang="ts">
import { CalendarDate, getLocalTimeZone, parseDate, today } from '@internationalized/date'
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

function toDateInput(value?: string): string {
  if (!value) return ''
  return value.slice(0, 10)
}

type CalendarRange = { start?: CalendarDate; end?: CalendarDate }

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

function toIsoDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

function toJsDate(value: CalendarDate): Date {
  return new Date(value.year, value.month - 1, value.day)
}

function toCalendarDate(value: Date): CalendarDate {
  return parseDate(toIsoDate(value))
}

function applyPreset(key: Preset['key']) {
  const current = today(getLocalTimeZone())
  const now = toJsDate(current)
  let from = now
  let to = now

  if (key === 'yesterday') {
    from = new Date(now)
    from.setDate(from.getDate() - 1)
    to = new Date(from)
  }

  if (key === 'last7') {
    from = new Date(now)
    from.setDate(from.getDate() - 7)
  }

  if (key === 'last30') {
    from = new Date(now)
    from.setDate(from.getDate() - 30)
  }

  if (key === 'thisMonth') {
    from = new Date(now.getFullYear(), now.getMonth(), 1)
    to = new Date(now)
  }

  if (key === 'lastMonth') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    to = new Date(now.getFullYear(), now.getMonth(), 0)
  }

  selectedRange.value = {
    start: toCalendarDate(from),
    end: toCalendarDate(to),
  }

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
