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
import { computed, onMounted, provide, ref, useId, useTemplateRef, watch } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { ATTENDEE_MEDIA_KEY } from '../composables/liveChatContext'
import { useLiveChat } from '../composables/useLiveChat'
import { useLiveClock } from '../composables/useLiveClock'
import { useRequestConversation } from '../composables/useRequestConversation'
import { useTemplateCost } from '../composables/useTemplateCost'
import type { ChatbotRequestAction, ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { conversationErrorMessage } from '../utils/conversation-copy'
import { groupByDay, momentLabel } from '../utils/conversation-format'
import { composerMode, isAttendee } from '../utils/live-session'
import RequestConversationMessage from './RequestConversationMessage.vue'
import RequestLiveBanners from './RequestLiveBanners.vue'
import RequestLiveBlocked from './RequestLiveBlocked.vue'
import RequestLiveComposer from './RequestLiveComposer.vue'
import RequestLiveStatus from './RequestLiveStatus.vue'
import RequestLiveTemplateSheet from './RequestLiveTemplateSheet.vue'
import '../styles/chatbot-live-chat.css'

const props = defineProps<{
  requestId: string
  /** IANA zone for times and day separators; defaults to the runtime zone. */
  timeZone?: string
  /** Injected "current" instant (tests); defaults to the real clock. */
  now?: Date
  /** The request: with a `liveSession` the block becomes the live chat (handoff 20). */
  detail?: ChatbotRequestDetail | null
  currentUserId?: string | null
  /** Below 768 px the live chat is a full-screen view opened from a card (design 04). */
  mobileOpen?: boolean
}>()
const emit = defineEmits<{
  /** Buttons that run a request action (the view hands it to the command host). */
  action: [action: ChatbotRequestAction]
  'update:mobileOpen': [value: boolean]
  /** The window the composer uses, so the rest of the page says the same. */
  'window-state': [value: { closed: boolean; closesAt: number | null }]
}>()

const auth = useAuthStore()
const session = computed(() => props.detail?.liveSession ?? null)
const isLive = computed(() => session.value !== null)
const sessionRunning = computed(
  () => session.value?.state === 'STARTING' || session.value?.state === 'ACTIVE' || session.value?.state === 'ENDING',
)
/** Handoff 20 §5: the assignee reads their own session even without `read:ChatbotConversation`. */
const attendee = computed(() => (props.detail ? isAttendee(props.detail, props.currentUserId) : false))
const scoped = computed(() => attendee.value && !auth.userCan('read', 'ChatbotConversation'))
provide(ATTENDEE_MEDIA_KEY, attendee)

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
} = useRequestConversation(() => props.requestId, { asAttendee: attendee, live: sessionRunning })

// ─── Live chat: outbox, window, template (only does anything with a live session) ───
const tick = useLiveClock(sessionRunning)
const clock = computed(() => props.now ?? tick.value)
const chat = useLiveChat({
  detail: () => props.detail ?? null,
  requestId: () => props.requestId,
  messages,
  now: clock,
  refreshThread: () => void refetch(),
})
const {
  draft,
  attachment,
  notice,
  displayMessages,
  retried,
  unsent,
  textLimit,
  overLimit,
  canSend,
  windowClosed,
  windowClosesAt,
  deferred,
  templateState,
  templateAvailable,
  templateSending,
} = chat
watch(
  [windowClosed, windowClosesAt],
  () => emit('window-state', { closed: windowClosed.value, closesAt: windowClosesAt.value }),
  { immediate: true },
)
const templateCost = useTemplateCost(() => props.detail?.templateCostText)
const templateOpen = ref(false)

const mode = computed(() =>
  props.detail ? composerMode({ detail: props.detail, currentUserId: props.currentUserId, windowClosed: windowClosed.value }) : 'none',
)
const holder = computed(() => props.detail?.assignee?.displayName ?? 'otra persona')
const lastCustomer = computed(() => [...displayMessages.value].reverse().find((m) => m.direction === 'IN') ?? null)
const lastCustomerLabel = computed(() =>
  momentLabel(lastCustomer.value?.providerTimestamp ?? lastCustomer.value?.createdAt ?? session.value?.lastCustomerMessageAt, {
    now: clock.value,
    timeZone: props.timeZone,
  }),
)
const noticeTone = computed(() => (notice.value?.tone === 'info' ? 'info' : 'warn'))
const unread = computed(() => props.detail?.unreadCustomerMessages ?? 0)

async function confirmTemplate(): Promise<void> {
  await chat.sendTemplate()
  templateOpen.value = false
}

const days = computed(() => groupByDay(displayMessages.value, { now: props.now, timeZone: props.timeZone }))
const hasMessages = computed(() => displayMessages.value.length > 0)
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
  displayMessages,
  () => {
    const el = log.value
    before = { near: el ? nearBottom(el) : true, height: el?.scrollHeight ?? 0 }
  },
  { flush: 'pre' },
)
watch(
  () =>
    [
      displayMessages.value[0]?.seq ?? null,
      displayMessages.value[displayMessages.value.length - 1]?.seq ?? null,
      displayMessages.value.length,
    ] as const,
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
  <section
    class="rd-panel rc"
    :class="{ 'rc--live': isLive, 'rc--open': isLive && mobileOpen, 'rc--blocked': isLive && mode === 'blocked' }"
    :aria-labelledby="headingId"
    data-testid="detail-conversation"
  >
    <header v-if="isLive && isEnabled" class="lc-mbar">
      <button type="button" class="lc-iconbtn" aria-label="Volver al detalle" data-testid="live-back" @click="emit('update:mobileOpen', false)">
        <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
      </button>
      <div class="lc-mbar__title" data-testid="live-mobile-title">
        <small>{{ detail?.folio }}</small>
        <b>{{ detail?.customer.displayName ?? 'Cliente' }}</b>
      </div>
    </header>

    <div class="rd-panel__head">
      <h2 :id="headingId">Conversación</h2>
      <RequestLiveStatus
        v-if="isLive && isEnabled && detail"
        class="lc-head-status"
        :detail="detail"
        :now="clock"
        :window-closed="windowClosed"
        :closes-at="windowClosesAt"
        :mine="attendee"
      />
    </div>

    <div v-if="isLive && isEnabled && detail" class="lc-card" data-testid="live-card">
      <p class="lc-card__title">Conversación en vivo</p>
      <RequestLiveStatus
        :detail="detail"
        :now="clock"
        :window-closed="windowClosed"
        :closes-at="windowClosesAt"
        :mine="attendee"
      />
      <p v-if="lastCustomer?.text" class="lc-card__preview">
        <b>Cliente:</b> {{ lastCustomer.text }}
        <small v-if="lastCustomerLabel">{{ lastCustomerLabel }}</small>
      </p>
      <span v-if="unread > 0" class="lc-badge lc-badge--info">{{ unread === 1 ? '1 mensaje nuevo' : `${unread} mensajes nuevos` }}</span>
      <button type="button" class="lc-card__open" data-testid="live-card-open" @click="emit('update:mobileOpen', true)">
        <UIcon name="i-lucide-message-square" aria-hidden="true" />Abrir conversación
      </button>
    </div>

    <RequestLiveBanners
      v-if="isLive && isEnabled && detail"
      :detail="detail"
      :now="clock"
      :window-closed="windowClosed"
      :closes-at="windowClosesAt"
      :deferred="deferred"
      :scoped="scoped"
      @action="emit('action', $event)"
    />

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
            :key="message.seq > 0 ? message.seq : message.id"
            :message="message"
            :time-zone="timeZone"
            :now="clock"
            :can-act="mode === 'composer'"
            :retried="retried.has(message.id)"
            @retry="chat.retry($event)"
          />
        </template>
      </div>
    </template>

    <div
      v-if="notice && isLive"
      class="rd-alert lc-notice"
      :class="`rd-alert--${noticeTone}`"
      :role="noticeTone === 'warn' ? 'alert' : 'status'"
      data-testid="live-notice"
    >
      <UIcon :name="noticeTone === 'warn' ? 'i-lucide-triangle-alert' : 'i-lucide-info'" aria-hidden="true" />
      <div>
        <strong>{{ notice.title }}</strong>
        {{ notice.detail }}
      </div>
      <button type="button" class="lc-iconbtn" aria-label="Cerrar aviso" data-testid="live-notice-close" @click="chat.dismissNotice()">
        <UIcon name="i-lucide-x" aria-hidden="true" />
      </button>
    </div>

    <template v-if="isEnabled && isLive && detail">
      <div
        v-for="item in unsent"
        :key="item.id"
        class="lc-note lc-unsent"
        role="status"
        data-testid="live-unsent"
      >
        <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
        <div class="lc-note__text">
          <strong>Texto no enviado</strong>
          <span data-testid="live-unsent-text">{{ item.text || item.attachmentName }}</span>
          <small v-if="item.attachmentName && item.text">Con el archivo {{ item.attachmentName }}</small>
        </div>
        <div class="lc-note__acts">
          <button type="button" class="rc-linkbtn" data-testid="live-unsent-use" @click="chat.useUnsent(item.id)">
            Usar este texto
          </button>
          <button type="button" class="rc-linkbtn" data-testid="live-unsent-discard" @click="chat.discardUnsent(item.id)">
            Descartar
          </button>
        </div>
      </div>
      <RequestLiveComposer
        v-if="mode === 'composer' || mode === 'connecting'"
        v-model="draft"
        :attachment="attachment"
        :limit="textLimit"
        :over-limit="overLimit"
        :can-send="canSend"
        :disabled="mode === 'connecting'"
        disabled-text="Conectando…"
        @send="chat.send()"
        @pick="chat.pickFile($event)"
        @clear-attachment="chat.clearAttachment()"
      />
      <RequestLiveBlocked
        v-else-if="mode === 'blocked'"
        :draft="draft"
        :last-customer-label="lastCustomerLabel"
        :template-state="templateState"
        :template-available="templateAvailable"
        :cost-text="templateCost.costText.value"
        :busy="templateSending"
        @template="templateOpen = true"
      />
      <div v-else class="lc-note" data-testid="live-note">
        <UIcon :name="mode === 'ended' ? 'i-lucide-circle-check' : 'i-lucide-lock'" aria-hidden="true" />
        <div class="lc-note__text">
          <template v-if="mode === 'ended'">
            <strong>La conversación terminó</strong>
            Ya no se pueden enviar mensajes. Si el cliente vuelve a escribir, lo atiende el bot.
          </template>
          <template v-else-if="mode === 'waiting'">
            <strong>Atiende la solicitud para escribir</strong>
            Nadie la tiene todavía.
          </template>
          <template v-else>
            <strong>Atiende {{ holder }}</strong>
            Solo quien la atiende puede escribirle al cliente. Tú puedes leer la conversación.
          </template>
        </div>
        <div v-if="mode === 'readonly'" class="lc-note__acts">
          <button
            v-if="detail.allowedActions.includes('REASSIGN')"
            type="button"
            class="lc-btn"
            data-testid="note-reassign"
            @click="emit('action', 'REASSIGN')"
          >
            <UIcon name="i-lucide-arrow-left-right" aria-hidden="true" />Reasignar…
          </button>
          <button
            v-if="detail.allowedActions.includes('FINISH')"
            type="button"
            class="lc-btn"
            data-testid="note-finish"
            @click="emit('action', 'FINISH')"
          >
            <UIcon name="i-lucide-flag" aria-hidden="true" />Finalizar en su lugar…
          </button>
        </div>
      </div>
    </template>

    <p v-if="isEnabled && mode === 'none'" class="rd-help">
      <UIcon name="i-lucide-info" aria-hidden="true" />
      Solo lectura: aquí ves lo que el cliente y el bot se escribieron.
    </p>

    <RequestLiveTemplateSheet
      v-if="isLive"
      v-model:open="templateOpen"
      :cost-text="templateCost.costText.value"
      :busy="templateSending"
      :retry="templateState === 'failed'"
      @confirm="confirmTemplate"
    />
  </section>
</template>
