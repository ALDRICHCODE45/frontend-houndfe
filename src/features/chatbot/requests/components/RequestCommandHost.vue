<script setup lang="ts">
/**
 * RequestCommandHost — runs the staff commands of one request (T2.U4).
 *
 * The detail view calls `start(action)` when the action panel emits. CLAIM and RELEASE are sent at
 * once; RESOLVE, REPLY, FINISH, CANCEL, REASSIGN, RESCHEDULE, MERGE and LINK_CUSTOMER open their form in a slideover (desktop)
 * or bottom sheet (mobile). Bodies are built from the form answers and the detail's `version`; the
 * idempotency, in-flight guard and invalidation live in `useRequestCommand`.
 *
 * Failures: typed conflicts show a ConflictNotice (in the rail, or inside the open form so what the
 * user typed stays); 400/422 land under their field; a ZONE_SET_CHANGED keeps the form open with
 * the new impact and asks for a new confirmation. Success: toast and the detail refetches.
 */
import { computed, ref, watch } from 'vue'
import type {
  ChatbotRequestAction,
  ChatbotRequestCommandResponse,
  ChatbotRequestDetail,
  ChatbotRequestStaffCancelReason,
  ChatbotRequestZoneImpact,
} from '../interfaces/chatbot-request.types'
import { useAssignableUsers } from '../composables/useAssignableUsers'
import { useMergeCandidates } from '../composables/useMergeCandidates'
import { useRequestCommand, type RequestCommandOutcome } from '../composables/useRequestCommand'
import { useSchedulingSlots } from '../composables/useSchedulingSlots'
import { useZoneImpact } from '../composables/useZoneImpact'
import {
  commandFieldErrors,
  commandNotice,
  commandSuccessToast,
  type CommandNoticeAction,
  type CommandToastContext,
} from '../utils/command-copy'
import {
  buildCancelBody,
  buildFinishBody,
  buildLinkBody,
  buildMergeBody,
  buildReassignBody,
  buildReplyBody,
  buildRescheduleBody,
  buildResolveBody,
  type CancelDraft,
  type FinishDraft,
  type ReassignDraft,
  type ReplyDraft,
  type ResolveDraft,
} from '../utils/command-forms'
import { SUBTYPE_LABELS } from '../utils/requestLabels'
import RequestCommandCancelForm from './RequestCommandCancelForm.vue'
import RequestCommandFinishForm from './RequestCommandFinishForm.vue'
import RequestCommandNotice from './RequestCommandNotice.vue'
import RequestCommandPickForm from './RequestCommandPickForm.vue'
import RequestCommandReassignForm from './RequestCommandReassignForm.vue'
import RequestCommandReplyForm from './RequestCommandReplyForm.vue'
import RequestCommandRescheduleForm from './RequestCommandRescheduleForm.vue'
import RequestCommandResolveForm from './RequestCommandResolveForm.vue'
import RequestCommandSheet from './RequestCommandSheet.vue'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

type FormAction = Extract<
  ChatbotRequestAction,
  'RESOLVE' | 'REPLY' | 'FINISH' | 'CANCEL' | 'REASSIGN' | 'RESCHEDULE' | 'MERGE' | 'LINK_CUSTOMER'
>
const FORM_ACTIONS: ReadonlySet<ChatbotRequestAction> = new Set<ChatbotRequestAction>([
  'RESOLVE',
  'REPLY',
  'FINISH',
  'FINISH_IDLE',
  'CANCEL',
  'REASSIGN',
  'RESCHEDULE',
  'MERGE',
  'LINK_CUSTOMER',
])

/** After these answers the request moved under the open sheet: close it, the notice shows in the rail (handoff 21 §3). */
const CLOSES_RESCHEDULE: ReadonlySet<string> = new Set([
  'VERSION_CONFLICT',
  'RESCHEDULE_NOT_ALLOWED',
  'REQUEST_CLOSED',
  'NOT_SCHEDULED',
])

const props = defineProps<{ detail: ChatbotRequestDetail }>()
const emit = defineEmits<{
  /** «Actualizar»: the view refetches the detail. */
  refresh: []
  'update:pendingAction': [action: ChatbotRequestAction | null]
}>()

const toast = useToast()
const command = useRequestCommand()

const openForm = ref<FormAction | null>(null)
const sheetOpen = computed(() => openForm.value !== null)
const lastAction = ref<ChatbotRequestAction | null>(null)
const pendingAction = computed(() => (command.isPending.value ? lastAction.value : null))
watch(pendingAction, (action) => emit('update:pendingAction', action))

/** The last send, kept so «Reintentar» resends the same body under the same key. */
let lastRun: (() => Promise<void>) | null = null

// ─── Failure state ────────────────────────────────────────────────────────────
const notice = computed(() =>
  command.error.value ? commandNotice(command.error.value, lastAction.value) : null,
)
const fieldErrors = computed(() => (command.error.value ? commandFieldErrors(command.error.value) : {}))
/** Same notice, without the button the form itself plays (the submit becomes the new confirmation). */
const noticeActions = computed(() => notice.value?.actions.filter((action) => action !== 'reconfirm') ?? [])

// ─── Pickers: each read is gated by its own permission inside its composable ──
const isZone = computed(() => props.detail.subtype === 'DELIVERY_ZONE')
const zoneOpen = computed(() => openForm.value === 'RESOLVE' && isZone.value)
const zoneQuery = useZoneImpact(() => props.detail.id, { enabled: zoneOpen })
const changedImpact = ref<ChatbotRequestZoneImpact | null>(null)
/** The newest word of the server wins: the 409's, then the fresh read, then the detail's. */
const impact = computed<ChatbotRequestZoneImpact | null>(
  () => changedImpact.value ?? zoneQuery.impact.value ?? props.detail.zoneImpact ?? null,
)

const scheduling = useSchedulingSlots(() => props.detail.id, { enabled: () => openForm.value === 'RESCHEDULE' })

const assignable = useAssignableUsers({ enabled: () => openForm.value === 'REASSIGN' })
const mergeCandidates = useMergeCandidates(() => props.detail.id, { enabled: () => openForm.value === 'MERGE' })

const mergeItems = computed(() =>
  mergeCandidates.candidates.value.map((row) => ({
    value: row.id,
    label: `${row.folio} · ${row.summary}`,
    hint: `${row.assignee?.displayName ?? 'Sin responsable'} · misma conversación`,
  })),
)
const linkItems = computed(() =>
  props.detail.customer.candidates.map((candidate) => ({
    value: candidate.id,
    label: candidate.displayName ?? 'Sin nombre',
    hint: [
      candidate.phone,
      candidate.isTrusted ? 'De confianza' : null,
      candidate.lastOrderAt ? 'con pedidos' : 'sin pedidos',
    ]
      .filter(Boolean)
      .join(' · '),
  })),
)
const heldByOther = computed(() => !!props.detail.assignee)

// ─── Sending ──────────────────────────────────────────────────────────────────
function closeSheet(): void {
  openForm.value = null
  changedImpact.value = null
}

async function execute(
  action: ChatbotRequestAction,
  send: () => Promise<RequestCommandOutcome>,
  toastContext: (response: ChatbotRequestCommandResponse) => CommandToastContext,
): Promise<void> {
  lastAction.value = action
  lastRun = () => execute(action, send, toastContext)
  const outcome = await send()
  if (outcome.status === 'ignored') return
  if (outcome.status === 'done') {
    lastRun = null
    const done = commandSuccessToast(action, toastContext(outcome.response))
    toast.add({ ...done, color: done.color ?? 'success' })
    closeSheet()
    return
  }
  if (action === 'RESCHEDULE') {
    const { code, slotsUpdate } = outcome.error
    // Nothing changed and the 409 carries the next free blocks: swap them in and let the attendee choose again.
    if (code === 'SLOT_UNAVAILABLE' && slotsUpdate) scheduling.replaceSlots(slotsUpdate)
    else if (code && CLOSES_RESCHEDULE.has(code)) closeSheet()
  }
  if (outcome.error.code === 'ZONE_SET_CHANGED' && outcome.error.zoneImpact) {
    changedImpact.value = outcome.error.zoneImpact
  }
}

const folio = computed(() => props.detail.folio)
const id = computed(() => props.detail.id)

function start(action: ChatbotRequestAction): void {
  command.clearError()
  if (FORM_ACTIONS.has(action)) {
    changedImpact.value = null
    // FINISH and FINISH_IDLE are one form: the idle line comes from what the server offers.
    openForm.value = action === 'FINISH_IDLE' ? 'FINISH' : (action as FormAction)
    return
  }
  const body = { expectedVersion: props.detail.version }
  if (action === 'CLAIM') {
    void execute('CLAIM', () => command.claim(id.value, body), () => ({ folio: folio.value }))
  } else if (action === 'RELEASE') {
    void execute('RELEASE', () => command.release(id.value, body), () => ({ folio: folio.value }))
  }
}

function onCancel(draft: CancelDraft): void {
  const body = buildCancelBody(draft, props.detail.version)
  void execute('CANCEL', () => command.cancel(id.value, body), () => ({
    folio: folio.value,
    reason: draft.reason as ChatbotRequestStaffCancelReason,
    customerNote: body.customerNote,
  }))
}

function onReassign(draft: ReassignDraft): void {
  const body = buildReassignBody(draft, props.detail.version)
  const name = assignable.users.value.find((user) => user.id === draft.toUserId)?.displayName
  void execute('REASSIGN', () => command.reassign(id.value, body), () => ({ folio: folio.value, assignee: name }))
}

function onReschedule(scheduledFor: string): void {
  const body = buildRescheduleBody(scheduledFor, props.detail.version)
  void execute('RESCHEDULE', () => command.reschedule(id.value, body), (response) => ({
    folio: folio.value,
    scheduledFor,
    timeZone: scheduling.data.value?.timeZone || undefined,
    customerNoticeExpected: response.customerNotice?.expected ?? response.request.customerNotice?.expected,
  }))
}

function onReply(draft: ReplyDraft): void {
  const body = buildReplyBody(draft, props.detail.version)
  void execute('REPLY', () => command.reply(id.value, body), () => ({ folio: folio.value }))
}

function onFinish(draft: FinishDraft): void {
  const body = buildFinishBody(props.detail.subtype, draft, props.detail.version)
  if (!body) return
  void execute('FINISH', () => command.finish(id.value, body), () => ({ folio: folio.value }))
}

function onResolve(draft: ResolveDraft): void {
  const sentImpact = impact.value
  const body = buildResolveBody(
    props.detail.subtype,
    draft,
    props.detail.version,
    isZone.value ? sentImpact?.setVersion : undefined,
  )
  if (!body) return
  void execute('RESOLVE', () => command.resolve(id.value, body), () => ({
    folio: folio.value,
    siblings: isZone.value && sentImpact ? Math.max(sentImpact.requests - 1, 0) : 0,
  }))
}

function onMerge(targetId: string): void {
  const target = mergeCandidates.candidates.value.find((row) => row.id === targetId)
  if (!target) return
  const body = buildMergeBody(target, props.detail.version)
  void execute('MERGE', () => command.merge(id.value, body), () => ({ folio: folio.value, intoFolio: target.folio }))
}

function onLink(customerId: string): void {
  const body = buildLinkBody(customerId, props.detail.version)
  const name = props.detail.customer.candidates.find((candidate) => candidate.id === customerId)?.displayName
  void execute('LINK_CUSTOMER', () => command.linkCustomer(id.value, body), () => ({
    folio: folio.value,
    customer: name ?? undefined,
  }))
}

function onNoticeAction(action: CommandNoticeAction): void {
  if (action === 'retry') {
    void lastRun?.()
    return
  }
  command.clearError()
  if (action === 'refresh') emit('refresh')
}

function onSheetOpen(open: boolean): void {
  if (!open) closeSheet()
}

// The form of an action the server no longer allows (after a refetch) has nothing to submit.
watch(
  () => props.detail.allowedActions,
  (allowed) => {
    if (!openForm.value) return
    const stillOffered =
      openForm.value === 'FINISH'
        ? allowed.includes('FINISH') || allowed.includes('FINISH_IDLE')
        : allowed.includes(openForm.value)
    if (!stillOffered) closeSheet()
  },
)

const SHEET_TITLES: Record<FormAction, string> = {
  RESOLVE: 'Resolver',
  REPLY: 'Responder al cliente',
  FINISH: 'Finalizar conversación',
  CANCEL: 'Cancelar solicitud',
  REASSIGN: 'Reasignar',
  RESCHEDULE: 'Reagendar',
  MERGE: 'Unir con otra solicitud',
  LINK_CUSTOMER: 'Vincular cliente',
}
const sheetTitle = computed(() =>
  openForm.value === 'RESOLVE'
    ? `Resolver · ${SUBTYPE_LABELS[props.detail.subtype]}`
    : openForm.value
      ? SHEET_TITLES[openForm.value]
      : '',
)
const sheetDescription = computed(() =>
  openForm.value === 'MERGE'
    ? `Esta solicitud (${folio.value}) desaparece y sigue la que elijas. El bot lo sabe.`
    : openForm.value === 'LINK_CUSTOMER'
      ? 'Elige el cliente que tiene este teléfono.'
      : `Solicitud ${folio.value}`,
)

const decisionAmount = computed(() =>
  props.detail.decision?.subtype === 'TRANSFER_RECEIPT' ? props.detail.decision.declaredAmountCents : null,
)
const zipCode = computed(() => (props.detail.decision?.subtype === 'DELIVERY_ZONE' ? props.detail.decision.zipCode : ''))

defineExpose({ start, pendingAction })
</script>

<template>
  <div class="rc-host" data-testid="command-host">
    <RequestCommandNotice v-if="notice && !sheetOpen" :notice="notice" :actions="noticeActions" @action="onNoticeAction" />

    <RequestCommandSheet :open="sheetOpen" :title="sheetTitle" :description="sheetDescription" @update:open="onSheetOpen">
      <RequestCommandNotice v-if="notice" :notice="notice" :actions="noticeActions" @action="onNoticeAction" />

      <RequestCommandCancelForm
        v-if="openForm === 'CANCEL'"
        :pending="command.isPending.value"
        :server-errors="fieldErrors"
        @submit="onCancel"
        @back="closeSheet"
      />

      <RequestCommandReassignForm
        v-else-if="openForm === 'REASSIGN'"
        :users="assignable.users.value"
        :loading="assignable.isLoading.value"
        :load-failed="assignable.isError.value"
        :assignee-id="detail.assignee?.id ?? null"
        :pending="command.isPending.value"
        :server-errors="fieldErrors"
        @submit="onReassign"
        @back="closeSheet"
        @reload="assignable.refetch()"
      />

      <RequestCommandRescheduleForm
        v-else-if="openForm === 'RESCHEDULE'"
        :slots="scheduling.data.value"
        :loading="scheduling.isLoading.value"
        :load-error="scheduling.errorMessage.value"
        :current-scheduled-for="detail.scheduledFor"
        :pending="command.isPending.value"
        :server-errors="fieldErrors"
        @submit="onReschedule"
        @back="closeSheet"
        @reload="scheduling.refetch()"
      />

      <RequestCommandReplyForm
        v-else-if="openForm === 'REPLY'"
        :claims-on-reply="detail.status === 'NEW'"
        :pending="command.isPending.value"
        :server-errors="fieldErrors"
        @submit="onReply"
        @back="closeSheet"
      />

      <RequestCommandFinishForm
        v-else-if="openForm === 'FINISH'"
        :subtype="detail.subtype"
        :idle="detail.allowedActions.includes('FINISH_IDLE')"
        :pending="command.isPending.value"
        :server-errors="fieldErrors"
        @submit="onFinish"
        @back="closeSheet"
      />

      <RequestCommandResolveForm
        v-else-if="openForm === 'RESOLVE'"
        :subtype="detail.subtype"
        :claims-on-resolve="detail.status === 'NEW'"
        :zip-code="zipCode"
        :declared-amount-cents="decisionAmount"
        :impact="impact"
        :impact-loading="zoneQuery.isLoading.value"
        :impact-failed="zoneQuery.isError.value"
        :reconfirm="changedImpact !== null"
        :pending="command.isPending.value"
        :server-errors="fieldErrors"
        @submit="onResolve"
        @back="closeSheet"
        @reload-impact="zoneQuery.refetch()"
      />

      <RequestCommandPickForm
        v-else-if="openForm === 'MERGE'"
        test-id="merge-form"
        lead="Elige la solicitud que se queda."
        group-label="Solicitud que se queda"
        :items="mergeItems"
        :loading="mergeCandidates.isLoading.value"
        :load-failed="mergeCandidates.isError.value"
        empty-text="No hay otra solicitud con la que se pueda unir."
        required-message="Elige la solicitud que se queda."
        :hint="heldByOther ? 'Si la tiene otra persona, recibe un aviso de que la uniste.' : undefined"
        submit-label="Unir solicitudes"
        :pending="command.isPending.value"
        :server-error="fieldErrors.intoRequestId"
        @submit="onMerge"
        @back="closeSheet"
        @reload="mergeCandidates.refetch()"
      />

      <RequestCommandPickForm
        v-else-if="openForm === 'LINK_CUSTOMER'"
        test-id="link-form"
        lead="Elige el cliente que tiene este teléfono."
        group-label="Cliente"
        :items="linkItems"
        empty-text="No hay clientes con este teléfono para vincular."
        required-message="Elige un cliente."
        hint="También se vincularán las otras solicitudes con este mismo teléfono que no tienen cliente."
        submit-label="Vincular cliente"
        :pending="command.isPending.value"
        :server-error="fieldErrors.customerId"
        @submit="onLink"
        @back="closeSheet"
      />
    </RequestCommandSheet>
  </div>
</template>
