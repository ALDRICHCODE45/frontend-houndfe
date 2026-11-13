<script setup lang="ts">
/**
 * RequestLiveBlocked — the composer while the 24 h window is closed (handoff 20 §3c). Design
 * 01-chat-en-la-pagina `blockedHTML` and 04-movil-y-estados «Con la ventana de 24 h cerrada».
 *
 * WhatsApp only lets the attendee write freely 24 h after the customer's last message, so there is
 * no text box here: the one way out is the paid template, and it costs money. The cost text comes
 * from the branch settings and sits right above the button; the button only asks for the
 * confirmation (`RequestLiveTemplateSheet`), nothing is ever sent automatically. A draft written
 * before the window closed stays visible (a refusal never discards it).
 */
import type { TemplateState } from '../composables/useLiveChat'

const props = defineProps<{
  draft: string
  /** «ayer a las 10:05»: when the customer last wrote; `null` when unknown. */
  lastCustomerLabel: string | null
  templateState: TemplateState
  /** The server (or `allowedActions`) says the template can be sent now. */
  templateAvailable: boolean
  costText: string
  busy?: boolean
}>()
const emit = defineEmits<{ template: [] }>()

const isRetry = () => props.templateState === 'failed'
</script>

<template>
  <section class="lb" aria-labelledby="lb-title" data-testid="live-blocked">
    <div class="lb-head">
      <UIcon name="i-lucide-lock" aria-hidden="true" />
      <div>
        <h3 id="lb-title">La ventana de 24 h está cerrada</h3>
        <p>
          WhatsApp solo deja escribir libremente durante 24 h después del último mensaje del cliente.
          <template v-if="lastCustomerLabel">El cliente escribió por última vez {{ lastCustomerLabel }}.</template>
        </p>
      </div>
    </div>

    <div v-if="draft.trim()" class="lb-kept" data-testid="blocked-draft">
      <span class="lb-kept__label">Tu borrador, sin enviar</span>
      <p>{{ draft }}</p>
    </div>

    <div class="lb-cost" data-testid="template-cost">
      <UIcon name="i-lucide-receipt-text" aria-hidden="true" />
      <div>
        <b>Plantilla de WhatsApp</b>
        <span>{{ costText }}</span>
        <small>
          Se manda solo cuando tú lo confirmas, una sola vez por ventana cerrada. Cuando el cliente responda, la
          ventana se abre y podrás escribir aquí.
        </small>
      </div>
    </div>

    <div class="lb-state">
      <div v-if="templateState === 'pending'" class="rd-alert rd-alert--info" role="status" data-testid="template-state">
        <UIcon name="i-lucide-circle-check" aria-hidden="true" />
        <div>
          <strong>Plantilla enviada</strong>
          Esperamos la respuesta del cliente. Solo se envía una por ventana cerrada.
        </div>
      </div>
      <div v-else-if="templateState === 'failed'" class="rd-alert rd-alert--warn" role="alert" data-testid="template-state">
        <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
        <div>
          <strong>La plantilla no se pudo entregar</strong>
          Reintentar crea un envío nuevo. Antes de confirmar vuelves a ver el costo.
        </div>
      </div>
      <div v-else-if="templateState === 'unknown'" class="rd-alert rd-alert--warn" role="status" data-testid="template-state">
        <UIcon name="i-lucide-circle-help" aria-hidden="true" />
        <div>
          <strong>Entrega dudosa</strong>
          Puede que la plantilla ya se haya enviado y costado. No se puede reenviar: espera la respuesta del cliente.
        </div>
      </div>
      <div v-else-if="templateState === 'none'" class="rd-alert rd-alert--warn" role="status" data-testid="template-state">
        <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
        <div>
          <strong>No hay plantilla configurada</strong>
          Esta sucursal no tiene una plantilla en los ajustes del chatbot. Pide a un administrador que la configure.
          <RouterLink class="rc-linkbtn" :to="{ name: 'chatbot-settings' }" data-testid="template-settings-link">
            Ir a Ajustes del chatbot
          </RouterLink>
        </div>
      </div>
      <p v-else-if="!templateAvailable" class="rd-help" data-testid="template-unavailable">
        <UIcon name="i-lucide-info" aria-hidden="true" />
        El envío de la plantilla no está disponible ahora para esta conversación.
      </p>

      <UButton
        color="primary"
        :variant="templateState === 'ready' || templateState === 'failed' ? 'solid' : 'outline'"
        :icon="isRetry() ? 'i-lucide-refresh-cw' : 'i-lucide-receipt-text'"
        :label="
          templateState === 'pending' || templateState === 'unknown'
            ? 'Plantilla enviada'
            : isRetry()
              ? 'Reintentar plantilla…'
              : 'Enviar plantilla…'
        "
        :disabled="!templateAvailable || busy"
        :loading="busy"
        data-testid="template-open"
        @click="emit('template')"
      />
    </div>
  </section>
</template>
