<script setup lang="ts">
/**
 * Composition surface for the POS Caja shift timeline (direction A, S4).
 *
 * It wires composables to the presentational shell: «Tu turno» and the session
 * list on the side, the selected shift's timeline in the middle (each task
 * opens IN PLACE, the next action is highlighted without forcing an order) and
 * the summary with «Por recibir» on the right. All feature logic lives in
 * `../composables`, the timeline model in `../utils/cash-timeline`, and every
 * operation contract is unchanged (registers, session opening with explicit
 * fund confirmation, manual movements, blind freeze/count, append-only notes,
 * independent verification, recipient custody, explicit FLOAT and a separate
 * drawer release).
 *
 * «Tu turno» is selected by default: `GET /cash-sessions?status=OPEN,COUNTING,
 * SUBMITTED&drawerOpen=true&limit=1` (+ `cashierUserId=<me>` with audit, S7).
 * Any other selection stays explicit. The supervisor list filters by exact
 * status and pages with the backend total. Opening a task never dispatches a
 * command. Session panels are keyed by the identity + session and stay mounted
 * (`v-show`) so an in-progress draft survives moving between steps; drafts that
 * are not session-scoped are keyed by the identity scope (and the opening form
 * additionally by its register), so a new actor, permission set or register
 * never inherits another context's draft.
 *
 * Owner decisions: S8 — the handover is offered right after the declaration
 * (SUBMITTED), before verification. S9 — while blind, after a cash in/out only
 * the confirmation of that last entry is shown, never a list.
 *
 * S5: «Cerrar caja» (supervisor, closer ≠ cashier) and the corte mount in their
 * timeline steps; «Cortes» (read:CashClosing) opens the closings list in place,
 * a row opens its corte. S6: the handover recipient is picked by name and role
 * from `GET /cash-handovers/recipients`.
 */
import { computed, ref, watch } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useCashAccess } from '../composables/useCashAccess'
import { useCashRegisters } from '../composables/useCashRegisters'
import {
  useCashOwnShift,
  useCashSessionDetail,
  useCashSessions,
} from '../composables/useCashSessions'
import { useCashSessionCommands } from '../composables/useCashSessionCommands'
import { useCashCustody } from '../composables/useCashCustody'
import { useCashHandoverRecipients } from '../composables/useCashHandoverRecipients'
import { useCashWorkspace, type CashPanelId } from '../composables/useCashWorkspace'
import { CashIdentityError, cashErrorInfo } from '../composables/cashErrorCopy'
import {
  requiredChannelIdentities,
  CASH_CHANNEL_KEY,
  type CashIdentity,
} from '../composables/cashRules'
import type {
  CashClosing,
  CashComparison,
  CashCountPayload,
  CashSessionListParams,
} from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'
import {
  buildCashTimeline,
  nextCashAction,
  type CashStepId,
  type CashTimelineInput,
} from '../utils/cash-timeline'
import CashWorkspace from '../components/CashWorkspace.vue'
import CashWorkspaceShiftCard, {
  type CashShiftContext,
} from '../components/CashWorkspaceShiftCard.vue'
import '../styles/cash-visual.css'
import CashOwnShiftCard from '../components/CashOwnShiftCard.vue'
import CashNextAction from '../components/CashNextAction.vue'
import CashTimeline from '../components/CashTimeline.vue'
import CashOpeningPanel from '../components/CashOpeningPanel.vue'
import CashSessionsPanel, {
  type CashSessionStatusFilter,
} from '../components/CashSessionsPanel.vue'
import CashMovementsPanel, { type CashLastMovement } from '../components/CashMovementsPanel.vue'
import CashCountForm from '../components/CashCountForm.vue'
import CashDeclarationNotesForm from '../components/CashDeclarationNotesForm.vue'
import CashVerificationPanel from '../components/CashVerificationPanel.vue'
import CashCustodyDiscovery from '../components/CashCustodyDiscovery.vue'
import CashCustodyActions from '../components/CashCustodyActions.vue'
import CashRegistersPanel from '../components/CashRegistersPanel.vue'
import CashCloseStep from '../closing/CashCloseStep.vue'
import CashClosingDetail from '../closing/CashClosingDetail.vue'
import CashClosingsList from '../closing/CashClosingsList.vue'

const access = useCashAccess()
const registers = useCashRegisters()
const commands = useCashSessionCommands()
const custody = useCashCustody()

const selectedRegisterId = ref<string | null>(null)
const selectedSessionId = ref<string | null>(null)
// A FLOAT chosen for one register must not silently carry over to another.
const openFloatId = ref<string | null>(null)
// The custody receipt currently in flight, so a repeat click is blocked.
const receivingId = ref<string | null>(null)
// S9: the last manual entry recorded for the selected shift (POST response).
const lastMovement = ref<CashLastMovement | null>(null)

/**
 * Session list filters (supervisor list, S7): one exact `status` (handoff 25 §2)
 * and the register; real paging with the backend `total`. Any filter change
 * goes back to the first page.
 */
const SESSIONS_PAGE_SIZE = 25
/**
 * D2: a supervisor (branch audit, no create:CashSession) starts on the sessions
 * pending to verify or close; everyone else on «Todas».
 */
function defaultStatusFilter(): CashSessionStatusFilter {
  return !access.canOpenSession.value && access.canAuditSessions.value ? 'SUBMITTED' : 'ALL'
}
const statusFilter = ref<CashSessionStatusFilter>(defaultStatusFilter())
const registerFilter = ref<string | null>(null)
const sessionsPage = ref(1)
watch([statusFilter, registerFilter], () => {
  sessionsPage.value = 1
})

const sessionParams = computed<CashSessionListParams>(() => ({
  page: sessionsPage.value,
  limit: SESSIONS_PAGE_SIZE,
  ...(registerFilter.value ? { registerId: registerFilter.value } : {}),
  ...(statusFilter.value !== 'ALL' ? { status: [statusFilter.value] } : {}),
}))

const sessions = useCashSessions(sessionParams)
/** «Tu turno» from its own filtered read (S7), never guessed from a list page. */
const ownShiftQuery = useCashOwnShift()
const ownShift = computed(() => ownShiftQuery.ownShift.value)

/** The supervisor list and «Tu turno» move together after a lifecycle command. */
function refreshSessions() {
  return Promise.all([sessions.refetch(), ownShiftQuery.refetch()])
}
const registerNames = computed(() =>
  Object.fromEntries(registers.registers.value.map((register) => [register.id, register.name])),
)
const detailQuery = useCashSessionDetail(selectedSessionId)

// One presentation channel for command feedback; each panel receives only its
// own scope so a stale error from another panel is never shown.
const errorScope = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const declareComparison = ref<CashComparison | null>(null)
const verifyComparison = ref<CashComparison | null>(null)

/**
 * Monotonic token for the explicitly selected shift context. Every selection
 * change — another register, another shift, or an identity reset — invalidates
 * it, so a late command result can only be applied to the exact selection that
 * started it and is never reused after A → B → A. The same boundary drops the
 * stored contextual feedback (errorScope/errorMessage and the S9 confirmation),
 * so nothing from the previous context is shown for the new one.
 */
let sessionContextToken = 0

function invalidateSessionContext(): void {
  sessionContextToken += 1
  errorScope.value = null
  errorMessage.value = null
  lastMovement.value = null
}

/** «Cortes» in place: the list, or one corte opened from it. */
const cortesOpen = ref(false)
const cortesClosingId = ref<string | null>(null)

/**
 * The full session identity (tenant + user + permission generation + session
 * lifecycle generation). Everything sensitive this view holds locally is keyed
 * to it: a switch, logout or re-login must not inherit the previous principal's
 * selection, comparisons, errors or in-flight receipt target.
 */
const identityScope = computed(
  () =>
    `${access.identity.value.tenantId}|${access.identity.value.userId}|${access.identity.value.permissionFingerprint}|${access.identity.value.generation}`,
)

/** The default «Tu turno» selection runs once per identity. */
let ownShiftDefaulted = false

watch(identityScope, () => {
  invalidateSessionContext()
  selectedRegisterId.value = null
  selectedSessionId.value = null
  openFloatId.value = null
  receivingId.value = null
  declareComparison.value = null
  verifyComparison.value = null
  ownShiftDefaulted = false
  statusFilter.value = defaultStatusFilter()
  registerFilter.value = null
  sessionsPage.value = 1
  cortesOpen.value = false
  cortesClosingId.value = null
})

/** Remount the session-sensitive forms when the identity or the session changes. */
const sessionSectionKey = computed(
  () => `${identityScope.value}|${selectedSessionId.value ?? 'none'}`,
)

function fail(scope: string, error: unknown, fallback?: string) {
  errorScope.value = scope
  errorMessage.value = cashErrorInfo(error, fallback).message
}

function clearError(scope: string) {
  if (errorScope.value === scope) {
    errorScope.value = null
    errorMessage.value = null
  }
}

function errorFor(scope: string): string | null {
  return errorScope.value === scope ? errorMessage.value : null
}

/**
 * Run one command handler under the identity captured BEFORE any await.
 *
 * A result that returns after the principal changed (`changed`) belongs to the
 * previous user: it is dropped silently — no banner, no state write, no cache
 * mutation for whoever is active now. Commands are simply not attempted without
 * an active tenant/user.
 */
async function withIdentityGuard(
  scope: string,
  fallback: string,
  work: (captured: CashIdentity) => Promise<void>,
): Promise<void> {
  clearError(scope)
  const captured = access.captureIdentity()
  if (!captured.tenantId || !captured.userId) return
  try {
    await work(captured)
  } catch (error) {
    if (error instanceof CashIdentityError && error.reason === 'changed') return
    fail(scope, error, fallback)
  }
}

/** The captured shift is still the selected one — same token AND same id. */
function isSameSessionContext(token: number, sessionId: string): boolean {
  return token === sessionContextToken && selectedSessionId.value === sessionId
}

/**
 * Run one shift-scoped command and hand back its result ONLY while the shift
 * that was selected when the request started is STILL the selected shift.
 *
 * `withIdentityGuard` already drops a response after a principal change; this
 * closes the same-principal gap: switching A → B (or A → B → A) while A's
 * declare/verify is pending makes its result and its error stale, so neither the
 * comparison nor the banner may land in the surface of the shift selected now,
 * and a stale outcome never STARTS the follow-up cache refetch. The refetch
 * awaits themselves are not token-guarded here: this helper only decides whether
 * the command result/error belongs to the current selection.
 * `null` is the stale marker: command responses are objects, never null.
 */
async function runForSelectedSession<T>(
  sessionId: string,
  task: () => Promise<T>,
): Promise<T | null> {
  const token = sessionContextToken
  try {
    const result = await task()
    return isSameSessionContext(token, sessionId) ? result : null
  } catch (error) {
    if (!isSameSessionContext(token, sessionId)) return null
    throw error
  }
}


const session = computed(() => detailQuery.detail.value?.session ?? null)
const blind = computed(() => session.value?.blind === true)
const isFrozenBlind = computed(() => blind.value && session.value?.status === 'COUNTING')
const isSubmitted = computed(() => session.value?.status === 'SUBMITTED')

const countChannels = computed(() => requiredChannelIdentities(detailQuery.detail.value))
const verificationComparison = computed<CashComparison | null>(
  () => verifyComparison.value ?? declareComparison.value,
)

const countedCashCents = computed<number | null>(() => {
  const counts = detailQuery.detail.value?.counts ?? []
  const declaration = [...counts]
    .filter((count) => count.kind === 'DECLARATION')
    .sort((a, b) => b.revision - a.revision)[0]
  // `CashCount` carries only `lines`; the physical drawer is the CASH channel.
  return (
    declaration?.lines.find((line) => line.channelKey === CASH_CHANNEL_KEY)?.amountCents ?? null
  )
})

const handovers = computed(() => detailQuery.detail.value?.handovers ?? [])
const pendingReceiveCount = computed(
  () => handovers.value.filter((item) => !item.receivedAt).length,
)

/** `null` while there is no selected shift or no authenticated actor to compare with. */
const isOwnShift = computed<boolean | null>(() => {
  const cashier = session.value?.cashierUserId
  const current = access.currentUserId.value
  if (!cashier || !current) return null
  return cashier === current
})

const hasSelection = computed(() => Boolean(selectedSessionId.value))
/**
 * D2: without create:CashSession and no shift in focus there is nothing to
 * open: the main column is the supervisor view (pending sessions, «Cortes»,
 * register management) instead of «Abre tu turno».
 */
const supervisorHome = computed(() => !hasSelection.value && !access.canOpenSession.value)
const canManageRegisters = computed(
  () =>
    access.canReadRegisters.value &&
    (access.canCreateRegister.value || access.canUpdateRegister.value),
)
const detailLoaded = computed(() => Boolean(detailQuery.detail.value))
const detailLoading = computed(() => hasSelection.value && detailQuery.isLoading.value)
/** One failed detail read is told once, in the main column, with its Reintentar. */
const detailFailed = computed(() => hasSelection.value && detailQuery.isError.value)

// ── Timeline ────────────────────────────────────────────────────────────────
const timelineInput = computed<CashTimelineInput>(() => {
  const current = session.value
  if (!hasSelection.value || !current) {
    return {
      status: null,
      perspective: 'cashier',
      verified: false,
      drawerReleased: false,
      handoversDeclared: 0,
      handoversPending: 0,
      countedCashCents: null,
    }
  }
  return {
    status: current.status,
    perspective: isOwnShift.value === true ? 'cashier' : 'observer',
    verified: (detailQuery.detail.value?.counts ?? []).some((count) => count.kind === 'VERIFICATION'),
    drawerReleased: Boolean(current.drawerReleasedAt),
    handoversDeclared: handovers.value.length,
    handoversPending: pendingReceiveCount.value,
    countedCashCents: countedCashCents.value,
    cashierName: isOwnShift.value === true ? null : (current.cashierDisplayName ?? null),
    canVerify: access.canVerifyIndependent.value,
  }
})

const steps = computed(() => buildCashTimeline(timelineInput.value))
/** The sticky bar and «Siguiente paso» only offer what this user can do (D2). */
const nextAction = computed(() =>
  supervisorHome.value ? null : nextCashAction(timelineInput.value),
)
const registerName = computed(
  () =>
    detailQuery.detail.value?.register?.name ??
    (session.value ? registerNames.value[session.value.registerId] : undefined) ??
    'Caja',
)

function isPanelReachable(panelId: CashPanelId): boolean {
  if (panelId === 'recepcion') return access.canReadCustody.value
  if (supervisorHome.value) return false
  // While a selected shift loads, keep what is open: it belongs to that shift.
  if (hasSelection.value && !detailLoaded.value) return true
  return steps.value.find((step) => step.id === panelId)?.reachable ?? false
}

const { openPanelId, openPanel, closePanel, togglePanel } = useCashWorkspace({
  isReachable: isPanelReachable,
  initialPanelId: access.canOpenSession.value ? 'apertura' : null,
})

// Recipients are read only while the handover task is open (S6).
const recipients = useCashHandoverRecipients({ active: () => openPanelId.value === 'entrega' })

// A timeline task and «Cortes» never show at the same time.
watch(openPanelId, (panelId) => {
  if (panelId) cortesOpen.value = false
})

function toggleCortes() {
  if (cortesOpen.value) {
    cortesOpen.value = false
    return
  }
  cortesClosingId.value = null
  closePanel()
  cortesOpen.value = true
}

/** Phones stack the list below the main column: jump to it and move focus there. */
function jumpToSessions() {
  const heading = document.getElementById('cash-sessions-title')
  heading?.scrollIntoView({ block: 'start' })
  heading?.focus({ preventScroll: true })
}

function hideCortes() {
  cortesOpen.value = false
  cortesClosingId.value = null
}

/** Register and cashier options for the «Cortes» filters (names only, never ids). */
const closingRegisters = computed(() =>
  registers.registers.value.map((register) => ({ id: register.id, name: register.name })),
)
const closingCashiers = computed(() => {
  const byId = new Map<string, string>()
  const candidates = [...sessions.sessions.value, ...(ownShift.value ? [ownShift.value] : [])]
  for (const item of candidates) {
    const name = item.cashierDisplayName?.trim()
    if (name && !byId.has(item.cashierUserId)) byId.set(item.cashierUserId, name)
  }
  return [...byId.entries()]
    .map(([userId, displayName]) => ({ userId, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'))
})

/** The corte of the selected shift: from its detail once closed. */
const corteClosingId = computed(() => detailQuery.detail.value?.closing?.id ?? null)

/**
 * What the summary card says while no shift is selected: the registers read
 * decides the next step. A failed read stays quiet there (the opening panel
 * owns that error), and without the grants to open a turn it points at the list.
 */
const shiftContext = computed<CashShiftContext>(() => {
  if (registers.isLoading.value) return 'loading'
  if (
    registers.isError.value ||
    !access.canReadRegisters.value ||
    !access.canOpenSession.value
  ) {
    return 'choose-session'
  }
  if (registers.registers.value.length === 0) return 'no-registers'
  return selectedRegisterId.value ? 'register-chosen' : 'choose-register'
})

const pendingForMe = computed(() => custody.pendingHandovers.value.length)
const pendingForMeCents = computed(() =>
  custody.pendingHandovers.value.reduce((sum, item) => sum + item.declaredCents, 0),
)

const permissionNote = computed(() => {
  if (access.canVerifyIndependent.value) {
    return 'Tienes permiso de verificación y de auditoría de sesiones.'
  }
  return 'Verificar el conteo y cerrar la caja los hace otra persona con permiso.'
})

// ── Default «Tu turno» ──────────────────────────────────────────────────────
// Registered after the workspace model: with a cached list it runs at once and
// selecting a shift closes the open panel.
watch(
  [ownShift, () => ownShiftQuery.isSuccess.value],
  () => {
    if (!ownShiftQuery.isSuccess.value || ownShiftDefaulted) return
    ownShiftDefaulted = true
    if (ownShift.value && !selectedSessionId.value) selectSession(ownShift.value.id)
  },
  { immediate: true },
)

const HANDOVER_KIND_LABELS = { FLOAT: 'Fondo para el siguiente turno', WITHDRAWAL: 'Retiro a resguardo' }

function selectRegister(registerId: string) {
  invalidateSessionContext()
  selectedRegisterId.value = registerId
  openFloatId.value = null
  declareComparison.value = null
  verifyComparison.value = null
}

function selectSession(sessionId: string) {
  invalidateSessionContext()
  selectedSessionId.value = sessionId
  declareComparison.value = null
  verifyComparison.value = null
  closePanel()
  hideCortes()
}

/** Leave any selected shift and show the opening in place. */
function requestOpening() {
  if (selectedSessionId.value) {
    invalidateSessionContext()
    selectedSessionId.value = null
    declareComparison.value = null
    verifyComparison.value = null
  }
  hideCortes()
  openPanel('apertura')
}

function onTimelineToggle(stepId: CashStepId) {
  togglePanel(stepId)
}

function handleCreateRegister(name: string) {
  return withIdentityGuard('registers', 'No se pudo crear la caja.', async () => {
    await registers.createRegister({ name })
  })
}

function handleUpdateRegister(id: string, payload: { name?: string; isActive?: boolean }) {
  return withIdentityGuard('registers', 'No se pudo actualizar la caja.', async () => {
    await registers.updateRegister(id, payload)
  })
}

function handleOpenSession(payload: { openingCents: number; openingHandoverId?: string }) {
  // A repeat click while the open is in flight is absorbed quietly: the command
  // layer would refuse it anyway, but that refusal is not a failure to report.
  if (commands.activeCommand.value === 'open') return Promise.resolve()
  return withIdentityGuard('open', 'No se pudo abrir la sesión.', async () => {
    // Captured once, before the request: a stale promise must never select an
    // old session for the new user.
    const registerId = selectedRegisterId.value
    if (!registerId) return
    const opened = await commands.openSession(registerId, payload)
    // Leave the opening state: the form is keyed on the selected register, so
    // clearing it unmounts the form (and its confirmation) and no second open
    // can be sent from it. The new shift becomes the focused one. A failed open
    // throws above and keeps the form, its values and the error.
    selectedRegisterId.value = null
    openFloatId.value = null
    selectSession(opened.session.id)
    await Promise.all([refreshSessions(), registers.refetch(), custody.refetch()])
  })
}

function handleMovement(payload: {
  kind: 'CASH_IN' | 'CASH_OUT'
  amountCents: number
  reason: string
}) {
  return withIdentityGuard(
    'movements',
    'No se pudo registrar el movimiento.',
    async () => {
      const sessionId = selectedSessionId.value
      if (!sessionId) return
      const body = { amountCents: payload.amountCents, reason: payload.reason }
      // S9: the POST response is the only trace of a blind entry; it belongs to
      // the shift that was selected when it was sent, never to another one.
      const result = await runForSelectedSession(sessionId, () =>
        payload.kind === 'CASH_IN'
          ? commands.cashIn(sessionId, body)
          : commands.cashOut(sessionId, body),
      )
      if (result === null) return
      lastMovement.value = {
        id: result.id,
        kind: payload.kind,
        deltaCents: result.deltaCents,
        occurredAt: result.occurredAt,
        reason: payload.reason,
      }
    },
  )
}

function handleFreeze() {
  return withIdentityGuard('freeze', 'No se pudo iniciar el conteo.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.startCount(sessionId)
    await Promise.all([detailQuery.refetch(), refreshSessions()])
  })
}

function handleDeclare(payload: CashCountPayload) {
  return withIdentityGuard('declare', 'No se pudo enviar la declaración.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    // A comparison belongs to the shift that was selected when it was requested;
    // a switch while it was in flight leaves it stale and unrendered.
    const result = await runForSelectedSession(sessionId, () =>
      commands.declare(sessionId, payload),
    )
    if (result === null) return
    declareComparison.value = result.comparison
    await Promise.all([detailQuery.refetch(), refreshSessions()])
  })
}

function handleAppendNotes(notes: string) {
  return withIdentityGuard('notes', 'No se pudo agregar la nota.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.appendNotes(sessionId, notes)
    await detailQuery.refetch()
  })
}

function handleVerify(payload: CashCountPayload) {
  return withIdentityGuard('verify', 'No se pudo enviar la verificación.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    // Same shift-scoped rule as the declaration: never render B's comparison
    // from a request that was started for A.
    const result = await runForSelectedSession(sessionId, () => commands.verify(sessionId, payload))
    if (result === null) return
    verifyComparison.value = result.comparison
    await Promise.all([detailQuery.refetch(), refreshSessions()])
  })
}

function handleReceive(payload: { id: string; receivedCents: number; notes?: string }) {
  receivingId.value = payload.id
  return withIdentityGuard('custody', 'No se pudo registrar la recepción.', async () => {
    await commands.receiveHandover(payload.id, {
      receivedCents: payload.receivedCents,
      ...(payload.notes ? { notes: payload.notes } : {}),
    })
    await Promise.all([custody.refetch(), detailQuery.refetch()])
  }).finally(() => {
    if (receivingId.value === payload.id) receivingId.value = null
  })
}

function handleDeclareHandover(payload: {
  handoverKind: 'FLOAT' | 'WITHDRAWAL'
  recipientUserId: string
  declaredCents: number
  notes?: string
}) {
  return withIdentityGuard('custody', 'No se pudo declarar la entrega.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.declareHandover(sessionId, payload)
    await Promise.all([detailQuery.refetch(), custody.refetch()])
  })
}

function handleReleaseDrawer() {
  return withIdentityGuard('custody', 'No se pudo liberar el cajón.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.releaseDrawer(sessionId)
    await Promise.all([detailQuery.refetch(), custody.refetch(), refreshSessions()])
  })
}

/**
 * The close already succeeded (useCashClose refreshed the slots); show the corte
 * of THAT shift only while it is still the selected one.
 */
async function handleClosed(closing: CashClosing) {
  const token = sessionContextToken
  const sessionId = closing.sessionId
  try {
    await Promise.all([detailQuery.refetch(), refreshSessions()])
  } catch {
    // Best effort: the corte is already seeded from the close response.
  }
  if (isSameSessionContext(token, sessionId)) openPanel('corte')
}

function viewClosing() {
  openPanel('corte')
}
</script>

<template>
  <section class="cash-visual cash-page flex flex-col gap-6 md:px-10">
    <EmptyState
      v-if="!access.canAnyCashRead.value"
      kind="forbidden"
      title="No tienes acceso a Caja"
      description="Pide a un encargado el permiso «Ver sesiones de caja»."
      data-testid="cash-access-denied"
    />

    <CashWorkspace v-else :key="identityScope" title="Caja">
      <!-- ── Side: «Tu turno» + the session list ───────────────────────── -->
      <template #side>
        <CashOwnShiftCard
          v-if="access.canOpenSession.value || (access.canReadSessions.value && ownShift)"
          :session="ownShift"
          :register-name="ownShift ? (registerNames[ownShift.registerId] ?? null) : null"
          :loading="ownShiftQuery.isLoading.value"
          :selected="Boolean(ownShift) && selectedSessionId === ownShift?.id"
          :opening-selected="!hasSelection && openPanelId === 'apertura'"
          :can-open="access.canOpenSession.value"
          @select="selectSession"
          @request-opening="requestOpening"
        />

        <CashSessionsPanel
          v-if="access.canReadSessions.value"
          variant="list"
          :title="sessions.canFilterByCashier.value ? 'Sesiones de la sucursal' : 'Mis sesiones'"
          :sessions="sessions.sessions.value"
          :register-names="registerNames"
          :selected-session-id="selectedSessionId"
          :loading="sessions.isLoading.value"
          :fetching="sessions.isFetching.value"
          :error="sessions.isError.value"
          :can-filter-by-cashier="sessions.canFilterByCashier.value"
          :can-open="access.canOpenSession.value"
          :total="sessions.total.value"
          :page-size="SESSIONS_PAGE_SIZE"
          :show-filters="sessions.canFilterByCashier.value"
          v-model:status-filter="statusFilter"
          v-model:register-filter="registerFilter"
          v-model:page="sessionsPage"
          @select="selectSession"
          @refresh="sessions.refetch()"
          @request-opening="requestOpening"
        />
      </template>

      <!-- ── Main: the selected shift ─────────────────────────────────── -->
      <template #head>
        <p class="cash-head-meta">
          <template v-if="hasSelection && session">
            <StatusBadge
              :label="CASH_SESSION_STATUS_LABELS[session.status]"
              :tone="cashSessionStatusTone(session.status)"
              data-testid="cash-head-status"
            />
            <StatusBadge
              :label="session.drawerReleasedAt ? 'Cajón liberado' : 'Cajón sin liberar'"
              tone="neutral"
              aria-prefix="Cajón:"
            />
            <span>
              {{ isOwnShift ? 'Tú' : (session.cashierDisplayName?.trim() || 'Otra persona') }}
              <template v-if="session.openedAt">
                · abierta {{ formatShortDateTime(session.openedAt) }}</template
              >
            </span>
          </template>
          <template v-else-if="supervisorHome">
            <StatusBadge label="Supervisión" tone="neutral" />
            <span>Ninguna sesión seleccionada</span>
          </template>
          <template v-else-if="!hasSelection">
            <StatusBadge label="Sin turno" tone="neutral" />
            <span>Aún no hay turno abierto</span>
          </template>
        </p>
        <h2 id="cash-shift-heading" class="cash-head-title" data-testid="cash-head-title">
          {{
            hasSelection
              ? session
                ? registerName
                : 'Turno seleccionado'
              : supervisorHome
                ? access.canAuditSessions.value
                  ? 'Sesiones de la sucursal'
                  : 'Elige una sesión'
                : 'Abre tu turno'
          }}
        </h2>
      </template>

      <!-- «Cortes» (S5, read:CashClosing): the list in place, a row opens its corte. -->
      <section
        v-if="access.canReadClosings.value && cortesOpen"
        class="cash-inplace"
        aria-labelledby="cash-cortes-title"
        data-testid="cash-task-cortes"
      >
        <header class="cash-inplace-head">
          <h3 id="cash-cortes-title" class="cash-list-title" tabindex="-1">Cortes</h3>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            class="min-h-11"
            data-testid="cash-closings-hide"
            @click="hideCortes"
          >
            Ocultar
          </UButton>
        </header>
        <template v-if="cortesClosingId">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            class="min-h-11 self-start"
            icon="i-lucide-arrow-left"
            data-testid="cash-closings-back"
            @click="cortesClosingId = null"
          >
            Volver a cortes
          </UButton>
          <CashClosingDetail :closing-id="cortesClosingId" @back="cortesClosingId = null" />
        </template>
        <CashClosingsList
          v-else
          :registers="closingRegisters"
          :cashiers="closingCashiers"
          @open="cortesClosingId = $event"
        />
      </section>

      <EmptyState
        v-if="detailFailed"
        kind="error"
        title="No se pudo cargar el turno"
        description="Revisa la conexión e inténtalo de nuevo. No se perdió ningún dato: los movimientos ya registrados están guardados."
        action-label="Reintentar"
        data-testid="cash-shift-error"
        @action="detailQuery.refetch()"
      />

      <div
        v-if="detailLoading"
        class="cash-tl-skeleton"
        aria-hidden="true"
        data-testid="cash-timeline-loading"
      >
        <div class="hf-skeleton h-24 w-full animate-pulse rounded-xl" />
        <div v-for="n in 4" :key="n" class="flex items-center gap-3">
          <div class="hf-skeleton size-6 animate-pulse rounded-full" />
          <div class="flex flex-1 flex-col gap-2">
            <div class="hf-skeleton h-3.5 w-2/3 animate-pulse rounded" />
            <div class="hf-skeleton h-3 w-1/2 animate-pulse rounded" />
          </div>
        </div>
      </div>

      <template v-if="!hasSelection || detailLoaded">
        <CashNextAction
          v-if="nextAction && !(nextAction.stepId && openPanelId === nextAction.stepId)"
          :action="nextAction"
          :open-id="openPanelId"
          @open="openPanel"
        />

        <!-- «Por recibir» opens in place, above the timeline. -->
        <section
          v-if="access.canReadCustody.value"
          v-show="openPanelId === 'recepcion'"
          class="cash-inplace"
          aria-labelledby="cash-recepcion-title"
          data-testid="cash-task-recepcion"
        >
          <header class="cash-inplace-head">
            <h3 id="cash-recepcion-title" class="cash-list-title" tabindex="-1">Por recibir</h3>
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="min-h-11"
              data-testid="cash-recepcion-hide"
              @click="closePanel"
            >
              Ocultar
            </UButton>
          </header>
          <CashCustodyDiscovery
            :allowed="custody.allowed.value"
            :pending-handovers="custody.pendingHandovers.value"
            :eligible-float="custody.eligibleFloat.value"
            :current-user-id="access.currentUserId.value"
            :can-receive="access.canReceiveHandover.value"
            :register-id="selectedRegisterId"
            :loading="custody.isLoading.value"
            :error="custody.isError.value"
            :receiving-id="receivingId"
            @receive="handleReceive"
            @refresh="custody.refetch()"
          />
        </section>

        <!-- D2: no shift to open — the supervisor view instead of «Abre tu turno». -->
        <section
          v-if="supervisorHome && !cortesOpen"
          class="cash-supervisor-home"
          aria-labelledby="cash-shift-heading"
          data-testid="cash-supervisor-home"
        >
          <div class="cash-empty-note">
            <UIcon name="i-lucide-list-checks" class="size-5" aria-hidden="true" />
            <p>
              <strong>{{
                access.canAuditSessions.value
                  ? 'Elige una sesión por verificar o cerrar'
                  : 'Elige una sesión de la lista'
              }}</strong
              ><br />
              <span class="cash-meta-wrap">{{
                access.canAuditSessions.value
                  ? 'La lista empieza en «Por verificar o cerrar». Al elegir una sesión ves sus pasos: verificar el conteo, recibir entregas y cerrar la caja.'
                  : 'Al elegir una sesión ves sus pasos y lo que puedes hacer en cada uno.'
              }}</span>
            </p>
          </div>
          <div class="cash-supervisor-actions">
            <UButton
              v-if="access.canReadSessions.value"
              type="button"
              class="cash-supervisor-jump min-h-11"
              icon="i-lucide-list"
              data-testid="cash-supervisor-sessions"
              @click="jumpToSessions"
            >
              Ver sesiones
            </UButton>
            <UButton
              v-if="access.canReadClosings.value"
              type="button"
              color="neutral"
              variant="outline"
              class="min-h-11"
              icon="i-lucide-file-text"
              data-testid="cash-supervisor-cortes"
              @click="toggleCortes"
            >
              Ver cortes
            </UButton>
          </div>
          <details
            v-if="canManageRegisters"
            class="cash-manage"
            data-testid="cash-supervisor-manage"
          >
            <summary class="cash-manage-summary">Administrar cajas</summary>
            <CashRegistersPanel
              :registers="registers.registers.value"
              :selected-register-id="null"
              :can-create="access.canCreateRegister.value"
              :can-update="access.canUpdateRegister.value"
              :can-open="false"
              :loading="registers.isLoading.value"
              :error="registers.isError.value"
              :creating="registers.creating.value"
              :updating="registers.updating.value"
              @create="handleCreateRegister"
              @update="handleUpdateRegister"
              @refresh="registers.refetch()"
            />
          </details>
        </section>

        <CashTimeline
          v-if="!supervisorHome"
          :steps="steps"
          :open-id="openPanelId"
          :label="hasSelection ? `Pasos del turno de ${registerName}` : 'Pasos para abrir tu turno'"
          @toggle="onTimelineToggle"
        >
          <!-- Abrir caja: register, fund and confirmation in one place. -->
          <template #panel-apertura>
            <div v-if="hasSelection && session" class="cash-callout cash-callout--ok">
              <UIcon name="i-lucide-circle-check" class="cash-callout-icon" aria-hidden="true" />
              <p>
                <strong>{{ registerName }} abierta</strong><br />
                <span class="cash-meta-wrap"
                  >Fondo inicial {{ formatCentsMXN(session.openingCents) }} confirmado.</span
                >
              </p>
            </div>
            <CashOpeningPanel
              v-else
              v-model:float-id="openFloatId"
              :registers="registers.registers.value"
              :selected-register-id="selectedRegisterId"
              :loading="registers.isLoading.value"
              :error="registers.isError.value"
              :can-read-registers="access.canReadRegisters.value"
              :can-create="access.canCreateRegister.value"
              :can-update="access.canUpdateRegister.value"
              :can-open="access.canOpenSession.value"
              :creating="registers.creating.value"
              :updating="registers.updating.value"
              :eligible-float="custody.eligibleFloat.value"
              :custody-visible="custody.allowed.value"
              :submitting="commands.activeCommand.value === 'open'"
              :error-message="errorFor('open')"
              :registers-error-message="errorFor('registers')"
              @select="selectRegister"
              @create="handleCreateRegister"
              @update="handleUpdateRegister"
              @refresh="registers.refetch()"
              @submit="handleOpenSession"
            />
          </template>

          <template #panel-movimientos>
            <CashMovementsPanel
              v-if="hasSelection"
              :key="sessionSectionKey"
              :detail="detailQuery.detail.value ?? null"
              :current-user-id="access.currentUserId.value"
              :can-cash-in="access.canCashIn.value"
              :can-cash-out="access.canCashOut.value"
              :submitting="
                commands.activeCommand.value === 'cashIn' ||
                commands.activeCommand.value === 'cashOut'
              "
              :error-message="errorFor('movements')"
              :loading="detailQuery.isLoading.value"
              :last-movement="lastMovement"
              @submit="handleMovement"
              @refresh="detailQuery.refetch()"
            />
          </template>

          <template #panel-conteo>
            <div v-if="hasSelection" :key="sessionSectionKey" class="flex flex-col gap-4">
              <div
                v-if="session?.status === 'OPEN' && access.canCount.value"
                class="flex flex-col gap-4"
              >
                <p>Inicia el conteo cuando termines de vender. A partir de ese momento:</p>
                <ul class="cash-checklist">
                  <li>
                    <UIcon name="i-lucide-lock" class="cash-checklist-icon" aria-hidden="true" />
                    <span
                      ><strong>La caja se congela</strong><br /><span class="cash-meta-wrap"
                        >No admite cobros en efectivo ni entradas o salidas. No libera el cajón.</span
                      ></span
                    >
                  </li>
                  <li>
                    <UIcon name="i-lucide-eye-off" class="cash-checklist-icon" aria-hidden="true" />
                    <span
                      ><strong>Cuentas a ciegas</strong><br /><span class="cash-meta-wrap"
                        >Declaras cada canal sin ver lo esperado; el cero también se declara.</span
                      ></span
                    >
                  </li>
                  <li>
                    <UIcon name="i-lucide-shield-check" class="cash-checklist-icon" aria-hidden="true" />
                    <span
                      ><strong>Otra persona verifica</strong><br /><span class="cash-meta-wrap"
                        >Recuenta tu efectivo después de que declares.</span
                      ></span
                    >
                  </li>
                </ul>
                <p
                  v-if="errorFor('freeze')"
                  class="cash-inline-error"
                  role="alert"
                  data-testid="cash-freeze-error"
                >
                  <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
                  {{ errorFor('freeze') }}
                </p>
                <UButton
                  type="button"
                  class="min-h-11 self-end"
                  :loading="commands.activeCommand.value === 'freeze'"
                  data-testid="cash-session-freeze"
                  @click="handleFreeze"
                >
                  Iniciar conteo y congelar caja
                </UButton>
              </div>
              <div
                v-else-if="session?.status === 'OPEN'"
                class="cash-callout"
                data-testid="cash-count-forbidden"
              >
                <UIcon name="i-lucide-lock" class="cash-callout-icon" aria-hidden="true" />
                <p>
                  <strong>No tienes permiso para contar o declarar</strong><br />
                  <span class="cash-meta-wrap">Pide a un encargado el permiso «Contar y declarar».</span>
                </p>
              </div>
              <div v-else class="cash-callout" data-testid="cash-count-frozen">
                <UIcon name="i-lucide-lock" class="cash-callout-icon" aria-hidden="true" />
                <p>
                  <strong>La caja está congelada</strong><br />
                  <span class="cash-meta-wrap">
                    {{
                      session?.frozenAt
                        ? `Desde ${formatShortDateTime(session.frozenAt)} no admite cobros en efectivo ni movimientos.`
                        : 'Ya no admite cobros en efectivo ni movimientos.'
                    }}
                  </span>
                </p>
              </div>
            </div>
          </template>

          <template #panel-declaracion>
            <div v-if="hasSelection" :key="sessionSectionKey" class="flex flex-col gap-4">
              <CashCountForm
                v-if="isFrozenBlind && access.canCount.value"
                :channels="countChannels"
                :submitting="commands.activeCommand.value === 'declare'"
                :error-message="errorFor('declare')"
                @submit="handleDeclare"
              />
              <CashDeclarationNotesForm
                v-else-if="isSubmitted && access.canCount.value"
                :submitting="commands.activeCommand.value === 'notes'"
                :error-message="errorFor('notes')"
                @submit="handleAppendNotes"
              />
              <div v-else class="cash-callout" data-testid="cash-declaration-unavailable">
                <UIcon name="i-lucide-user" class="cash-callout-icon" aria-hidden="true" />
                <p>
                  <strong>La declaración la hace la persona responsable de la sesión</strong><br />
                  <span class="cash-meta-wrap">Necesita el permiso «Contar y declarar».</span>
                </p>
              </div>
            </div>
          </template>

          <!-- S8: the handover is open from SUBMITTED, before verification. -->
          <template #panel-entrega>
            <div v-if="hasSelection" :key="sessionSectionKey" class="flex flex-col gap-4">
              <ul v-if="handovers.length > 0" class="cash-ho-list" data-testid="cash-handover-list">
                <li v-for="item in handovers" :key="item.id" class="cash-ho-row">
                  <span class="cash-strong">{{ HANDOVER_KIND_LABELS[item.kind] }}</span>
                  <span class="hf-figure">{{ formatCentsMXN(item.declaredCents) }}</span>
                  <StatusBadge
                    :label="item.receivedAt ? 'Recibida' : 'Por recibir'"
                    :tone="item.receivedAt ? 'success' : 'warning'"
                  />
                </li>
              </ul>
              <p v-if="isSubmitted && pendingReceiveCount > 0" class="cash-notice">
                <UIcon name="i-lucide-clock" class="size-4 shrink-0" aria-hidden="true" />
                Cada persona recibe desde su propia sesión, en «Por recibir». Después liberas el cajón.
              </p>
              <CashCustodyActions
                section="handover"
                :session-id="selectedSessionId"
                :can-declare-handover="access.canDeclareHandover.value"
                :can-release-drawer="access.canDeclareHandover.value"
                :drawer-released="Boolean(session?.drawerReleasedAt)"
                :pending-receive-count="pendingReceiveCount"
                :counted-cash-cents="countedCashCents"
                :recipients="{
                  FLOAT: recipients.state.value.FLOAT.items,
                  WITHDRAWAL: recipients.state.value.WITHDRAWAL.items,
                }"
                :recipients-loading="{
                  FLOAT: recipients.state.value.FLOAT.loading,
                  WITHDRAWAL: recipients.state.value.WITHDRAWAL.loading,
                }"
                :recipients-error="{
                  FLOAT: recipients.state.value.FLOAT.error,
                  WITHDRAWAL: recipients.state.value.WITHDRAWAL.error,
                }"
                :current-user-id="access.currentUserId.value"
                :busy="commands.isBusy.value"
                :submitting="commands.activeCommand.value === 'declareHandover'"
                :releasing="commands.activeCommand.value === 'releaseDrawer'"
                :error-message="errorFor('custody')"
                @declare="handleDeclareHandover"
                @release="handleReleaseDrawer"
                @retry-recipients="recipients.refetch($event)"
              />
            </div>
          </template>

          <template #panel-verificacion>
            <CashVerificationPanel
              v-if="hasSelection"
              :key="sessionSectionKey"
              :detail="detailQuery.detail.value ?? null"
              :can-verify="access.canVerifyIndependent.value"
              :current-user-id="access.currentUserId.value"
              :submitting="commands.activeCommand.value === 'verify'"
              :comparison="verificationComparison"
              :error-message="errorFor('verify')"
              @submit="handleVerify"
            />
          </template>

          <template #panel-liberar>
            <CashCustodyActions
              v-if="hasSelection"
              :key="sessionSectionKey"
              section="release"
              :session-id="selectedSessionId"
              :can-declare-handover="access.canDeclareHandover.value"
              :can-release-drawer="access.canDeclareHandover.value"
              :drawer-released="Boolean(session?.drawerReleasedAt)"
              :pending-receive-count="pendingReceiveCount"
              :counted-cash-cents="countedCashCents"
              :current-user-id="access.currentUserId.value"
              :busy="commands.isBusy.value"
              :releasing="commands.activeCommand.value === 'releaseDrawer'"
              :error-message="errorFor('custody')"
              @release="handleReleaseDrawer"
            />
          </template>

          <!-- «Cerrar caja» (S5): another person with create:CashClosing; the backend decides. -->
          <template #panel-cierre>
            <div v-if="hasSelection" :key="sessionSectionKey" data-testid="cash-close-slot">
              <CashCloseStep
                v-if="detailQuery.detail.value"
                :detail="detailQuery.detail.value"
                :current-user-id="access.currentUserId.value"
                :can-close="access.canClose.value"
                @closed="handleClosed"
                @view-closing="viewClosing"
              />
            </div>
          </template>

          <!-- «Corte de caja» (S5): the frozen snapshot of the closed shift and its PDF. -->
          <template #panel-corte>
            <div :key="sessionSectionKey" data-testid="cash-corte-slot">
              <CashClosingDetail
                v-if="corteClosingId && access.canReadClosings.value"
                :closing-id="corteClosingId"
              />
              <div v-else-if="corteClosingId" class="cash-callout" data-testid="cash-corte-forbidden">
                <UIcon name="i-lucide-lock" class="cash-callout-icon" aria-hidden="true" />
                <p>
                  <strong>Corte {{ detailQuery.detail.value?.closing?.folio }}</strong><br />
                  <span class="cash-meta-wrap"
                    >Necesitas el permiso «Ver cortes» para ver el corte y su PDF.</span
                  >
                </p>
              </div>
              <div v-else class="cash-empty-note">
                <UIcon name="i-lucide-file-text" class="size-5" aria-hidden="true" />
                <p>
                  <strong>El corte aparece al cerrar la caja</strong><br />
                  <span class="cash-meta-wrap"
                    >Incluye folio, totales por canal, entregas, horarios, personas y notas.</span
                  >
                </p>
              </div>
            </div>
          </template>
        </CashTimeline>
      </template>

      <!-- ── Context: summary, «Por recibir», Cortes entry ─────────────── -->
      <template #context>
        <CashWorkspaceShiftCard
          :has-selection="hasSelection"
          :detail="detailQuery.detail.value ?? null"
          :loading="detailQuery.isLoading.value"
          :error="false"
          :is-own-shift="isOwnShift"
          :no-shift-context="shiftContext"
          :opening-active="openPanelId === 'apertura'"
          @request-opening="requestOpening"
          @retry="detailQuery.refetch()"
        />

        <button
          v-if="access.canReadCustody.value"
          type="button"
          class="cash-recv"
          :aria-expanded="openPanelId === 'recepcion'"
          aria-controls="cash-recepcion-title"
          data-testid="cash-receive-entry"
          @click="togglePanel('recepcion')"
        >
          <UIcon name="i-lucide-inbox" class="size-5 shrink-0" aria-hidden="true" />
          <span class="cash-recv-text">
            <span class="cash-strong">Por recibir</span>
            <span class="cash-meta-wrap" data-testid="cash-receive-entry-label">
              {{
                custody.isLoading.value
                  ? 'Cargando…'
                  : pendingForMe > 0
                    ? `${pendingForMe} ${pendingForMe === 1 ? 'entrega' : 'entregas'} por recibir · ${formatCentsMXN(pendingForMeCents)}`
                    : 'Sin entregas por recibir'
              }}
            </span>
          </span>
          <span v-if="pendingForMe > 0" class="cash-pending-badge" aria-hidden="true">{{ pendingForMe }}</span>
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0" aria-hidden="true" />
        </button>

        <!-- «Cortes» (S5): the closings list of the sucursal (read:CashClosing). -->
        <div v-if="access.canReadClosings.value" data-testid="cash-closings-entry-slot">
          <button
            type="button"
            class="cash-recv"
            :aria-expanded="cortesOpen"
            aria-controls="cash-cortes-title"
            data-testid="cash-closings-entry"
            @click="toggleCortes"
          >
            <UIcon name="i-lucide-file-text" class="size-5 shrink-0" aria-hidden="true" />
            <span class="cash-recv-text">
              <span class="cash-strong">Cortes</span>
              <span class="cash-meta-wrap">Cortes de caja con folio y PDF</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>

        <p class="cash-perm">
          <UIcon name="i-lucide-lock" class="size-3.5 shrink-0" aria-hidden="true" />
          {{ permissionNote }}
        </p>
      </template>

      <!-- Phones: the next action in a sticky bar outside the scrolling content. -->
      <!-- Hidden while its task, or «Cortes», is already open (e.g. «Ver corte» over the corte). -->
      <template
        v-if="
          nextAction &&
          nextAction.kind === 'primary' &&
          nextAction.stepId &&
          openPanelId !== nextAction.stepId &&
          !cortesOpen
        "
        #bar
      >
        <UButton
          v-if="nextAction.alt"
          type="button"
          color="neutral"
          variant="outline"
          class="min-h-11 justify-center"
          @click="openPanel(nextAction.alt.stepId)"
        >
          {{ nextAction.alt.label }}
        </UButton>
        <UButton
          type="button"
          class="min-h-11 justify-center"
          @click="nextAction.stepId && openPanel(nextAction.stepId)"
        >
          {{ nextAction.label }}
        </UButton>
      </template>
    </CashWorkspace>
  </section>
</template>
