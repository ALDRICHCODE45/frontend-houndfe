<script setup lang="ts">
/**
 * RequestDetailActionPanel — «Qué hacer». It renders what the server decided and nothing else:
 * every `allowedActions` entry is an enabled button, every `deniedActions` entry a disabled
 * button with its reason (the codes of handoff 14 §14.4, via `deniedActionReason`). It never
 * checks permissions itself. Clicking an enabled button emits `action`; the view (unit 4) opens
 * the form or sends the command.
 *
 * `variant="bar"` is the mobile footer: the primary action plus «Más acciones» for the rest.
 */
import { computed, ref, useId } from 'vue'
import type {
  ChatbotRequestAction,
  ChatbotRequestDeniedAction,
  ChatbotRequestPerson,
  ChatbotRequestStatus,
} from '../interfaces/chatbot-request.types'
import { deniedActionReason } from '../utils/requestErrors'
import { ACTION_ICONS, ACTION_LABELS } from '../utils/detail-format'

interface ActionItem {
  action: ChatbotRequestAction
  label: string
  icon: string
  primary: boolean
  /** Present on a denied action: why it is disabled. */
  reason: string | null
}

const props = withDefaults(
  defineProps<{
    allowed: ChatbotRequestAction[]
    denied: ChatbotRequestDeniedAction[]
    assignee: ChatbotRequestPerson | null
    status: ChatbotRequestStatus
    /** The `version` the actions apply to (shown, and sent as `expectedVersion` in unit 4). */
    version: number
    currentUserId?: string | null
    variant?: 'panel' | 'bar'
    /** The action being sent: every button waits, and that one shows it is working. */
    pendingAction?: ChatbotRequestAction | null
  }>(),
  { currentUserId: null, variant: 'panel', pendingAction: null },
)

const emit = defineEmits<{ action: [action: ChatbotRequestAction] }>()

const uid = useId()
const moreOpen = ref(false)

const isBar = computed(() => props.variant === 'bar')
const closed = computed(() => props.status === 'RESOLVED' || props.status === 'CANCELLED')

/**
 * What this version of the FE handles. Anything else the server lists (RESCHEDULE or a later
 * action) is not rendered: a button with no handler would be a blank, enabled dead end.
 * SEND_MESSAGE and SEND_TEMPLATE belong to the live chat: the composer (and the blocked composer's
 * «Enviar plantilla», with its cost) is inside the conversation block, so «Qué hacer» never lists
 * them. Only the mobile bar uses SEND_MESSAGE, as «Abrir conversación» (the chat is full screen).
 */
const HANDLED_ACTIONS: ReadonlySet<string> = new Set<ChatbotRequestAction>([
  'CLAIM',
  'RELEASE',
  'REASSIGN',
  'RESOLVE',
  'REPLY',
  'MERGE',
  'LINK_CUSTOMER',
  'CANCEL',
  'FINISH',
  'FINISH_IDLE',
])

const handledAllowed = computed(() => {
  // FINISH and FINISH_IDLE open the same form: one «Finalizar» button, FINISH wins.
  const finishToo = props.allowed.includes('FINISH')
  return props.allowed.filter(
    (action) =>
      (HANDLED_ACTIONS.has(action) || (isBar.value && action === 'SEND_MESSAGE')) &&
      !(action === 'FINISH_IDLE' && finishToo),
  )
})
const handledDenied = computed(() => props.denied.filter(({ action }) => HANDLED_ACTIONS.has(action)))

// A clarification is answered with REPLY (also on a NEW one: replying claims and resolves in one step).
const primary = computed<ChatbotRequestAction | null>(() =>
  handledAllowed.value.includes('SEND_MESSAGE')
    ? 'SEND_MESSAGE'
    : handledAllowed.value.includes('REPLY')
    ? 'REPLY'
    : handledAllowed.value.includes('CLAIM')
      ? 'CLAIM'
      : handledAllowed.value.includes('RESOLVE')
        ? 'RESOLVE'
        : null,
)

const items = computed<ActionItem[]>(() => {
  const claimToo = handledAllowed.value.includes('CLAIM')
  const allowedItems = handledAllowed.value.map<ActionItem>((action) => ({
    action,
    label:
      action === 'RESOLVE' && claimToo
        ? 'Resolver sin tomarla…'
        : action === 'SEND_MESSAGE'
          ? 'Abrir conversación'
          : ACTION_LABELS[action],
    icon: action === 'SEND_MESSAGE' ? 'i-lucide-message-square' : ACTION_ICONS[action],
    primary: action === primary.value,
    reason: null,
  }))
  // The primary first; the rest keep the contract order.
  allowedItems.sort((a, b) => Number(b.primary) - Number(a.primary))
  const deniedItems = handledDenied.value.map<ActionItem>(({ action, code }) => ({
    action,
    label: ACTION_LABELS[action],
    icon: ACTION_ICONS[action],
    primary: false,
    reason: deniedActionReason(code, props.assignee),
  }))
  return [...allowedItems, ...deniedItems]
})

const primaryItem = computed(() => items.value.find((item) => item.primary) ?? null)
const rest = computed(() => items.value.filter((item) => !item.primary))
const listItems = computed(() => (isBar.value ? (moreOpen.value ? rest.value : []) : items.value))
const barVisible = computed(() => !closed.value && (primaryItem.value !== null || rest.value.length > 0))
const showContainer = computed(() => (isBar.value ? barVisible.value : true))

const holder = computed(() =>
  props.assignee && props.assignee.id !== props.currentUserId ? props.assignee.displayName : null,
)

function reasonId(action: ChatbotRequestAction): string {
  return `${uid}-denied-${action}`
}

/** FINISH and FINISH_IDLE are one command: either button shows it working. */
function isWorking(action: ChatbotRequestAction): boolean {
  const pending = props.pendingAction
  if (pending === null) return false
  const finish = (value: ChatbotRequestAction) => value === 'FINISH' || value === 'FINISH_IDLE'
  return pending === action || (finish(pending) && finish(action))
}

function trigger(item: ActionItem): void {
  if (item.reason !== null || props.pendingAction !== null) return
  moreOpen.value = false
  emit('action', item.action)
}
</script>

<template>
  <div
    v-if="showContainer"
    :class="isBar ? 'rd-bar' : 'rd-actions-panel'"
    :data-testid="isBar ? 'mobile-action-bar' : 'action-panel'"
  >
    <div v-if="!isBar && closed" class="rd-alert rd-alert--info" role="note" data-testid="closed-actions">
      <UIcon :name="status === 'RESOLVED' ? 'i-lucide-circle-check' : 'i-lucide-ban'" aria-hidden="true" />
      <div>
        <strong>{{ status === 'RESOLVED' ? 'Solicitud resuelta' : 'Solicitud cancelada' }}</strong>
        Ya no admite acciones. El historial muestra qué pasó.
      </div>
    </div>

    <div v-else-if="!isBar && items.length === 0" class="rd-alert rd-alert--info" role="note" data-testid="no-actions">
      <UIcon name="i-lucide-lock" aria-hidden="true" />
      <div>
        <strong>{{ holder ? `La está atendiendo ${holder}` : 'Solo puedes verla' }}</strong>
        {{
          assignee
            ? 'Puedes leerla, pero no cambiarla.'
            : 'Tu rol no tiene acciones disponibles sobre esta solicitud.'
        }}
      </div>
    </div>

    <div v-if="listItems.length" :class="isBar ? 'rd-bar__menu' : 'rd-actions'">
      <div v-for="item in listItems" :key="item.action" class="rd-action">
        <UButton
          :data-testid="`action-${item.action}`"
          :label="item.label"
          :icon="item.icon"
          :color="item.action === 'CANCEL' ? 'error' : item.primary ? 'primary' : 'neutral'"
          :variant="item.primary ? 'solid' : 'outline'"
          :disabled="item.reason !== null || pendingAction !== null"
          :loading="isWorking(item.action)"
          :aria-describedby="item.reason !== null ? reasonId(item.action) : undefined"
          block
          @click="trigger(item)"
        />
        <p
          v-if="item.reason !== null"
          :id="reasonId(item.action)"
          class="rd-help"
          :data-testid="`denied-reason-${item.action}`"
        >
          {{ item.reason }}
        </p>
      </div>
    </div>

    <div v-if="isBar" class="rd-bar__buttons" :class="{ 'rd-bar__buttons--one': !primaryItem || rest.length === 0 }">
      <UButton
        v-if="rest.length > 0"
        data-testid="bar-more"
        color="neutral"
        variant="outline"
        :icon="primaryItem ? 'i-lucide-ellipsis' : undefined"
        :label="primaryItem ? undefined : `Acciones (${rest.length})`"
        :aria-label="primaryItem ? 'Más acciones' : undefined"
        :aria-expanded="moreOpen"
        :disabled="pendingAction !== null"
        @click="moreOpen = !moreOpen"
      />
      <UButton
        v-if="primaryItem"
        data-testid="bar-primary"
        color="primary"
        :disabled="pendingAction !== null"
        :loading="isWorking(primaryItem.action)"
        :icon="primaryItem.icon"
        :label="primaryItem.label"
        @click="trigger(primaryItem)"
      />
    </div>

    <p v-if="!isBar && !closed" class="rd-help">Versión {{ version }}</p>
  </div>
</template>
