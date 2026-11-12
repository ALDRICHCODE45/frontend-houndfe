<script setup lang="ts">
/**
 * RequestStatusBadge — `displayStatus` of a request on the shared StatusBadge, with «por X»
 * while someone holds it (design 01-tabla-agrupada `statusHTML`). `EXPIRED` is an open request
 * with `overdueAt`: red and urgent, also said in words for assistive tech.
 */
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { DISPLAY_STATUS_LABELS } from '../utils/requestLabels'

const props = withDefaults(
  defineProps<{
    row: Pick<ChatbotRequestRow, 'status' | 'displayStatus' | 'assignee'>
    /** Append «por X» (open requests with an assignee). */
    withAssignee?: boolean
    /** The signed-in user: their own requests read «por ti». */
    currentUserId?: string | null
  }>(),
  { withAssignee: true, currentUserId: null },
)

const TONES = {
  NEW: 'warning',
  IN_PROGRESS: 'info',
  EXPIRED: 'danger',
  RESOLVED: 'success',
  CANCELLED: 'neutral',
} as const

const displayStatus = computed(() => props.row.displayStatus ?? props.row.status)
const isOpen = computed(() => props.row.status === 'NEW' || props.row.status === 'IN_PROGRESS')

const label = computed(() => {
  const base = DISPLAY_STATUS_LABELS[displayStatus.value] ?? DISPLAY_STATUS_LABELS[props.row.status]
  const assignee = props.row.assignee
  if (!props.withAssignee || !isOpen.value || !assignee) return base
  return `${base} · por ${assignee.id === props.currentUserId ? 'ti' : assignee.displayName}`
})
</script>

<template>
  <StatusBadge
    :label="label"
    :tone="TONES[displayStatus] ?? 'neutral'"
    :urgent="displayStatus === 'EXPIRED'"
  />
</template>
