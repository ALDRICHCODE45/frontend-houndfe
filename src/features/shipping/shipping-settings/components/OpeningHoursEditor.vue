<script setup lang="ts">
/**
 * OpeningHoursEditor — the weekly editor (handoff §7): seven days, each closed
 * or with up to six ranges, and one calm save bar. Client rules mirror the
 * backend; `dayErrors` (INVALID_OPENING_HOURS) show next to their day (S6).
 * No «copy to all days» shortcut (S7).
 */
import { computed, reactive, shallowRef, watch } from 'vue'
import HfSaveBar from '@/core/shared/components/form/HfSaveBar.vue'
import { WEEKDAYS, type Weekday } from '../interfaces/shipping-settings.types'
import { validateWeek, weekToBody, type Week, type WeekErrors } from '../utils/openingHours'
import OpeningHoursDay from './OpeningHoursDay.vue'

const props = defineProps<{
  initial: Week
  /** A week not configured yet can be saved as it is. */
  creating: boolean
  saving?: boolean
  savedAt?: string | null
  dayErrors?: Partial<Record<Weekday, string>>
  message?: string | null
}>()

const emit = defineEmits<{ save: [week: Week]; dirty: [dirty: boolean]; discard: [] }>()

const clone = (week: Week): Week =>
  // SAFETY: built from WEEKDAYS, so every day is present.
  Object.fromEntries(WEEKDAYS.map((day) => [day, week[day].map((range) => ({ ...range }))])) as unknown as Week

const week = reactive<Week>(clone(props.initial))
const clientErrors = shallowRef<WeekErrors>({})
// A day the user changed after a server answer no longer shows that answer.
const staleDays = shallowRef<Set<Weekday>>(new Set())
watch(() => props.dayErrors, () => { staleDays.value = new Set() })

const sameDay = (day: Weekday) =>
  JSON.stringify(weekToBody(week).days.find((d) => d.day === day)) ===
  JSON.stringify(weekToBody(props.initial).days.find((d) => d.day === day))
const dirtyCount = computed(() => WEEKDAYS.filter((day) => !sameDay(day)).length + (props.creating ? 1 : 0))
watch(() => dirtyCount.value > 0, (dirty) => emit('dirty', dirty), { immediate: true })

function onChange(day: Weekday, ranges: Week[Weekday]) {
  week[day] = ranges
  staleDays.value = new Set([...staleDays.value, day])
  if (clientErrors.value[day]) {
    const next = { ...clientErrors.value }
    delete next[day]
    clientErrors.value = next
  }
}

const dayError = (day: Weekday) => (staleDays.value.has(day) ? undefined : props.dayErrors?.[day])

function save() {
  if (props.saving) return
  clientErrors.value = validateWeek(week)
  if (Object.keys(clientErrors.value).length > 0) return
  emit('save', clone(week))
}

function discard() {
  Object.assign(week, clone(props.initial))
  clientErrors.value = {}
  emit('discard')
}
</script>

<template>
  <form class="hours-editor" novalidate @submit.prevent="save">
    <div class="hours-editor__card">
      <OpeningHoursDay
        v-for="day in WEEKDAYS"
        :key="day"
        :day="day"
        :ranges="week[day]"
        :range-errors="clientErrors[day]"
        :day-error="dayError(day)"
        :disabled="saving"
        @update:ranges="onChange(day, $event)"
      />
    </div>
    <HfSaveBar
      :dirty-count="dirtyCount"
      :saving="saving"
      :saved-at="savedAt ?? null"
      :error="message ?? null"
      :save-label="creating ? 'Guardar horario' : 'Guardar'"
      @save="save"
      @discard="discard"
    />
  </form>
</template>

<style scoped>
.hours-editor { display: grid; gap: 16px; min-width: 0; }
.hours-editor__card { border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 24px; }
@media (max-width: 767px) {
  .hours-editor__card { padding: 16px; }
}
</style>
