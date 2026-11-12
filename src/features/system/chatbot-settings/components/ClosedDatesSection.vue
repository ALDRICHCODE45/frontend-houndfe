<script setup lang="ts">
/**
 * ClosedDatesSection — closed dates (design 01): a date input with «Agregar fecha», the sorted list with
 * relative text («en 43 días»), past dates marked and removable in bulk. The contract stores only the date
 * (no reason), sorted, unique, up to 400; adding is validated by the parent, which answers with `addError`.
 */
import { ref, watch } from 'vue'
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

const value = ref('')
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
          <label class="cbs-label" for="cbs-date-in">Nueva fecha cerrada</label>
          <input
            id="cbs-date-in"
            v-model="value"
            type="date"
            class="cbs-input"
            :aria-invalid="addError ? 'true' : undefined"
            aria-describedby="cbs-date-help cbs-date-error"
            data-testid="date-input"
          />
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
