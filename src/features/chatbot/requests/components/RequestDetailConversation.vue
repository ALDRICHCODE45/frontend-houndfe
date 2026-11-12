<script setup lang="ts">
/**
 * RequestDetailConversation — the mirrored WhatsApp chat of a request (handoff 18, read only).
 * Design 01-tabla-agrupada `convoHTML` and 04-movil-y-estados (same block in the single column).
 *
 * Data comes from `useRequestConversation` (latest page, «Cargar mensajes anteriores», polling for
 * newer messages); media from `useChatbotMedia` inside each bubble. States: loading, empty (only
 * for a conversation that really loaded empty), error with retry, and the limited note when the
 * role cannot read the chat (the composable then reads nothing, so an empty server page is never
 * mistaken for «sin mensajes»). The view only mounts it with `read:ChatbotConversation`.
 */
import { computed, onMounted, useId, useTemplateRef, watch } from 'vue'
import { useRequestConversation } from '../composables/useRequestConversation'
import { conversationErrorMessage } from '../utils/conversation-copy'
import { groupByDay } from '../utils/conversation-format'
import RequestConversationMessage from './RequestConversationMessage.vue'

const props = defineProps<{
  requestId: string
  /** IANA zone for times and day separators; defaults to the runtime zone. */
  timeZone?: string
  /** Injected "current" instant (tests); defaults to the real clock. */
  now?: Date
}>()

const headingId = useId()
const {
  messages,
  hasMoreBefore,
  isEnabled,
  isLoading,
  isError,
  error,
  isLoadingOlder,
  olderError,
  loadOlder,
  refetch,
} = useRequestConversation(() => props.requestId)

const days = computed(() => groupByDay(messages.value, { now: props.now, timeZone: props.timeZone }))
const hasMessages = computed(() => messages.value.length > 0)
const errorCopy = computed(() => conversationErrorMessage(error.value))

// ─── Scroll: open at the latest, follow new messages only near the bottom, keep the place on older ──
const log = useTemplateRef<HTMLElement>('log')
const NEAR_BOTTOM_PX = 80

function nearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX
}

let firstOpen = true
// Measured before the DOM updates, so «near the bottom» and the height are the old ones.
let before = { near: true, height: 0 }
watch(
  messages,
  () => {
    const el = log.value
    before = { near: el ? nearBottom(el) : true, height: el?.scrollHeight ?? 0 }
  },
  { flush: 'pre' },
)
watch(
  () => [messages.value[0]?.seq ?? null, messages.value[messages.value.length - 1]?.seq ?? null] as const,
  ([first, last], [prevFirst, prevLast]) => {
    const el = log.value
    if (!el || last === null) return
    if (prevFirst !== null && first !== null && first < prevFirst && last === prevLast) {
      el.scrollTop += el.scrollHeight - before.height
      return
    }
    if (firstOpen || before.near) el.scrollTop = el.scrollHeight
    firstOpen = false
  },
  { flush: 'post' },
)
onMounted(() => {
  const el = log.value
  if (el) {
    el.scrollTop = el.scrollHeight
    firstOpen = false
  }
})
</script>

<template>
  <section class="rd-panel rc" :aria-labelledby="headingId" data-testid="detail-conversation">
    <div class="rd-panel__head">
      <h2 :id="headingId">Conversación</h2>
    </div>

    <div v-if="!isEnabled" class="rd-alert rd-alert--info" role="note" data-testid="conversation-limited">
      <UIcon name="i-lucide-lock" aria-hidden="true" />
      <div>
        <strong>Vista limitada por tu rol</strong>
        Sin «Ver conversaciones del chatbot» no se muestran los mensajes.
      </div>
    </div>

    <div v-else-if="isLoading" class="rc-loading" data-testid="conversation-loading" aria-busy="true">
      <span class="rc-skeleton rc-skeleton--them" />
      <span class="rc-skeleton rc-skeleton--bot" />
      <span class="rc-skeleton rc-skeleton--them" />
      <span class="rc-sr">Cargando la conversación…</span>
    </div>

    <div v-else-if="isError" class="rd-alert rd-alert--warn" role="alert" data-testid="conversation-error">
      <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
      <div>
        <strong>No pudimos cargar la conversación</strong>
        {{ errorCopy }}
        <button type="button" class="rc-linkbtn" data-testid="conversation-retry" @click="refetch()">Reintentar</button>
      </div>
    </div>

    <div v-else-if="!hasMessages" class="rd-soon" data-testid="conversation-empty">
      <UIcon name="i-lucide-messages-square" aria-hidden="true" />
      <p><b>Todavía no hay mensajes</b></p>
      <p class="rd-sub">Cuando el cliente y el bot conversen, los mensajes aparecerán aquí.</p>
    </div>

    <template v-else>
      <div v-if="hasMoreBefore" class="rc-older">
        <button
          type="button"
          class="rc-older__btn"
          data-testid="conversation-older"
          :disabled="isLoadingOlder"
          :aria-busy="isLoadingOlder"
          @click="loadOlder()"
        >
          <UIcon :name="isLoadingOlder ? 'i-lucide-loader-circle' : 'i-lucide-chevrons-up'" aria-hidden="true" />
          {{ isLoadingOlder ? 'Cargando…' : 'Cargar mensajes anteriores' }}
        </button>
        <p v-if="olderError" class="rc-older__error" role="status" data-testid="conversation-older-error">
          No se pudieron cargar los mensajes anteriores. Inténtalo de nuevo.
        </p>
      </div>

      <div ref="log" class="rc-log" role="log" aria-label="Mensajes" tabindex="0">
        <template v-for="day in days" :key="day.key">
          <div class="rc-day" role="separator" data-testid="conversation-day">{{ day.label }}</div>
          <RequestConversationMessage
            v-for="message in day.messages"
            :key="message.seq"
            :message="message"
            :time-zone="timeZone"
          />
        </template>
      </div>
    </template>

    <p v-if="isEnabled" class="rd-help">
      <UIcon name="i-lucide-info" aria-hidden="true" />
      Aquí solo se lee la conversación. Responder desde el sistema llegará más adelante.
    </p>
  </section>
</template>
