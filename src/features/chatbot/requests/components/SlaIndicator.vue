<script setup lang="ts">
/**
 * SlaIndicator — the SLA traffic light of a request (design 01-tabla-agrupada `.sla`).
 *
 * It only renders what the backend decided: `slaLevel` (OK / HALF / ESCALATION / OVERDUE / null,
 * computed in business time), `slaPaused` + `slaResumesAt`, and `scheduledFor`. It never compares
 * deadlines or applies thresholds. The one clock it reads is `now`, to tell whether a scheduled
 * time is still ahead. Color is always accompanied by text.
 */
import { computed } from 'vue'
import type { ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { formatScheduledFor, formatWhen, SLA_LEVEL_LABELS } from '../utils/requestLabels'

type SlaRow = Pick<
  ChatbotRequestRow,
  'status' | 'slaLevel' | 'slaPaused' | 'slaResumesAt' | 'scheduledFor' | 'requiresTemplateAtStart'
>

const props = withDefaults(
  defineProps<{
    row: SlaRow
    /** Hide the second line (dense rows, mobile cards). */
    compact?: boolean
    /** Injected "current" instant (tests); defaults to the real clock. */
    now?: Date
    /** IANA zone for «mar 10:30» / «se reanuda …»; defaults to the runtime zone. */
    timeZone?: string
  }>(),
  { compact: false, now: undefined, timeZone: undefined },
)

type Tone = 'ok' | 'warn' | 'bad' | 'pause' | 'sched' | 'none' | 'closed'

interface View {
  tone: Tone
  icon: string
  title: string
  detail: string | null
}

const view = computed<View>(() => {
  const { row } = props
  const when = { now: props.now, timeZone: props.timeZone }
  const resumes = row.slaPaused ? formatWhen(row.slaResumesAt, when) : null
  const resumesLine = resumes ? `se reanuda ${resumes}` : null

  if (row.status === 'RESOLVED' || row.status === 'CANCELLED') {
    return { tone: 'closed', icon: 'i-lucide-minus', title: '—', detail: null }
  }

  if (row.slaLevel === 'OVERDUE') {
    return {
      tone: 'bad',
      icon: 'i-lucide-triangle-alert',
      title: SLA_LEVEL_LABELS.OVERDUE,
      detail: row.slaPaused ? `En pausa${resumesLine ? ` · ${resumesLine}` : ''}` : 'Sigue abierta',
    }
  }

  const scheduled = formatScheduledFor(row.scheduledFor, when)
  const scheduledAt = row.scheduledFor ? new Date(row.scheduledFor).getTime() : Number.NaN
  if (scheduled && scheduledAt > (props.now ?? new Date()).getTime()) {
    return {
      tone: 'sched',
      icon: 'i-lucide-calendar',
      title: `Agendada · ${scheduled}`,
      detail: row.requiresTemplateAtStart
        ? 'Fuera de la ventana de 24 h: se usa plantilla'
        : 'Dentro de la ventana gratis',
    }
  }

  if (row.slaPaused) {
    return { tone: 'pause', icon: 'i-lucide-pause', title: 'En pausa', detail: resumesLine }
  }

  switch (row.slaLevel) {
    case 'OK':
      return { tone: 'ok', icon: 'i-lucide-clock', title: SLA_LEVEL_LABELS.OK, detail: null }
    case 'HALF':
      return { tone: 'warn', icon: 'i-lucide-clock', title: SLA_LEVEL_LABELS.HALF, detail: null }
    case 'ESCALATION':
      return { tone: 'bad', icon: 'i-lucide-triangle-alert', title: SLA_LEVEL_LABELS.ESCALATION, detail: null }
    default:
      return { tone: 'none', icon: 'i-lucide-clock', title: 'Sin límite', detail: null }
  }
})

const ariaLabel = computed(() =>
  view.value.tone === 'closed'
    ? 'Sin tiempo límite'
    : `Tiempo: ${view.value.title}${view.value.detail ? `, ${view.value.detail}` : ''}`,
)
</script>

<template>
  <div
    class="chatbot-sla"
    data-testid="sla-indicator"
    :data-tone="view.tone"
    :data-level="row.slaLevel ?? undefined"
    role="img"
    :aria-label="ariaLabel"
  >
    <UIcon v-if="view.tone !== 'closed'" :name="view.icon" class="chatbot-sla__icon" aria-hidden="true" />
    <span class="chatbot-sla__text" aria-hidden="true">
      <b>{{ view.title }}</b>
      <small v-if="view.detail && !compact">{{ view.detail }}</small>
    </span>
  </div>
</template>

<style scoped>
.chatbot-sla {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  font-size: 0.8125rem;
  line-height: 1.35;
}

.chatbot-sla__icon {
  width: 16px;
  height: 16px;
  margin-top: 1px;
  flex-shrink: 0;
}

.chatbot-sla__text b {
  display: block;
  font-weight: 600;
}

.chatbot-sla__text small {
  display: block;
  font-size: 0.75rem;
  color: var(--hf-muted);
}

.chatbot-sla[data-tone='ok'] {
  color: var(--hf-success);
}

.chatbot-sla[data-tone='warn'] {
  color: var(--hf-warning);
}

.chatbot-sla[data-tone='bad'] {
  color: var(--hf-danger);
}

.chatbot-sla[data-tone='pause'],
.chatbot-sla[data-tone='none'],
.chatbot-sla[data-tone='closed'] {
  color: var(--hf-muted);
}

.chatbot-sla[data-tone='sched'] {
  color: var(--hf-active);
}
</style>
