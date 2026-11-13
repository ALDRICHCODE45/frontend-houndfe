<script setup lang="ts">
/**
 * RequestDetailClosedNotice — how a closed request ended: resolved (by whom) or cancelled (the
 * cause; «Fusionada en S-…» links to the request that stayed) and when. Open requests render
 * nothing.
 */
import { computed } from 'vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { cancelCauseLabel, complaintOutcomeLabel, formatWhen } from '../utils/requestLabels'

const props = defineProps<{
  request: ChatbotRequestDetail
  currentUserId?: string | null
  timeZone?: string
  now?: Date
}>()

const resolved = computed(() => props.request.status === 'RESOLVED')
const cancelled = computed(() => props.request.status === 'CANCELLED')
const closedAt = computed(() => formatWhen(props.request.closedAt, { timeZone: props.timeZone, now: props.now }))
const resolver = computed(() => {
  const by = props.request.resolvedBy
  if (!by) return null
  return by.id === props.currentUserId ? 'ti' : by.displayName
})
const outcome = computed(() => complaintOutcomeLabel(props.request.complaintOutcome))
const cause = computed(() => (props.request.mergedInto ? null : cancelCauseLabel(props.request)))
</script>

<template>
  <div
    v-if="resolved || cancelled"
    class="rd-alert"
    :class="resolved ? 'rd-alert--success' : 'rd-alert--info'"
    role="note"
    data-testid="closed-notice"
  >
    <UIcon :name="resolved ? 'i-lucide-circle-check' : 'i-lucide-ban'" aria-hidden="true" />
    <div>
      <strong>{{ resolved ? 'Solicitud resuelta' : 'Solicitud cancelada' }}</strong>
      <span v-if="resolved && resolver">Resuelta por {{ resolver }}</span>
      <span v-if="resolved && outcome" data-testid="complaint-outcome">Resultado de la queja: {{ outcome }}</span>
      <span v-if="cause">{{ cause }}</span>
      <span v-if="request.mergedInto">
        Fusionada en
        <RouterLink
          class="rd-link"
          data-testid="merged-into-link"
          :to="{ name: 'chatbot-request-detail', params: { id: request.mergedInto.id } }"
        >{{ request.mergedInto.folio }}</RouterLink>
      </span>
      <span v-if="closedAt">Cerrada {{ closedAt }}</span>
    </div>
  </div>
</template>
