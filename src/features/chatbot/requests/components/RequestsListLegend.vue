<script setup lang="ts">
/**
 * RequestsListLegend — SLA traffic-light legend with the backend levels (OK, HALF, ESCALATION,
 * OVERDUE), paused and scheduled. The wording comes from `SLA_LEVEL_LABELS`; the design's
 * percentage thresholds are superseded by `slaLevel` and are not copied.
 */
import { SLA_LEVEL_LABELS } from '../utils/requestLabels'

const ITEMS = [
  { level: 'OK', tone: 'ok', icon: 'i-lucide-clock', label: SLA_LEVEL_LABELS.OK },
  { level: 'HALF', tone: 'warn', icon: 'i-lucide-clock', label: SLA_LEVEL_LABELS.HALF },
  { level: 'ESCALATION', tone: 'bad', icon: 'i-lucide-triangle-alert', label: SLA_LEVEL_LABELS.ESCALATION },
  { level: 'OVERDUE', tone: 'bad', icon: 'i-lucide-triangle-alert', label: SLA_LEVEL_LABELS.OVERDUE },
  { level: 'PAUSED', tone: 'pause', icon: 'i-lucide-pause', label: 'En pausa fuera de horario' },
  { level: 'SCHEDULED', tone: 'sched', icon: 'i-lucide-calendar', label: 'Agendada' },
] as const
</script>

<template>
  <div class="chatbot-legend" role="group" aria-label="Semáforo de tiempo">
    <span
      v-for="item in ITEMS"
      :key="item.level"
      class="chatbot-legend__item"
      data-testid="legend-item"
      :data-level="item.level"
      :data-tone="item.tone"
    >
      <UIcon :name="item.icon" class="chatbot-legend__icon" aria-hidden="true" />
      <b>{{ item.label }}</b>
    </span>
  </div>
</template>
