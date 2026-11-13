<script setup lang="ts">
/**
 * RequestDetailSchedule — the booking of a scheduled conversation (handoff 21 §6.1): «Agendada para
 * …» from `scheduledFor`, the «Plantilla de pago al iniciar» badge from `requiresTemplateAtStart`,
 * and the «Por reagendar» banner from `needsReschedule`, naming the cause from `needsRescheduleReason`. «Reagendar» only appears
 * when the server offers RESCHEDULE; it emits `action` like the action panel. Open requests only.
 */
import { computed } from 'vue'
import type { ChatbotRequestAction, ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { formatWhen, rescheduleReasonText } from '../utils/requestLabels'

const props = defineProps<{
  request: ChatbotRequestDetail
  timeZone?: string
  now?: Date
}>()
const emit = defineEmits<{ action: [action: ChatbotRequestAction] }>()

const open = computed(() => props.request.status === 'NEW' || props.request.status === 'IN_PROGRESS')
const when = computed(() => formatWhen(props.request.scheduledFor, { timeZone: props.timeZone, now: props.now }))
const visible = computed(() => open.value && when.value !== null)
const needsReschedule = computed(() => props.request.needsReschedule === true)
const reasonText = computed(() => rescheduleReasonText(props.request.needsRescheduleReason))
const canReschedule = computed(() => props.request.allowedActions.includes('RESCHEDULE'))
</script>

<template>
  <section v-if="visible" class="rd-schedule" data-testid="schedule-block" aria-label="Conversación agendada">
    <div class="rd-schedule__row">
      <span class="rd-tag" data-testid="schedule-chip">
        <UIcon name="i-lucide-calendar" aria-hidden="true" />
        Agendada para {{ when }}
      </span>
      <span v-if="request.requiresTemplateAtStart" class="rd-tag rd-tag--warn" data-testid="schedule-template">
        Plantilla de pago al iniciar
      </span>
    </div>

    <div v-if="needsReschedule" class="rd-alert rd-alert--warn" role="alert" data-testid="reschedule-banner">
      <UIcon name="i-lucide-calendar-clock" aria-hidden="true" />
      <div>
        <strong>Por reagendar</strong>
        <span data-testid="reschedule-reason">{{ reasonText }}</span>
        Nadie avisó al cliente: elige una nueva hora.
        <UButton
          v-if="canReschedule"
          data-testid="reschedule-banner-action"
          size="sm"
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar-clock"
          label="Reagendar"
          @click="emit('action', 'RESCHEDULE')"
        />
      </div>
    </div>
  </section>
</template>
