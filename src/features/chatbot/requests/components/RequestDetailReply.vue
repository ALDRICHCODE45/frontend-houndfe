<script setup lang="ts">
/**
 * RequestDetailReply — «Respuesta enviada»: the answer a clarification got (handoff 19 §3), who
 * wrote it and when, and the state of its delivery (`request.answered`). The text is the staff
 * member's own plain text, rendered as text. A deferred answer says it waits for the customer.
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestDelivery, ChatbotRequestReply } from '../interfaces/chatbot-request.types'
import { replyDeliveryLabel } from '../utils/detail-format'
import { formatWhen } from '../utils/requestLabels'

const props = defineProps<{
  reply: ChatbotRequestReply
  deliveries: ChatbotRequestDelivery[]
  currentUserId?: string | null
  timeZone?: string
  now?: Date
}>()

const headingId = useId()

// `deliveries` come newest first: the first answer delivery is the latest attempt.
const delivery = computed(() => props.deliveries.find((item) => item.type === 'request.answered') ?? null)
const author = computed(() =>
  props.reply.repliedBy.id === props.currentUserId ? 'ti' : props.reply.repliedBy.displayName,
)
const byline = computed(() =>
  [author.value, formatWhen(props.reply.repliedAt, { timeZone: props.timeZone, now: props.now })]
    .filter(Boolean)
    .join(' · '),
)
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="reply-block">
    <h2 :id="headingId">Respuesta enviada</h2>
    <p class="rd-quote rd-reply__text" data-testid="reply-text">{{ reply.text }}</p>
    <p class="rd-sub" data-testid="reply-byline">{{ byline }}</p>
    <p
      v-if="delivery"
      class="rd-delivery rd-reply__delivery"
      data-testid="reply-delivery"
      :data-doubtful="String(delivery.needsReconciliation)"
    >
      {{ replyDeliveryLabel(delivery.outcome) }}
    </p>
  </section>
</template>
