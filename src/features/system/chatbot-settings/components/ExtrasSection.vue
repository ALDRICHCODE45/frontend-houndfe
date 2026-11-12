<script setup lang="ts">
/**
 * ExtrasSection — «Ventana y plantilla» (design 01): WhatsApp window warning, template name and the cost
 * text. Stored only today: the window warning and the template are marked «Aún sin efecto» (the inbox filter
 * keeps its own 2 h; the send-template command comes later). Template and cost are per branch: «Aplicar a
 * todas» does not copy them.
 */
import type { ChatbotSettings } from '../interfaces/chatbot-settings.types'
import type { SettingsErrors } from '../utils/settingsValidation'
import { formatDuration } from '../utils/settingsUnits'
import DurationField from './DurationField.vue'
import PendingBadge from './PendingBadge.vue'

defineProps<{
  draft: ChatbotSettings
  readonly: boolean
  errors: SettingsErrors
}>()
const emit = defineEmits<{
  'set-window': [value: number]
  'set-template-name': [value: string | null]
  'set-template-cost': [value: string]
}>()
</script>

<template>
  <div class="cbs-extras" data-testid="extras-section">
    <div class="cbs-grid">
      <div class="cbs-field">
        <label class="cbs-label" for="cbs-window">
          Avisar antes de que se cierre la ventana de WhatsApp
          <PendingBadge />
        </label>
        <span v-if="readonly" class="cbs-readonly cbs-figure" data-testid="window-readonly">
          {{ formatDuration(draft.windowWarningMinutes) }}
        </span>
        <DurationField
          v-else
          id="cbs-window"
          :model-value="draft.windowWarningMinutes"
          label="Avisar antes de que se cierre la ventana de WhatsApp"
          :nullable="false"
          :invalid="!!errors['x:window']"
          describedby="cbs-window-help cbs-window-error"
          @update:model-value="emit('set-window', $event ?? Number.NaN)"
        />
        <span id="cbs-window-help" class="cbs-help">
          La ventana de 24 h permite escribir sin plantilla. Hoy el filtro «Ventana por cerrar» de la bandeja usa 2 h fijas.
        </span>
        <span v-if="errors['x:window']" id="cbs-window-error" class="cbs-error" role="alert" data-testid="window-error">
          {{ errors['x:window'] }}
        </span>
      </div>

      <div class="cbs-field">
        <label class="cbs-label" for="cbs-template">
          Plantilla de WhatsApp
          <PendingBadge />
        </label>
        <span v-if="readonly" class="cbs-readonly cbs-mono" data-testid="template-readonly">
          {{ draft.templateName ?? 'Sin configurar' }}
        </span>
        <input
          v-else
          id="cbs-template"
          class="cbs-input cbs-mono"
          :value="draft.templateName ?? ''"
          placeholder="p. ej. aviso_seguimiento"
          autocomplete="off"
          spellcheck="false"
          :aria-invalid="errors['x:template'] ? 'true' : undefined"
          aria-describedby="cbs-template-help cbs-template-error"
          data-testid="template-input"
          @input="emit('set-template-name', ($event.target as HTMLInputElement).value === '' ? null : ($event.target as HTMLInputElement).value)"
        />
        <span id="cbs-template-help" class="cbs-help">
          Minúsculas, números y _. Sin nombre, «Enviar plantilla» no estará disponible.
        </span>
        <span v-if="errors['x:template']" id="cbs-template-error" class="cbs-error" role="alert" data-testid="template-error">
          {{ errors['x:template'] }}
        </span>
      </div>

      <div class="cbs-field cbs-field--wide">
        <label class="cbs-label" for="cbs-cost">Texto de costo al enviar una plantilla</label>
        <span v-if="readonly" class="cbs-readonly" data-testid="cost-readonly">{{ draft.templateCostText }}</span>
        <template v-else>
          <textarea
            id="cbs-cost"
            class="cbs-input"
            rows="2"
            maxlength="200"
            :value="draft.templateCostText"
            :aria-invalid="errors['x:templateCost'] ? 'true' : undefined"
            aria-describedby="cbs-cost-help cbs-cost-error"
            data-testid="cost-input"
            @input="emit('set-template-cost', ($event.target as HTMLTextAreaElement).value)"
          />
          <span class="cbs-counter cbs-figure">{{ draft.templateCostText.length }} / 200</span>
        </template>
        <span id="cbs-cost-help" class="cbs-help">Se muestra tal cual en la confirmación de «Enviar plantilla».</span>
        <span v-if="errors['x:templateCost']" id="cbs-cost-error" class="cbs-error" role="alert" data-testid="cost-error">
          {{ errors['x:templateCost'] }}
        </span>
      </div>
    </div>
    <p class="cbs-help cbs-foot">
      <UIcon name="i-lucide-info" class="size-3.5" aria-hidden="true" />
      La plantilla y su texto de costo son por sucursal: «Aplicar a todas» no los copia.
    </p>
  </div>
</template>
