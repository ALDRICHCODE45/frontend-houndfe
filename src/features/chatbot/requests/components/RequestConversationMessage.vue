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
import {
  authorLabel,
  deliveryLabel,
  mediaKind,
  messageSide,
  messageTime,
} from '../utils/conversation-format'
import RequestConversationMedia from './RequestConversationMedia.vue'

const props = defineProps<{
  message: ChatbotMessage
  /** IANA zone for the time; defaults to the runtime zone. */
  timeZone?: string
}>()

const side = computed(() => messageSide(props.message))
const kind = computed(() => mediaKind(props.message))
const time = computed(() => messageTime(props.message, props.timeZone))
const delivery = computed(() => (props.message.direction === 'OUT' ? deliveryLabel(props.message.deliveryStatus) : null))
const text = computed(() => (props.message.text && props.message.text.length > 0 ? props.message.text : null))
const meta = computed(() => [authorLabel(props.message), time.value, delivery.value].filter(Boolean).join(' · '))
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
        <UIcon name="i-lucide-layout-template" aria-hidden="true" />Plantilla
      </span>
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
      <small v-if="side !== 'system'" class="rc-meta" data-testid="message-meta">{{ meta }}</small>
    </div>
  </div>
</template>
