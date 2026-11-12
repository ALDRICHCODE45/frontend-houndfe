<script setup lang="ts">
/**
 * HoursSection — weekly chat attention hours (design 01, «Horario de atención»): time zone, «Copiar horario
 * de recolección», one row per day (switch row, up to 6 ranges, «Copiar a…») and the week total. The fixed
 * note says this is the CHAT schedule, separate from the store pickup hours. Props down, events up; the
 * only local state is the open «Copiar a…» panel.
 */
import { computed, ref } from 'vue'
import { CHATBOT_WEEKDAYS, type ChatbotSettings, type ChatbotWeekday } from '../interfaces/chatbot-settings.types'
import { DAY_LABELS, MAX_RANGES_PER_DAY, plural, timeZoneOptions } from '../utils/settingsLabels'
import type { SettingsErrors } from '../utils/settingsValidation'
import { formatDuration } from '../utils/settingsUnits'

const props = defineProps<{
  draft: ChatbotSettings
  readonly: boolean
  errors: SettingsErrors
}>()

const emit = defineEmits<{
  'toggle-day': [day: ChatbotWeekday]
  'add-range': [day: ChatbotWeekday]
  'remove-range': [day: ChatbotWeekday, index: number]
  'set-time': [day: ChatbotWeekday, index: number, part: 'open' | 'close', value: string]
  'set-zone': [zone: string]
  'copy-pickup': []
  'copy-days': [from: ChatbotWeekday, to: ChatbotWeekday[]]
}>()

const zones = computed(() => timeZoneOptions(props.draft.openingHours.timeZone))
const hasPickup = computed(() => props.draft.branchOpeningHours !== null)

const toMin = (t: string) => (/^\d{2}:\d{2}$/.test(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : 0)
const dayMinutes = (ranges: Array<{ open: string; close: string }>) =>
  ranges.reduce((sum, r) => (toMin(r.close) > toMin(r.open) ? sum + toMin(r.close) - toMin(r.open) : sum), 0)
const weekTotal = computed(() => props.draft.openingHours.days.reduce((sum, d) => sum + dayMinutes(d.ranges), 0))

const copyFrom = ref<ChatbotWeekday | null>(null)
const copyTo = ref<ChatbotWeekday[]>([])

function openCopy(day: ChatbotWeekday) {
  copyFrom.value = copyFrom.value === day ? null : day
  copyTo.value = []
}
function toggleTarget(day: ChatbotWeekday) {
  copyTo.value = copyTo.value.includes(day) ? copyTo.value.filter((d) => d !== day) : [...copyTo.value, day]
}
function pick(set: 'weekdays' | 'all' | 'none') {
  const others = CHATBOT_WEEKDAYS.filter((d) => d !== copyFrom.value)
  copyTo.value = set === 'all' ? others : set === 'none' ? [] : others.filter((d) => d !== 'SATURDAY' && d !== 'SUNDAY')
}
function applyCopy() {
  if (!copyFrom.value || copyTo.value.length === 0) return
  emit('copy-days', copyFrom.value, [...copyTo.value])
  copyFrom.value = null
  copyTo.value = []
}

const rangesOf = (day: ChatbotWeekday) => props.draft.openingHours.days.find((d) => d.day === day)?.ranges ?? []
const long = (day: ChatbotWeekday) => DAY_LABELS[day].long
const readonlyText = (day: ChatbotWeekday) => rangesOf(day).map((r) => `${r.open} – ${r.close}`).join(' · ')
</script>

<template>
  <div class="cbs-hours" data-testid="hours-section">
    <div class="cbs-note" role="note" data-testid="pickup-note">
      <UIcon name="i-lucide-info" class="cbs-note__icon" aria-hidden="true" />
      <p>
        <strong>Este horario es solo para el chatbot.</strong>
        Mide los plazos y pausa los tiempos fuera de horario. No cambia el horario de recolección en tienda, que se
        edita en Sistema › Envíos › Horario.
      </p>
    </div>

    <div class="cbs-hours__top">
      <div class="cbs-field">
        <label class="cbs-label" for="cbs-tz">Zona horaria</label>
        <select
          v-if="!readonly"
          id="cbs-tz"
          class="cbs-input"
          :value="draft.openingHours.timeZone"
          data-testid="tz-select"
          @change="emit('set-zone', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="zone in zones" :key="zone.value" :value="zone.value">{{ zone.label }}</option>
        </select>
        <span v-else class="cbs-readonly" data-testid="tz-readonly">
          {{ zones.find((z) => z.value === draft.openingHours.timeZone)?.label ?? draft.openingHours.timeZone }}
        </span>
        <span v-if="errors['h:tz']" class="cbs-error" role="alert">{{ errors['h:tz'] }}</span>
      </div>
      <div v-if="!readonly" class="cbs-pickup">
        <button
          type="button"
          class="cbs-btn"
          :disabled="!hasPickup"
          :aria-describedby="hasPickup ? undefined : 'cbs-pickup-why'"
          data-testid="copy-pickup"
          @click="emit('copy-pickup')"
        >
          <UIcon name="i-lucide-store" class="size-4" aria-hidden="true" />
          Copiar horario de recolección
        </button>
        <span id="cbs-pickup-why" class="cbs-help">
          {{
            hasPickup
              ? 'Trae el horario de Envíos como punto de partida. Después los dos horarios son independientes; se guarda con «Guardar».'
              : 'Esta sucursal no tiene horario de recolección en Envíos, así que no hay nada que copiar.'
          }}
        </span>
      </div>
    </div>

    <div v-if="errors['h:week']" class="cbs-alert" data-tone="danger" role="alert" data-testid="week-error">
      <UIcon name="i-lucide-circle-alert" class="cbs-alert__icon" aria-hidden="true" />
      <div>
        <strong>{{ errors['h:week'] }}</strong>
        El chatbot necesita al menos un horario para calcular plazos.
      </div>
    </div>

    <ul class="cbs-days" aria-label="Horario de atención por día">
      <li
        v-for="day in CHATBOT_WEEKDAYS"
        :id="`dr-${day}`"
        :key="day"
        class="cbs-day"
        :data-open="rangesOf(day).length > 0"
        :data-invalid="errors[`h:${day}`] ? 'true' : undefined"
        :data-testid="`day-${day}`"
      >
        <b class="cbs-day__name">{{ long(day) }}</b>

        <button
          v-if="!readonly"
          type="button"
          role="switch"
          class="cbs-switch"
          :aria-checked="rangesOf(day).length > 0"
          :aria-label="`${long(day)}: ${rangesOf(day).length ? 'abierto' : 'cerrado'}`"
          :data-testid="`toggle-${day}`"
          @click="emit('toggle-day', day)"
        >
          <span class="cbs-track" aria-hidden="true" />
          <span class="cbs-switch__text">{{ rangesOf(day).length ? 'Abierto' : 'Cerrado' }}</span>
        </button>
        <span v-else class="cbs-badge" :data-tone="rangesOf(day).length ? 'success' : 'muted'">
          {{ rangesOf(day).length ? 'Abierto' : 'Cerrado' }}
        </span>

        <div class="cbs-day__ranges">
          <span v-if="!rangesOf(day).length" class="cbs-muted">Sin atención este día</span>
          <span v-else-if="readonly" class="cbs-figure" :data-testid="`ranges-${day}`">{{ readonlyText(day) }}</span>
          <template v-else>
            <div v-for="(range, index) in rangesOf(day)" :key="index" class="cbs-range">
              <input
                :id="`t-${day}-${index}-open`"
                type="time"
                max="23:59"
                class="cbs-input cbs-time"
                :value="range.open"
                :aria-label="`${long(day)}, horario ${index + 1}: abre`"
                :aria-invalid="errors[`h:${day}`] ? 'true' : undefined"
                :data-testid="`open-${day}-${index}`"
                @change="emit('set-time', day, index, 'open', ($event.target as HTMLInputElement).value)"
              />
              <span class="cbs-muted" aria-hidden="true">a</span>
              <input
                :id="`t-${day}-${index}-close`"
                type="time"
                max="23:59"
                class="cbs-input cbs-time"
                :value="range.close"
                :aria-label="`${long(day)}, horario ${index + 1}: cierra`"
                :aria-invalid="errors[`h:${day}`] ? 'true' : undefined"
                :data-testid="`close-${day}-${index}`"
                @change="emit('set-time', day, index, 'close', ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                class="cbs-icon-btn"
                :aria-label="`Quitar horario ${index + 1} del ${long(day).toLowerCase()}`"
                :data-testid="`remove-${day}-${index}`"
                @click="emit('remove-range', day, index)"
              >
                <UIcon name="i-lucide-x" class="size-4" aria-hidden="true" />
              </button>
            </div>
            <button
              v-if="rangesOf(day).length < MAX_RANGES_PER_DAY"
              type="button"
              class="cbs-link"
              :aria-label="`Agregar horario al ${long(day).toLowerCase()}`"
              :data-testid="`add-${day}`"
              @click="emit('add-range', day)"
            >
              <UIcon name="i-lucide-plus" class="size-3.5" aria-hidden="true" />
              Agregar horario
            </button>
          </template>
        </div>

        <span class="cbs-day__total cbs-figure">{{ dayMinutes(rangesOf(day)) ? formatDuration(dayMinutes(rangesOf(day))) : '' }}</span>

        <div class="cbs-day__copy">
          <button
            v-if="!readonly && rangesOf(day).length"
            type="button"
            class="cbs-btn cbs-btn--ghost cbs-copy-trigger"
            aria-haspopup="dialog"
            :aria-expanded="copyFrom === day"
            :aria-label="`Copiar el horario del ${long(day).toLowerCase()} a otros días`"
            :data-testid="`copy-${day}`"
            @click="openCopy(day)"
          >
            <UIcon name="i-lucide-copy" class="size-4" aria-hidden="true" />
            Copiar a…
          </button>
        </div>

        <div
          v-if="copyFrom === day"
          class="cbs-copy"
          role="dialog"
          :aria-label="`Copiar el horario del ${long(day).toLowerCase()}`"
          data-testid="copy-panel"
        >
          <h3>Copiar el horario del {{ long(day).toLowerCase() }} a…</h3>
          <p class="cbs-help">Reemplaza el horario de los días que elijas.</p>
          <div class="cbs-chips" role="group" aria-label="Días de destino">
            <button
              v-for="target in CHATBOT_WEEKDAYS.filter((d) => d !== day)"
              :key="target"
              type="button"
              class="cbs-chip"
              :aria-pressed="copyTo.includes(target)"
              :data-testid="`target-${target}`"
              @click="toggleTarget(target)"
            >
              {{ DAY_LABELS[target].short }}
            </button>
          </div>
          <div class="cbs-copy__quick">
            <button type="button" class="cbs-link" data-testid="pick-weekdays" @click="pick('weekdays')">Lun–vie</button>
            <button type="button" class="cbs-link" data-testid="pick-all" @click="pick('all')">Todos</button>
            <button type="button" class="cbs-link" data-testid="pick-none" @click="pick('none')">Ninguno</button>
          </div>
          <div class="cbs-copy__foot">
            <button type="button" class="cbs-btn" data-testid="copy-cancel" @click="copyFrom = null">Cancelar</button>
            <button
              type="button"
              class="cbs-btn cbs-btn--primary"
              :disabled="copyTo.length === 0"
              data-testid="copy-apply"
              @click="applyCopy"
            >
              Copiar a {{ plural(copyTo.length, 'día', 'días') }}
            </button>
          </div>
        </div>

        <span v-if="errors[`h:${day}`]" class="cbs-error cbs-day__error" role="alert" :data-testid="`error-${day}`">
          <UIcon name="i-lucide-circle-alert" class="size-4" aria-hidden="true" />
          {{ errors[`h:${day}`] }}
        </span>
      </li>
    </ul>

    <p class="cbs-help cbs-foot">
      {{ weekTotal ? `${formatDuration(weekTotal)} de atención por semana.` : 'Sin horas de atención esta semana.' }}
      Fuera de este horario los plazos se pausan y las solicitudes muestran «se reanuda…».
    </p>
  </div>
</template>
