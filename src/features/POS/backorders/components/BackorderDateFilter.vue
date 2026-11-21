<script setup lang="ts">
/**
 * «Desde» / «Hasta» (local days of `scheduledAt`) for the backorder list. Local `YYYY-MM-DD`
 * strings in and out through the shared `calendarPartsToDateString` (no JS Date, so no zone shift);
 * an incomplete or cleared field commits «no date».
 */
import { useId } from 'vue'
import { CalendarDate } from '@internationalized/date'
import { calendarPartsToDateString, parseMexicoCityCalendarDate } from '@/core/shared/utils/mexicoCityCalendar'

defineProps<{ from: string; to: string }>()
const emit = defineEmits<{ 'update:from': [value: string]; 'update:to': [value: string] }>()

const uid = useId()
const toCalendar = (value: string): CalendarDate | undefined => parseMexicoCityCalendarDate(value) ?? undefined
const commit = (value: unknown) => calendarPartsToDateString(value) ?? ''
</script>

<template>
  <div class="bo-dates" role="group" aria-label="Fecha de agendado">
    <div class="bo-field">
      <label :for="`${uid}-from`" class="bo-label">Agendado desde</label>
      <UInputDate
        :id="`${uid}-from`"
        :model-value="toCalendar(from)"
        :max-value="toCalendar(to)"
        class="w-full"
        :ui="{ base: 'min-h-11' }"
        data-testid="backorders-from"
        @update:model-value="emit('update:from', commit($event))"
      />
    </div>
    <div class="bo-field">
      <label :for="`${uid}-to`" class="bo-label">Hasta</label>
      <UInputDate
        :id="`${uid}-to`"
        :model-value="toCalendar(to)"
        :min-value="toCalendar(from)"
        class="w-full"
        :ui="{ base: 'min-h-11' }"
        data-testid="backorders-to"
        @update:model-value="emit('update:to', commit($event))"
      />
    </div>
  </div>
</template>
