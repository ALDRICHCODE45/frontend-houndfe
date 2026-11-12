<script setup lang="ts">
/**
 * RequestDetailDeliveries — what the bot sent back to the customer and whether it arrived. The
 * raw delivery type and provider status are internal: only the outcome is said, in words.
 */
import { useId } from 'vue'
import type { ChatbotRequestDelivery } from '../interfaces/chatbot-request.types'
import { deliveryOutcomeLabel } from '../utils/detail-format'
import { formatWhen } from '../utils/requestLabels'

const props = defineProps<{
  deliveries: ChatbotRequestDelivery[]
  timeZone?: string
  now?: Date
}>()

const headingId = useId()
const when = (iso: string | null) => formatWhen(iso, { timeZone: props.timeZone, now: props.now })
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="deliveries">
    <h2 :id="headingId">Avisos al cliente</h2>
    <ul class="rd-list">
      <li
        v-for="delivery in deliveries"
        :key="delivery.deliveryId"
        class="rd-delivery"
        data-testid="delivery-item"
        :data-doubtful="String(delivery.needsReconciliation)"
      >
        <UIcon
          :name="delivery.needsReconciliation ? 'i-lucide-triangle-alert' : 'i-lucide-send'"
          aria-hidden="true"
        />
        <span>
          <b>{{ deliveryOutcomeLabel(delivery.outcome) }}</b>
          <small class="rd-sub">Respuesta al cliente · {{ when(delivery.createdAt) ?? '—' }}</small>
        </span>
      </li>
    </ul>
  </section>
</template>
