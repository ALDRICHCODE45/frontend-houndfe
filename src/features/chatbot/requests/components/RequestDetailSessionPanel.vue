<script setup lang="ts">
/**
 * RequestDetailSessionPanel — «Esta conversación» of the rail (design 01-chat-en-la-pagina,
 * `railHTML`): session state, who attends, when it started, the customer's last message, the
 * 24 h window and the automatic-finish note. It reads only what the detail already carries
 * (`liveSession`, `assignee`, the CLAIMED audit event, `whatsappWindowClosesAt`); a value the
 * detail does not have is a dash, never a guess. Hidden below 768 px, where the chat's own card
 * says the same (design 04).
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { sessionBadge, silentMinutes } from '../utils/live-session'
import { formatRemaining, windowClosesAt } from '../utils/live-window'
import { formatWhen } from '../utils/requestLabels'
import { useLiveClock } from '../composables/useLiveClock'

const props = defineProps<{
  detail: ChatbotRequestDetail
  currentUserId?: string | null
  /** IANA zone for «Empezó»; defaults to the runtime zone like the rest of the detail. */
  timeZone?: string
  /** Injected "current" instant (tests); defaults to the live clock. */
  now?: Date
  /** The window the composer uses (server overrides included); absent → computed from the detail alone. */
  window?: { closed: boolean; closesAt: number | null } | null
}>()

const headingId = useId()
const session = computed(() => props.detail.liveSession)
const running = computed(() => session.value?.state === 'STARTING' || session.value?.state === 'ACTIVE')
const tick = useLiveClock(running)
const clock = computed(() => props.now ?? tick.value)

const badge = computed(() => (session.value ? sessionBadge(session.value.state) : null))

const attendee = computed(() => {
  const who = props.detail.assignee
  if (!who) return 'Nadie todavía'
  return who.id === props.currentUserId ? `${who.displayName} (tú)` : who.displayName
})

/** The newest CLAIMED event of the detail (it carries the 20 latest events); never invented. */
const started = computed(() => {
  if (!props.detail.assignee) return '—'
  const claimed = props.detail.audit.find((event) => event.type === 'CLAIMED')
  return formatWhen(claimed?.createdAt ?? null, { timeZone: props.timeZone, now: clock.value }) ?? '—'
})

const silent = computed(() => silentMinutes(session.value, clock.value))
const idleOffered = computed(() => props.detail.allowedActions.includes('FINISH_IDLE'))
const customerLine = computed(() => {
  if (session.value?.state !== 'ACTIVE' || silent.value === null) return '—'
  return idleOffered.value
    ? `sin escribir desde hace ${formatRemaining(silent.value * 60_000)}`
    : `escribió hace ${formatRemaining(silent.value * 60_000)}`
})

const windowLine = computed(() => {
  if (props.window) {
    if (props.window.closed) return 'cerrada'
    const left = props.window.closesAt === null ? null : props.window.closesAt - clock.value.getTime()
    if (left === null) return '—'
    return left <= 0 ? 'abierta' : `cierra en ${formatRemaining(left)}`
  }
  const closes = windowClosesAt({
    messages: [],
    lastCustomerMessageAt: session.value?.lastCustomerMessageAt ?? null,
    rowClosesAt: props.detail.whatsappWindowClosesAt,
    forcedClosedAfterSeq: null,
  })
  if (closes === null) return '—'
  const left = closes - clock.value.getTime()
  return left <= 0 ? 'cerrada' : `cierra en ${formatRemaining(left)}`
})

const autoFinish = computed(() => session.value?.state === 'ACTIVE')
const customerName = computed(() => props.detail.customer.displayName ?? 'el cliente')
</script>

<template>
  <section
    v-if="session && badge"
    class="rd-panel rd-rail__session"
    :aria-labelledby="headingId"
    data-testid="session-panel"
  >
    <h2 :id="headingId">Esta conversación</h2>
    <dl class="rd-kv">
      <dt>Sesión</dt>
      <dd data-testid="session-state">
        <span class="lc-badge" :class="`lc-badge--${badge.tone}`" :data-state="session.state">
          <UIcon v-if="badge.busy" name="i-lucide-loader-circle" class="lc-spin" aria-hidden="true" />
          <span v-else class="lc-dot" aria-hidden="true" />
          {{ badge.label }}
        </span>
      </dd>
      <dt>Atiende</dt>
      <dd data-testid="session-attendee">{{ attendee }}</dd>
      <dt>Empezó</dt>
      <dd data-testid="session-started">{{ started }}</dd>
      <dt>Cliente</dt>
      <dd data-testid="session-customer">{{ customerLine }}</dd>
      <dt>Ventana</dt>
      <dd data-testid="session-window">{{ windowLine }}</dd>
    </dl>
    <p v-if="autoFinish" class="rd-help" data-testid="session-auto-finish">
      <UIcon name="i-lucide-info" aria-hidden="true" />
      Si {{ customerName }} no escribe en 2 h, la conversación se finaliza sola.
    </p>
  </section>
</template>
