<script setup lang="ts">
/**
 * OpeningHoursDay — one weekday of the editor: open or closed, then up to six
 * `HH:mm` ranges. Range messages sit under their range; the day message
 * (INVALID_OPENING_HOURS from the backend) sits under the day (S6).
 */
import { computed } from 'vue'
import type { OpeningRange, Weekday } from '../interfaces/shipping-settings.types'
import { DAY_LABELS, MAX_RANGES_PER_DAY, normalizeTimeText } from '../utils/openingHours'

const props = defineProps<{
  day: Weekday
  rangeErrors?: Record<number, string>
  dayError?: string
  disabled?: boolean
}>()

const ranges = defineModel<OpeningRange[]>('ranges', { required: true })

const label = computed(() => DAY_LABELS[props.day].long)
const lower = computed(() => label.value.toLocaleLowerCase('es-MX'))
const open = computed({
  get: () => ranges.value.length > 0,
  set: (value: boolean) => {
    ranges.value = value ? [{ open: '09:00', close: '18:00' }] : []
  },
})

const inputId = (index: number, part: 'open' | 'close') => `${props.day}-${index}-${part}`
const messageId = (index: number) => `${props.day}-${index}-message`

function setTime(index: number, part: 'open' | 'close', value: string) {
  ranges.value = ranges.value.map((range, i) => (i === index ? { ...range, [part]: value } : range))
}

function normalize(index: number, part: 'open' | 'close') {
  const current = ranges.value[index]?.[part]
  if (current !== undefined) {
    const next = normalizeTimeText(current)
    if (next !== current) setTime(index, part, next)
  }
}

function addRange() {
  if (ranges.value.length >= MAX_RANGES_PER_DAY) return
  ranges.value = [...ranges.value, { open: '', close: '' }]
}

function removeRange(index: number) {
  ranges.value = ranges.value.filter((_, i) => i !== index)
}
</script>

<template>
  <fieldset class="hours-day" :data-testid="`day-${day}`" :data-invalid="dayError ? 'true' : undefined">
    <legend class="sr-only">{{ label }}</legend>
    <div class="hours-day__head">
      <span class="hours-day__name" aria-hidden="true">{{ label }}</span>
      <label class="hours-day__toggle">
        <USwitch v-model="open" :disabled="disabled" :aria-label="`${label}: abierto`" />
        <span class="hours-day__state">{{ open ? 'Abierto' : 'Cerrado' }}</span>
      </label>
    </div>

    <div v-if="open" class="hours-day__ranges">
      <div v-for="(range, index) in ranges" :key="index" class="hours-day__range-block">
        <div class="hours-day__range">
          <UInput
            :id="inputId(index, 'open')"
            :model-value="range.open"
            :name="inputId(index, 'open')"
            class="hours-day__time hf-figure"
            inputmode="numeric"
            placeholder="09:00"
            maxlength="5"
            autocomplete="off"
            :disabled="disabled"
            :aria-label="`${label}, horario ${index + 1}: abre`"
            :aria-describedby="rangeErrors?.[index] ? messageId(index) : undefined"
            :aria-invalid="rangeErrors?.[index] ? 'true' : 'false'"
            :color="rangeErrors?.[index] ? 'error' : undefined"
            @update:model-value="setTime(index, 'open', String($event))"
            @blur="normalize(index, 'open')"
          />
          <span class="hours-day__dash" aria-hidden="true">a</span>
          <UInput
            :id="inputId(index, 'close')"
            :model-value="range.close"
            :name="inputId(index, 'close')"
            class="hours-day__time hf-figure"
            inputmode="numeric"
            placeholder="18:00"
            maxlength="5"
            autocomplete="off"
            :disabled="disabled"
            :aria-label="`${label}, horario ${index + 1}: cierra`"
            :aria-describedby="rangeErrors?.[index] ? messageId(index) : undefined"
            :aria-invalid="rangeErrors?.[index] ? 'true' : 'false'"
            :color="rangeErrors?.[index] ? 'error' : undefined"
            @update:model-value="setTime(index, 'close', String($event))"
            @blur="normalize(index, 'close')"
          />
          <UButton
            v-if="ranges.length > 1"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="hours-day__remove"
            :disabled="disabled"
            :aria-label="`Quitar horario ${index + 1} del ${lower}`"
            @click="removeRange(index)"
          />
        </div>
        <p v-if="rangeErrors?.[index]" :id="messageId(index)" class="hours-day__error">{{ rangeErrors[index] }}</p>
      </div>
      <UButton
        v-if="ranges.length < MAX_RANGES_PER_DAY"
        data-testid="add-range"
        color="neutral"
        variant="ghost"
        icon="i-lucide-plus"
        class="hours-day__add"
        :disabled="disabled"
        :aria-label="`Agregar horario al ${lower}`"
        @click="addRange"
      >
        Agregar horario
      </UButton>
    </div>

    <p v-if="dayError" :data-testid="`day-${day}-error`" class="hours-day__error" role="alert">{{ dayError }}</p>
  </fieldset>
</template>

<style scoped>
.hours-day { display: grid; gap: 12px; min-width: 0; margin: 0; border: 0; border-top: 1px solid var(--hf-border); padding: 16px 0; }
.hours-day:first-of-type { border-top: 0; padding-top: 0; }
.hours-day__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
.hours-day__name { color: var(--hf-heading); font-size: 14px; font-weight: 600; }
.hours-day__toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; }
.hours-day__state { min-width: 4.5rem; color: var(--hf-muted); font-size: 13px; }
.hours-day__ranges { display: grid; gap: 8px; }
.hours-day__range-block { display: grid; gap: 4px; }
.hours-day__range { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.hours-day__time { width: 6.5rem; }
.hours-day__dash { color: var(--hf-muted); font-size: 13px; }
.hours-day__remove { min-width: 44px; min-height: 44px; justify-content: center; }
.hours-day__add { justify-self: start; min-height: 44px; }
.hours-day__error { color: var(--hf-danger); font-size: 12px; }
@media (min-width: 768px) {
  .hours-day { grid-template-columns: 14rem minmax(0, 1fr); align-items: start; column-gap: 24px; }
  .hours-day__error[role='alert'] { grid-column: 2; }
}
</style>
