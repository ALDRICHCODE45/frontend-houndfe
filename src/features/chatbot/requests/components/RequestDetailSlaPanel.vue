<script setup lang="ts">
/**
 * RequestDetailSlaPanel — «Tiempo límite» of the rail: the backend traffic light, the absolute
 * deadlines (already net of closed time), when it expired, and the pause («se reanuda …») — all
 * as the server sent them; nothing is computed here — plus who holds the request.
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { formatWhen } from '../utils/requestLabels'
import SlaIndicator from './SlaIndicator.vue'

const props = defineProps<{
  request: ChatbotRequestDetail
  currentUserId?: string | null
  timeZone?: string
  now?: Date
}>()

const headingId = useId()
const when = (iso: string | null) => formatWhen(iso, { timeZone: props.timeZone, now: props.now })

const open = computed(() => props.request.status === 'NEW' || props.request.status === 'IN_PROGRESS')
const claimDeadline = computed(() => (props.request.status === 'NEW' ? when(props.request.claimDeadlineAt) : null))
const resolveDeadline = computed(() => when(props.request.resolveDeadlineAt))
const overdueAt = computed(() => (open.value ? when(props.request.overdueAt) : null))
const assignee = computed(() => {
  const who = props.request.assignee
  if (!who) return 'Sin responsable'
  return who.id === props.currentUserId ? 'La atiendes tú' : `La atiende ${who.displayName}`
})
</script>

<template>
  <section class="rd-panel" :aria-labelledby="headingId" data-testid="sla-panel">
    <h2 :id="headingId">Tiempo límite</h2>

    <p v-if="!open" class="rd-sub">La solicitud ya se cerró.</p>
    <template v-else>
      <div class="rd-slabox">
        <SlaIndicator :row="request" :now="now" :time-zone="timeZone" />
      </div>
      <dl v-if="claimDeadline || resolveDeadline" class="rd-kv">
        <template v-if="claimDeadline">
          <dt>Para tomarla</dt>
          <dd data-testid="deadline-claim">{{ claimDeadline }}</dd>
        </template>
        <template v-if="resolveDeadline">
          <dt>Para resolverla</dt>
          <dd data-testid="deadline-resolve">{{ resolveDeadline }}</dd>
        </template>
      </dl>
      <p v-if="overdueAt" class="rd-help" data-testid="overdue-note">
        Venció {{ overdueAt }}. Sigue abierta y se puede responder.
      </p>
      <p v-if="request.slaPaused" class="rd-help" data-testid="pause-note">
        <UIcon name="i-lucide-moon" aria-hidden="true" />
        Fuera de horario de atención: el tiempo está en pausa.
      </p>
      <p class="rd-assignee" data-testid="assignee">{{ assignee }}</p>
    </template>
  </section>
</template>
