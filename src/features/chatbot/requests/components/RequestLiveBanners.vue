<script setup lang="ts">
/**
 * RequestLiveBanners — what the live session says above the thread (handoff 20 §1, §5, §5b):
 * «Conectando…» with the elapsed time (no deadline: the contract gives none), the bot that did not
 * confirm, ending / ended with the complaint outcome, the idle customer (`FINISH_IDLE`: finish with
 * no extra confirmation), a window about to close, a deferred message and the attendee who only
 * sees their own session. Copy follows design 04. Buttons emit the action; the view runs it.
 */
import { computed } from 'vue'
import type { ChatbotRequestAction, ChatbotRequestDetail } from '../interfaces/chatbot-request.types'
import { elapsedLabel, silentMinutes } from '../utils/live-session'
import { COMPLAINT_OUTCOME_LABELS } from '../utils/requestLabels'
import { formatRemaining } from '../utils/live-window'

const props = defineProps<{
  detail: ChatbotRequestDetail
  now: Date
  windowClosed: boolean
  closesAt: number | null
  /** A staff message ended `DEFERRED` after the customer's last message. */
  deferred: boolean
  /** The attendee reads only their session (no `read:ChatbotConversation`). */
  scoped: boolean
}>()
const emit = defineEmits<{ action: [action: ChatbotRequestAction] }>()

const state = computed(() => props.detail.liveSession?.state ?? null)
const allowed = computed(() => props.detail.allowedActions)
const elapsed = computed(() => elapsedLabel(props.detail.liveSession?.lastStaffActivityAt, props.now))
const silent = computed(() => silentMinutes(props.detail.liveSession, props.now))
const remainingMs = computed(() => (props.closesAt === null ? null : props.closesAt - props.now.getTime()))
const windowSoon = computed(
  () =>
    state.value === 'ACTIVE' &&
    !props.windowClosed &&
    remainingMs.value !== null &&
    remainingMs.value > 0 &&
    remainingMs.value <= 120 * 60_000,
)
const idle = computed(
  () => state.value === 'ACTIVE' && !props.windowClosed && allowed.value.includes('FINISH_IDLE') && silent.value !== null,
)
const isComplaint = computed(() => props.detail.subtype === 'COMPLAINT')
const outcome = computed(() =>
  props.detail.complaintOutcome ? COMPLAINT_OUTCOME_LABELS[props.detail.complaintOutcome] : 'Sin clasificar (se cerró sola)',
)
</script>

<template>
  <div class="lc-banners">
    <div v-if="scoped" class="rd-alert rd-alert--info" role="note" data-testid="banner-scoped">
      <UIcon name="i-lucide-lock" aria-hidden="true" />
      <div>
        <strong>Solo ves los mensajes de tu sesión</strong>
        Empiezan cuando la tomaste. Para ver toda la conversación necesitas el permiso «Ver conversaciones del
        chatbot». Los avances de entrega pueden tardar unos segundos.
      </div>
    </div>

    <div v-if="state === 'STARTING'" class="rd-alert rd-alert--info" role="status" data-testid="banner-starting">
      <UIcon name="i-lucide-loader-circle" class="lc-spin" aria-hidden="true" />
      <div>
        <strong>Conectando…</strong>
        Esperando a que el bot confirme que se calló.
        <template v-if="elapsed"> Van <span class="lc-fig" data-testid="starting-elapsed">{{ elapsed }}</span>.</template>
        Si no confirma a tiempo, la solicitud vuelve a Nueva y no se envía nada al cliente.
      </div>
    </div>

    <div v-else-if="state === 'WAITING'" class="rd-alert rd-alert--warn" role="status" data-testid="banner-waiting">
      <UIcon name="i-lucide-triangle-alert" aria-hidden="true" />
      <div>
        <strong>El bot no confirmó a tiempo</strong>
        La solicitud volvió a Nueva y nadie la tiene. No se envió nada al cliente.
        <button
          v-if="allowed.includes('CLAIM')"
          type="button"
          class="rc-linkbtn"
          data-testid="banner-claim"
          @click="emit('action', 'CLAIM')"
        >
          Atender de nuevo
        </button>
      </div>
    </div>

    <div v-else-if="state === 'ENDING'" class="rd-alert rd-alert--info" role="status" data-testid="banner-ending">
      <UIcon name="i-lucide-loader-circle" class="lc-spin" aria-hidden="true" />
      <div>
        <strong>Terminando…</strong>
        El bot se despide del cliente y retoma la conversación. Puede tardar hasta 10 min; no hace falta esperar aquí.
      </div>
    </div>

    <div v-else-if="state === 'ENDED'" class="rd-alert rd-alert--success" role="status" data-testid="banner-ended">
      <UIcon name="i-lucide-circle-check" aria-hidden="true" />
      <div>
        <strong>Conversación terminada</strong>
        El cliente vuelve a hablar con el bot.
        <span v-if="isComplaint" class="lc-outcome">Clasificación: {{ outcome }}</span>
      </div>
    </div>

    <template v-else-if="state === 'ACTIVE'">
      <div v-if="deferred" class="rd-alert rd-alert--warn" role="status" data-testid="banner-deferred">
        <UIcon name="i-lucide-lock" aria-hidden="true" />
        <div>
          <strong>WhatsApp cerró la ventana</strong>
          Tu último mensaje quedó como «No enviado, ventana cerrada» y se reenvía solo si el cliente vuelve a escribir.
          Mientras tanto solo puedes enviar la plantilla.
        </div>
      </div>
      <div v-else-if="windowSoon" class="rd-alert rd-alert--warn" role="status" data-testid="banner-window-soon">
        <UIcon name="i-lucide-clock" aria-hidden="true" />
        <div>
          <strong>La ventana cierra en {{ formatRemaining(remainingMs ?? 0) }}</strong>
          Después solo podrás enviar la plantilla, que tiene costo. Si ya resolviste, puedes finalizar.
        </div>
      </div>
      <div v-if="idle" class="rd-alert rd-alert--info" role="status" data-testid="banner-idle">
        <UIcon name="i-lucide-clock" aria-hidden="true" />
        <div>
          <strong>El cliente no escribe desde hace {{ formatRemaining((silent ?? 0) * 60_000) }}</strong>
          Puedes finalizar ahora sin más pasos. Si pasan 2 h sin respuesta, la conversación se finaliza sola con una
          nota automática.
          <button type="button" class="rc-linkbtn" data-testid="banner-finish" @click="emit('action', 'FINISH_IDLE')">
            Finalizar conversación
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
