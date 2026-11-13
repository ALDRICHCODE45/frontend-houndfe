<script setup lang="ts">
/**
 * RequestCommandRescheduleForm — the staff slot picker of a reschedule (handoff 21 §2–3). Radio
 * rows (never a native select or date input) of the blocks the backend lists, in the branch zone,
 * each noting the paid template when it falls outside the customer's free 24 h window.
 *
 * Before confirming it says whether the customer will be told (S19 Q9): from the picker's
 * `whatsappWindowClosesAt` — still in the future → «Se avisará…», already past → «no recibirá
 * aviso» — and never claims either when the window is unknown. The submit carries the block start
 * exactly as listed; the host builds the body and handles the answer.
 */
import { computed, ref, watch } from 'vue'
import type { ChatbotSchedulingSlots } from '../interfaces/chatbot-request.types'
import { CUSTOMER_WILL_BE_TOLD, CUSTOMER_WILL_NOT_BE_TOLD } from '../utils/command-copy'
import RequestCommandFooter from './RequestCommandFooter.vue'
import RequestCommandRadioGroup, { type RadioItem } from './RequestCommandRadioGroup.vue'

const props = defineProps<{
  /** The picker's answer; `null` while loading or when it failed. */
  slots: ChatbotSchedulingSlots | null
  loading?: boolean
  /** Copy of why the picker could not load (e.g. scheduling is off). */
  loadError?: string | null
  /** The time the request has now (ISO), shown so the move is clear. */
  currentScheduledFor?: string | null
  pending?: boolean
  serverErrors?: Record<string, string>
  /** Injected "current" instant (tests); defaults to the real clock. */
  now?: Date
}>()
const emit = defineEmits<{ submit: [scheduledFor: string]; back: []; reload: [] }>()

const chosen = ref('')
const submitted = ref(false)

const timeZone = computed(() => props.slots?.timeZone || undefined)

/** «sáb 14 nov 09:00» — always dated and zero-padded, so rows of different days never read the same. */
function slotLabel(iso: string): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('es-MX', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timeZone.value,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => (parts.find((p) => p.type === type)?.value ?? '').replace(/\.$/, '')
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('hour')}:${part('minute')}`
}

const items = computed<RadioItem[]>(() =>
  (props.slots?.slots ?? []).map((slot) => ({
    value: slot.startsAt,
    label: slotLabel(slot.startsAt),
    hint: slot.withinWindow ? undefined : 'Esta hora cuesta una plantilla de WhatsApp',
  })),
)

const current = computed(() => (props.currentScheduledFor ? slotLabel(props.currentScheduledFor) : null))

type Expected = 'true' | 'false' | 'unknown'
/** From the picker only: the answer's `customerNotice.expected` is the truth, this is the heads-up. */
const expected = computed<Expected>(() => {
  const closes = props.slots?.whatsappWindowClosesAt
  const at = closes ? new Date(closes).getTime() : Number.NaN
  if (Number.isNaN(at)) return 'unknown'
  return at > (props.now ?? new Date()).getTime() ? 'true' : 'false'
})
const noticeText = computed(() =>
  expected.value === 'true'
    ? CUSTOMER_WILL_BE_TOLD
    : expected.value === 'false'
      ? CUSTOMER_WILL_NOT_BE_TOLD
      : 'Avisaremos al cliente solo si su ventana de 24 h sigue abierta.',
)

// A swapped list (SLOT_UNAVAILABLE) may no longer hold the choice: ask again instead of sending it.
watch(items, (list) => {
  if (chosen.value && !list.some((item) => item.value === chosen.value)) chosen.value = ''
})

const error = computed(() => (submitted.value && chosen.value === '' ? 'Elige la nueva hora.' : props.serverErrors?.scheduledFor))
const unavailable = computed(() => props.loading || !!props.loadError || items.value.length === 0)

function submit(): void {
  submitted.value = true
  if (chosen.value === '') return
  emit('submit', chosen.value)
}
</script>

<template>
  <form class="rc-form" data-testid="reschedule-form" novalidate @submit.prevent="submit">
    <p class="rc-lead">Elige la nueva hora para atender esta conversación.</p>
    <p v-if="current" class="rc-help" data-testid="reschedule-current">Ahora: {{ current }}</p>

    <p v-if="loading" class="rc-help" role="status" data-testid="reschedule-loading">Cargando horarios…</p>
    <div v-else-if="loadError" class="rc-hint" role="alert" data-testid="reschedule-load-failed">
      {{ loadError }}
      <UButton data-testid="reschedule-reload" size="sm" color="neutral" variant="outline" label="Reintentar" @click="emit('reload')" />
    </div>
    <p v-else-if="items.length === 0" class="rc-hint" data-testid="reschedule-empty">
      No hay horarios disponibles en los próximos 14 días.
    </p>
    <template v-else>
      <RequestCommandRadioGroup v-model="chosen" :items="items" label="Nueva hora" :error="error" :disabled="pending" />
      <p class="rc-help" data-testid="reschedule-zone">Horas en {{ slots?.timeZone }}.</p>
      <p class="rc-hint" role="note" data-testid="reschedule-notice" :data-expected="expected">
        <UIcon name="i-lucide-info" aria-hidden="true" />
        <span>{{ noticeText }}</span>
      </p>
    </template>

    <RequestCommandFooter label="Reagendar" :pending="pending" :disabled="unavailable" @back="emit('back')" />
  </form>
</template>
