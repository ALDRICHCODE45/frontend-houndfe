<script setup lang="ts">
/**
 * SchedulingSection — «Conversaciones agendadas» (design 01): a switch row plus the slots cap (duration of
 * each slot, slots offered, max per slot). Stored only: the whole section says «Aún sin efecto».
 */
import type { ChatbotScheduling } from '../interfaces/chatbot-settings.types'
import type { SettingsErrors } from '../utils/settingsValidation'
import NumberField from './NumberField.vue'

type Field = 'slotMinutes' | 'slotsOffered' | 'maxScheduledPerSlot'

defineProps<{
  scheduling: ChatbotScheduling
  readonly: boolean
  errors: SettingsErrors
}>()
const emit = defineEmits<{ 'set-enabled': [value: boolean]; 'set-field': [field: Field, value: number] }>()

const FIELDS: Array<{ field: Field; error: string; id: string; label: string; help: string }> = [
  { field: 'slotMinutes', error: 'c:slot', id: 'cbs-slot', label: 'Duración de cada horario (min)', help: 'De 5 a 240.' },
  { field: 'slotsOffered', error: 'c:offered', id: 'cbs-offered', label: 'Horarios que se ofrecen', help: 'De 1 a 10 opciones.' },
  { field: 'maxScheduledPerSlot', error: 'c:max', id: 'cbs-max', label: 'Máximo por horario', help: 'Conversaciones a la vez, de 1 a 50.' },
]
</script>

<template>
  <div class="cbs-sched" data-testid="sched-section">
    <div class="cbs-note" role="note">
      <UIcon name="i-lucide-info" class="cbs-note__icon" aria-hidden="true" />
      <p>
        <strong>Se guarda, pero todavía no cambia al chatbot.</strong>
        Las conversaciones agendadas llegan en una versión posterior. Puedes dejar los valores listos.
      </p>
    </div>

    <button
      v-if="!readonly"
      type="button"
      role="switch"
      class="cbs-switch-row"
      :aria-checked="scheduling.enabled"
      aria-labelledby="cbs-sched-title"
      aria-describedby="cbs-sched-desc"
      data-testid="sched-toggle"
      @click="emit('set-enabled', !scheduling.enabled)"
    >
      <span class="cbs-switch-row__text">
        <span id="cbs-sched-title" class="cbs-switch-row__title">Permitir conversaciones agendadas</span>
        <span id="cbs-sched-desc" class="cbs-help">El cliente elige un horario para que una persona lo atienda.</span>
      </span>
      <span class="cbs-track" aria-hidden="true" />
    </button>
    <div v-else class="cbs-switch-row cbs-switch-row--static">
      <span class="cbs-switch-row__text">
        <span class="cbs-switch-row__title">Permitir conversaciones agendadas</span>
        <span class="cbs-help">El cliente elige un horario para que una persona lo atienda.</span>
      </span>
      <span class="cbs-badge" data-testid="sched-state">{{ scheduling.enabled ? 'Activadas' : 'Desactivadas' }}</span>
    </div>

    <div class="cbs-grid cbs-grid--three">
      <div v-for="item in FIELDS" :key="item.field" class="cbs-field">
        <label class="cbs-label" :for="item.id">{{ item.label }}</label>
        <span v-if="readonly" class="cbs-readonly cbs-figure" :data-testid="`${item.field}-readonly`">{{ scheduling[item.field] }}</span>
        <NumberField
          v-else
          :id="item.id"
          :model-value="scheduling[item.field]"
          :label="item.label"
          :invalid="!!errors[item.error]"
          :describedby="`${item.id}-error`"
          @update:model-value="emit('set-field', item.field, $event)"
        />
        <span class="cbs-help">{{ item.help }}</span>
        <span v-if="errors[item.error]" :id="`${item.id}-error`" class="cbs-error" role="alert" :data-testid="`error-${item.field}`">
          {{ errors[item.error] }}
        </span>
      </div>
    </div>
  </div>
</template>
