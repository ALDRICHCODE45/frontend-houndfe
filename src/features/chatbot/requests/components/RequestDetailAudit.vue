<script setup lang="ts">
/**
 * RequestDetailAudit — timeline of what happened to the request, newest first. The label comes
 * from the shared labels (an unknown event type reads generically, never as a raw code); the
 * second line says who and when plus what the type adds. «Ver más eventos» asks for the next page.
 */
import { useId } from 'vue'
import type { ChatbotRequestAuditItem } from '../interfaces/chatbot-request.types'
import { auditActorLabel, auditEventDetail, auditEventTone } from '../utils/detail-format'
import { auditEventLabel, formatWhen } from '../utils/requestLabels'

const props = defineProps<{
  events: ChatbotRequestAuditItem[]
  hasMore: boolean
  loadingMore: boolean
  currentUserId?: string | null
  timeZone?: string
  now?: Date
}>()

defineEmits<{ more: [] }>()

const headingId = useId()

function title(event: ChatbotRequestAuditItem): string {
  const label = auditEventLabel(event.type, event.data)
  return event.type === 'CLAIMED' || event.type === 'REASSIGNED'
    ? `${label} por ${auditActorLabel(event.actor, props.currentUserId)}`
    : label
}

function byline(event: ChatbotRequestAuditItem): string {
  const when = formatWhen(event.createdAt, { timeZone: props.timeZone, now: props.now })
  return [auditActorLabel(event.actor, props.currentUserId), when].filter(Boolean).join(' · ')
}
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="audit">
    <h2 :id="headingId">Historial de la solicitud</h2>
    <ol v-if="events.length" class="rd-timeline">
      <li
        v-for="event in events"
        :key="event.id"
        data-testid="audit-item"
        :data-tone="auditEventTone(event)"
      >
        <b>{{ title(event) }}</b>
        <small>{{ byline(event) }}</small>
        <small v-if="auditEventDetail(event)">{{ auditEventDetail(event) }}</small>
      </li>
    </ol>
    <p v-else class="rd-sub">Todavía no hay eventos.</p>
    <UButton
      v-if="hasMore"
      data-testid="audit-more"
      class="rd-more"
      color="neutral"
      variant="ghost"
      size="sm"
      label="Ver más eventos"
      :loading="loadingMore"
      :disabled="loadingMore"
      @click="$emit('more')"
    />
  </section>
</template>
