<script setup lang="ts">
/**
 * ClosedDatesSection — closed dates (design 01): a date input with «Agregar fecha», the sorted list with
 * relative text («en 43 días»), past dates marked and removable in bulk. The contract stores only the date
 * (no reason), sorted, unique, up to 400; adding is validated by the parent, which answers with `addError`.
 */
import { computed, ref, watch } from 'vue'
import { calendarPartsToDateString, parseMexicoCityCalendarDate } from '@/core/shared/utils/mexicoCityCalendar'
import { describeDate, plural } from '../utils/settingsLabels'
import { MAX_CLOSED_DATES } from '../utils/settingsValidation'

const props = defineProps<{
  dates: string[]
  today: string
  readonly: boolean
  addError: string | null
  listError?: string
}>()
const emit = defineEmits<{ add: [value: string]; remove: [date: string]; 'remove-past': [] }>()

// The parent speaks «YYYY-MM-DD»; the system date field speaks `CalendarDate`. Convert at the boundary
// (never through a JS `Date`, which would shift the day across zones).
const value = ref('')
const model = computed(() => parseMexicoCityCalendarDate(value.value) ?? undefined)
const open = ref(false)
function pick(next: unknown) {
  value.value = calendarPartsToDateString(next) ?? ''
  open.value = false
}
const past = () => props.dates.filter((d) => d < props.today)

// A date that was added clears the input; a refused one stays so it can be fixed.
watch(
  () => props.dates.length,
  (now, before) => {
    if (now > before) value.value = ''
  },
)
</script>

<template>
  <div class="cbs-dates" data-testid="dates-section">
    <template v-if="!readonly">
      <div class="cbs-dates__add">
        <div class="cbs-field">
          <label id="cbs-date-label" class="cbs-label" for="cbs-date-in">Nueva fecha cerrada</label>
          <UPopover
            v-model:open="open"
            :content="{ align: 'start', side: 'bottom', sideOffset: 8 }"
            :ui="{ content: 'hf-theme hf-ui hf-form-overlay chatbot-settings-dialog' }"
          >
            <UInputDate
              id="cbs-date-in"
              class="cbs-date-input"
              size="lg"
              :model-value="model"
              :color="addError ? 'error' : 'primary'"
              :highlight="!!addError"
              aria-labelledby="cbs-date-label"
              :aria-invalid="addError ? 'true' : undefined"
              aria-describedby="cbs-date-help cbs-date-error"
              data-testid="date-input"
              @update:model-value="pick"
            />
            <template #content>
              <UCalendar class="p-2" :model-value="model" data-testid="date-calendar" @update:model-value="pick" />
            </template>
          </UPopover>
        </div>
        <button type="button" class="cbs-btn" data-testid="date-add" @click="emit('add', value)">
          <UIcon name="i-lucide-plus" class="size-4" aria-hidden="true" />
          Agregar fecha
        </button>
      </div>
      <span v-if="addError" id="cbs-date-error" class="cbs-error" role="alert" data-testid="date-error">
        <UIcon name="i-lucide-circle-alert" class="size-4" aria-hidden="true" />
        {{ addError }}
      </span>
      <span id="cbs-date-help" class="cbs-help">
        Día completo sin atención, en la zona horaria del horario. Solo se guarda la fecha, sin motivo.
      </span>
    </template>

    <span v-if="listError" class="cbs-error" role="alert" data-testid="dates-list-error">{{ listError }}</span>

    <template v-if="dates.length">
      <ul class="cbs-date-list" aria-label="Fechas cerradas">
        <li
          v-for="date in dates"
          :key="date"
          class="cbs-date"
          :data-past="describeDate(date, today).past"
          :data-testid="`date-${date}`"
        >
          <span class="cbs-date__text">
            <b>{{ describeDate(date, today).label }}</b>
            <small>{{ describeDate(date, today).past ? 'Pasada · ' : '' }}{{ describeDate(date, today).relative }}</small>
          </span>
          <span v-if="describeDate(date, today).past" class="cbs-badge" data-tone="muted">Pasada</span>
          <button
            v-if="!readonly"
            type="button"
            class="cbs-icon-btn"
            :aria-label="`Quitar ${describeDate(date, today).label}`"
            :data-testid="`date-remove-${date}`"
            @click="emit('remove', date)"
          >
            <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <div class="cbs-dates__foot">
        <span class="cbs-help cbs-figure">{{ plural(dates.length, 'fecha', 'fechas') }} · máximo {{ MAX_CLOSED_DATES }}</span>
        <button
          v-if="!readonly && past().length"
          type="button"
          class="cbs-link"
          data-testid="date-remove-past"
          @click="emit('remove-past')"
        >
          Quitar {{ plural(past().length, 'pasada', 'pasadas') }}
        </button>
      </div>
    </template>
    <div v-else class="cbs-empty" data-testid="dates-empty">
      <UIcon name="i-lucide-calendar-off" class="size-6" aria-hidden="true" />
      <strong>Sin fechas cerradas</strong>
      <p>
        Agrega los días en que no habrá atención (feriados, inventario). En esas fechas los plazos se pausan todo el día.
      </p>
    </div>
  </div>
</template>
