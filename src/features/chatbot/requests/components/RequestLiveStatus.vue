<script setup lang="ts">
/**
 * RequestLiveStatus — the strip above the thread: session badge (handoff 20 §1), the 24 h window
 * chip and, for the attendee, when they last replied. Design 01-chat-en-la-pagina `chathead`.
 * The icon never goes alone: every state has its words.
 */
import { computed } from 'vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { sessionBadge } from '../utils/live-session'
import { formatRemaining } from '../utils/live-window'

const props = defineProps<{
  detail: ChatbotRequestDetail
  now: Date
  windowClosed: boolean
  /** Epoch ms when the window closes; `null` when unknown. */
  closesAt: number | null
  /** The viewer is the attendee. */
  mine: boolean
}>()

const session = computed(() => props.detail.liveSession)
const badge = computed(() => (session.value ? sessionBadge(session.value.state) : null))
const showWindow = computed(() => session.value?.state === 'STARTING' || session.value?.state === 'ACTIVE')
const remainingMs = computed(() => (props.closesAt === null ? null : props.closesAt - props.now.getTime()))
const windowChip = computed(() => {
  // The composer decides: closed there is closed here. Open there, a stale end in the past (the
  // server said WINDOW_OPEN) is not shown as «cerrada».
  if (props.windowClosed) return { text: 'Ventana de 24 h cerrada', tone: 'bad', icon: 'i-lucide-lock' }
  if (remainingMs.value === null || remainingMs.value <= 0) return null
  return {
    text: `Ventana de 24 h: cierra en ${formatRemaining(remainingMs.value)}`,
    tone: remainingMs.value <= 120 * 60_000 ? 'warn' : 'ok',
    icon: 'i-lucide-clock',
  }
})
const lastReply = computed(() => {
  const at = session.value?.lastStaffActivityAt ? Date.parse(session.value.lastStaffActivityAt) : Number.NaN
  if (!props.mine || session.value?.state !== 'ACTIVE' || !Number.isFinite(at)) return null
  return Math.max(1, Math.floor((props.now.getTime() - at) / 60_000))
})
</script>

<template>
  <div v-if="badge" class="lc-status" data-testid="live-status">
    <span
      class="lc-badge"
      :class="`lc-badge--${badge.tone}`"
      :data-state="session?.state"
      data-testid="session-badge"
    >
      <UIcon v-if="badge.busy" name="i-lucide-loader-circle" class="lc-spin" aria-hidden="true" />
      <span v-else class="lc-dot" aria-hidden="true" />
      {{ badge.label }}
    </span>
    <span
      v-if="showWindow && windowChip"
      class="lc-chip"
      :class="`lc-chip--${windowChip.tone}`"
      data-testid="window-chip"
    >
      <UIcon :name="windowChip.icon" aria-hidden="true" />{{ windowChip.text }}
    </span>
    <span v-if="lastReply !== null" class="lc-chip" data-testid="staff-activity">
      <UIcon name="i-lucide-message-square" aria-hidden="true" />Tu última respuesta: hace {{ lastReply }} min
    </span>
  </div>
</template>
