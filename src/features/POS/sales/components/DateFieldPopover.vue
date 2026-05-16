<script setup lang="ts">
import { computed } from 'vue'
import { parseDate, CalendarDate, today, getLocalTimeZone } from '@internationalized/date'

const props = withDefaults(
  defineProps<{
    /** ISO date (YYYY-MM-DD) or null when unset. */
    modelValue: string | null
    /** Placeholder label when no date is picked. */
    placeholder?: string
    /** Disable interaction. */
    disabled?: boolean
    /** Minimum selectable date as ISO (YYYY-MM-DD). Defaults to today. */
    minIso?: string | null
    /** Optional data-testid for the trigger button. */
    testid?: string
  }>(),
  {
    placeholder: 'Elegir fecha',
    disabled: false,
    minIso: null,
    testid: 'date-field-popover',
  },
)

const emit = defineEmits<{
  'update:modelValue': [iso: string | null]
}>()

function isoToCalendarDate(iso: string | null): CalendarDate | undefined {
  if (!iso) return undefined
  try {
    return parseDate(iso)
  } catch {
    return undefined
  }
}

function calendarDateToIso(date: CalendarDate | undefined): string | null {
  if (!date) return null
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function formatCalendarDate(date: CalendarDate | undefined): string {
  if (!date) return ''
  return new Intl.DateTimeFormat('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date.year, date.month - 1, date.day))
}

const calendarValue = computed({
  get: () => isoToCalendarDate(props.modelValue),
  set: (value) => emit('update:modelValue', calendarDateToIso(value)),
})

const minCalendarDate = computed(() => {
  if (props.minIso) {
    const parsed = isoToCalendarDate(props.minIso)
    if (parsed) return parsed
  }
  return today(getLocalTimeZone())
})

const formattedLabel = computed(() => formatCalendarDate(calendarValue.value))

function clearDate() {
  emit('update:modelValue', null)
}
</script>

<template>
  <UPopover :disabled="disabled">
    <UButton
      :label="formattedLabel || placeholder"
      icon="i-lucide-calendar"
      color="neutral"
      variant="outline"
      class="w-full justify-start"
      :disabled="disabled"
      :data-testid="testid"
    />

    <template #content>
      <div class="p-2">
        <UCalendar v-model="calendarValue" :min-value="minCalendarDate" />
        <div v-if="modelValue" class="mt-2 flex justify-end">
          <UButton
            color="error"
            variant="ghost"
            size="xs"
            label="Limpiar"
            icon="i-lucide-x"
            :data-testid="`${testid}-clear`"
            @click="clearDate"
          />
        </div>
      </div>
    </template>
  </UPopover>
</template>
