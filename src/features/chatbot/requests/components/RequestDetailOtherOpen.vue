<script setup lang="ts">
/**
 * RequestDetailOtherOpen — the customer's other open requests (up to 20), each a link to its own
 * detail with its time light. Summaries are bot text: rendered as text.
 */
import { useId } from 'vue'
import type { ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import RequestStatusBadge from './RequestStatusBadge.vue'
import SlaIndicator from './SlaIndicator.vue'
import SubtypeTag from './SubtypeTag.vue'

defineProps<{
  requests: ChatbotRequestRow[]
  currentUserId?: string | null
  timeZone?: string
  now?: Date
}>()

const headingId = useId()
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="other-open">
    <div class="rd-panel__head">
      <h2 :id="headingId">Otras solicitudes abiertas de este cliente</h2>
      <span class="rd-sub rd-fig" data-testid="other-open-count">{{ requests.length }}</span>
    </div>
    <ul v-if="requests.length" class="rd-list">
      <li v-for="row in requests" :key="row.id">
        <RouterLink
          class="rd-row"
          data-testid="other-open-link"
          :to="{ name: 'chatbot-request-detail', params: { id: row.id } }"
        >
          <span class="rd-row__text">
            <span class="rd-row__meta">
              <SubtypeTag :subtype="row.subtype" />
              <span class="rd-folio">{{ row.folio }}</span>
              <RequestStatusBadge :row="row" :current-user-id="currentUserId" />
            </span>
            <span class="rd-ellipsis">{{ row.summary }}</span>
          </span>
          <SlaIndicator :row="row" compact :now="now" :time-zone="timeZone" />
          <UIcon name="i-lucide-chevron-right" class="rd-row__chev" aria-hidden="true" />
        </RouterLink>
      </li>
    </ul>
    <p v-else class="rd-sub">No tiene otras solicitudes abiertas.</p>
  </section>
</template>
