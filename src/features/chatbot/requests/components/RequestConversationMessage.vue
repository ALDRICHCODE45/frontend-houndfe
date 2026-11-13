<script setup lang="ts">
/**
 * RequestConversationMessage — one bubble of the mirrored chat (handoff 18). Design 01-tabla-agrupada
 * `convoHTML`: the customer on the left, bot and staff on the right, «Autor · hora» under the text.
 *
 * `message.text` is the customer's own words: rendered as text (`white-space: pre-wrap` keeps the
 * line breaks), never as HTML. The file, if any, is `RequestConversationMedia`.
 */
import { computed } from 'vue'
import type { ChatbotMessage } from '../interfaces/chatbot-request.types'
import { authorLabel, mediaKind, messageSide, messageTime } from '../utils/conversation-format'
import { deliveryView } from '../utils/live-delivery'
import RequestConversationMedia from './RequestConversationMedia.vue'

const props = defineProps<{
  message: ChatbotMessage
  /** IANA zone for the time; defaults to the runtime zone. */
  timeZone?: string
  /** The clock of the delivery labels («Pendiente de envío» after 30 s); defaults to the real one. */
  now?: Date
  /** The viewer is the attendee who may send: «Reintentar» / «Enviar como mensaje nuevo» appear. */
  canAct?: boolean
  /** This message was already sent again as a new one. */
  retried?: boolean
}>()
const emit = defineEmits<{ retry: [message: ChatbotMessage] }>()

const side = computed(() => messageSide(props.message))
const kind = computed(() => mediaKind(props.message))
const time = computed(() => messageTime(props.message, props.timeZone))
const delivery = computed(() =>
  deliveryView(props.message, { now: props.now ?? new Date(), canAct: props.canAct, retried: props.retried }),
)
const text = computed(() => (props.message.text && props.message.text.length > 0 ? props.message.text : null))
const meta = computed(() => [authorLabel(props.message), time.value].filter(Boolean).join(' · '))
const retryLabel = computed(() => (delivery.value?.action === 'resend' ? 'Enviar como mensaje nuevo' : 'Reintentar'))
</script>

<template>
  <div
    class="rc-msg"
    :class="`rc-msg--${side}`"
    :data-side="side"
    :data-seq="message.seq"
    data-testid="conversation-message"
  >
    <div class="rc-bubble">
      <span v-if="message.type === 'TEMPLATE'" class="rc-tag" data-testid="message-template">
        <UIcon name="i-lucide-layout-template" aria-hidden="true" />Plantilla<template v-if="message.templateName"> «{{ message.templateName }}»</template>
      </span>
      <p v-if="message.type === 'TEMPLATE'" class="rc-note" data-testid="message-template-note">
        Mensaje aprobado de WhatsApp, enviado con costo.
      </p>
      <RequestConversationMedia v-if="kind" :message="message" :kind="kind" />
      <p
        v-if="text"
        class="rc-text"
        :class="{ 'rc-text--unsupported': message.type === 'UNSUPPORTED' }"
        data-testid="message-text"
      >{{ text }}</p>
      <span v-if="message.type === 'UNSUPPORTED'" class="rc-sr" data-testid="message-unsupported">
        Mensaje que el sistema no guarda
      </span>
      <small v-if="side !== 'system'" class="rc-meta" data-testid="message-meta">
        {{ meta }}
        <span
          v-if="delivery"
          class="rc-dl"
          :class="`rc-dl--${delivery.tone}`"
          :data-key="delivery.key"
          data-testid="message-delivery"
        ><UIcon :name="delivery.icon" aria-hidden="true" />{{ delivery.label }}</span>
      </small>
      <p v-if="delivery?.note" class="rc-note" :class="`rc-note--${delivery.tone}`" data-testid="message-delivery-note">
        {{ delivery.note }}
      </p>
      <button
        v-if="delivery?.action"
        type="button"
        class="rc-retry"
        data-testid="message-retry"
        @click="emit('retry', message)"
      >
        <UIcon :name="delivery.action === 'resend' ? 'i-lucide-send' : 'i-lucide-refresh-cw'" aria-hidden="true" />{{ retryLabel }}
      </button>
    </div>
  </div>
</template>
