<script setup lang="ts">
/**
 * ExtrasSection — «Ventana y plantilla» (design 01): WhatsApp window warning, template name and language,
 * the cost text and the start timeout of a live conversation. The window warning drives the inbox filter
 * «Ventana por cerrar» (0 turns it off); the template, its language and the cost text are read by the
 * «Enviar plantilla» button of the live chat. The language (`xx` or `xx_YY`) is the paid template's. The timeout
 * (30 to 600 s) is how long a claim waits for the bot to confirm; a change applies to the next claim only.
 * Template, its language, the cost and the timeout are per branch: «Aplicar a todas» does not copy them.
 */
import type { ChatbotSettings } from '../interfaces/chatbot-settings.types'
import type { SettingsErrors } from '../utils/settingsValidation'
import { formatDuration } from '../utils/settingsUnits'
import DurationField from './DurationField.vue'
import NumberField from './NumberField.vue'

defineProps<{
  draft: ChatbotSettings
  readonly: boolean
  errors: SettingsErrors
}>()
const emit = defineEmits<{
  'set-window': [value: number]
  'set-template-name': [value: string | null]
  'set-template-cost': [value: string]
  'set-template-language': [value: string]
  'set-start-timeout': [value: number]
}>()
</script>

<template>
  <div class="cbs-extras" data-testid="extras-section">
    <div class="cbs-grid">
      <div class="cbs-field">
        <label class="cbs-label" for="cbs-window">
          Avisar antes de que se cierre la ventana de WhatsApp
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
          La ventana de 24 h permite escribir sin plantilla. El filtro «Ventana por cerrar» de la bandeja usa este valor; con 0 se apaga el aviso.
        </span>
        <span v-if="errors['x:window']" id="cbs-window-error" class="cbs-error" role="alert" data-testid="window-error">
          {{ errors['x:window'] }}
        </span>
      </div>

      <div class="cbs-field">
        <label class="cbs-label" for="cbs-template">
          Plantilla de WhatsApp
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

      <div class="cbs-field">
        <label class="cbs-label" for="cbs-template-language">Idioma de la plantilla</label>
        <span v-if="readonly" class="cbs-readonly cbs-mono" data-testid="template-language-readonly">
          {{ draft.templateLanguageCode }}
        </span>
        <input
          v-else
          id="cbs-template-language"
          class="cbs-input cbs-mono"
          :value="draft.templateLanguageCode"
          placeholder="es_MX"
          autocomplete="off"
          spellcheck="false"
          :aria-invalid="errors['x:templateLanguage'] ? 'true' : undefined"
          aria-describedby="cbs-template-language-help cbs-template-language-error"
          data-testid="template-language-input"
          @input="emit('set-template-language', ($event.target as HTMLInputElement).value)"
        />
        <span id="cbs-template-language-help" class="cbs-help">
          Idioma en el que está aprobada la plantilla: es o es_MX, en minúsculas y con el país en mayúsculas.
        </span>
        <span
          v-if="errors['x:templateLanguage']"
          id="cbs-template-language-error"
          class="cbs-error"
          role="alert"
          data-testid="template-language-error"
        >
          {{ errors['x:templateLanguage'] }}
        </span>
      </div>

      <div class="cbs-field">
        <label class="cbs-label" for="cbs-start-timeout">Espera al tomar una conversación en vivo (segundos)</label>
        <span v-if="readonly" class="cbs-readonly cbs-figure" data-testid="start-timeout-readonly">
          {{ draft.startTimeoutSeconds }} s
        </span>
        <NumberField
          v-else
          id="cbs-start-timeout"
          :model-value="draft.startTimeoutSeconds"
          label="Espera al tomar una conversación en vivo, en segundos"
          :invalid="!!errors['x:startTimeout']"
          describedby="cbs-start-timeout-help cbs-start-timeout-error"
          @update:model-value="emit('set-start-timeout', $event)"
        />
        <span id="cbs-start-timeout-help" class="cbs-help">
          Segundos (de 30 a 600) que espera el chatbot para confirmar que dejó de responder cuando alguien toma una conversación en vivo. Un cambio aplica a la siguiente toma, no a una ya iniciada.
        </span>
        <span
          v-if="errors['x:startTimeout']"
          id="cbs-start-timeout-error"
          class="cbs-error"
          role="alert"
          data-testid="start-timeout-error"
        >
          {{ errors['x:startTimeout'] }}
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
      Son por sucursal: «Aplicar a todas» no copia la plantilla, su idioma, el texto de costo ni el tiempo de espera.
    </p>
  </div>
</template>
