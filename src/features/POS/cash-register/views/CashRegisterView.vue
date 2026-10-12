<script setup lang="ts">
/**
 * Composition surface for the POS Caja workspace.
 *
 * It wires composables to the task-focused workspace and its existing panels:
 * all feature logic lives in `../composables`, the task/context shell lives in
 * `../components/CashWorkspace*.vue`, and every operation contract is unchanged
 * (registers, session opening, manual movements, blind freeze/count, append-only
 * notes, independent verification, recipient custody discovery, explicit FLOAT
 * and drawer release).
 *
 * Navigation only reveals one task at a time; it never selects a register or a
 * session, never dispatches a command and never implies a required order. Tasks
 * that need a session stay hidden until a shift is explicitly selected, and
 * panels are kept mounted with `v-show` so an in-progress draft survives moving
 * between tasks. Sensitive drafts that are not session-scoped are keyed by the
 * identity scope (and the opening form additionally by its register), so a new
 * actor, permission set or register never inherits another context's draft.
 *
 * Not included (out of authorized scope): sales binding, refund settlement,
 * closure/PDF and any live backend call.
 */
import { computed, ref, watch } from 'vue'
import { useCashAccess } from '../composables/useCashAccess'
import { useCashRegisters } from '../composables/useCashRegisters'
import { useCashSessionDetail, useCashSessions } from '../composables/useCashSessions'
import { useCashSessionCommands } from '../composables/useCashSessionCommands'
import { useCashCustody } from '../composables/useCashCustody'
import { useCashHandoverRecipients } from '../composables/useCashHandoverRecipients'
import { useCashWorkspace, type CashWorkspaceTaskId } from '../composables/useCashWorkspace'
import { CashIdentityError, cashErrorInfo } from '../composables/cashErrorCopy'
import {
  requiredChannelIdentities,
  CASH_CHANNEL_KEY,
  type CashIdentity,
} from '../composables/cashRules'
import type { CashComparison, CashCountPayload } from '../interfaces/cash.types'
import CashWorkspace from '../components/CashWorkspace.vue'
import CashWorkspaceShiftCard from '../components/CashWorkspaceShiftCard.vue'
import '../styles/cash-visual.css'
import CashRegistersPanel from '../components/CashRegistersPanel.vue'
import CashOpenSessionForm from '../components/CashOpenSessionForm.vue'
import CashSessionsPanel from '../components/CashSessionsPanel.vue'
import CashMovementsPanel from '../components/CashMovementsPanel.vue'
import CashCountForm from '../components/CashCountForm.vue'
import CashDeclarationNotesForm from '../components/CashDeclarationNotesForm.vue'
import CashVerificationPanel from '../components/CashVerificationPanel.vue'
import CashCustodyDiscovery from '../components/CashCustodyDiscovery.vue'
import CashCustodyActions from '../components/CashCustodyActions.vue'

const access = useCashAccess()
const registers = useCashRegisters()
const commands = useCashSessionCommands()
const recipients = useCashHandoverRecipients()
const custody = useCashCustody()

const selectedRegisterId = ref<string | null>(null)
const selectedSessionId = ref<string | null>(null)
// A FLOAT chosen for one register must not silently carry over to another.
const openFloatId = ref<string | null>(null)
// The custody receipt currently in flight, so a repeat click is blocked.
const receivingId = ref<string | null>(null)

const sessionParams = computed(() => ({
  page: 1,
  limit: 25,
  ...(selectedRegisterId.value ? { registerId: selectedRegisterId.value } : {}),
}))

const sessions = useCashSessions(sessionParams)
const detailQuery = useCashSessionDetail(selectedSessionId)

// One presentation channel for command feedback; each panel receives only its
// own scope so a stale error from another panel is never shown.
const errorScope = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const declareComparison = ref<CashComparison | null>(null)
const verifyComparison = ref<CashComparison | null>(null)

/**
 * Monotonic token for the explicitly selected shift context. Every explicit
 * selection change — another register, another shift, or an identity reset —
 * invalidates it, so a late command result can only be applied to the exact
 * selection that started it and is never reused after A → B → A. The same
 * boundary drops the stored contextual feedback (errorScope/errorMessage), so a
 * banner from the previous context is never shown for the new one.
 */
let sessionContextToken = 0

function invalidateSessionContext(): void {
  sessionContextToken += 1
  errorScope.value = null
  errorMessage.value = null
}

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

watch(identityScope, () => {
  invalidateSessionContext()
  selectedRegisterId.value = null
  selectedSessionId.value = null
  openFloatId.value = null
  receivingId.value = null
  declareComparison.value = null
  verifyComparison.value = null
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

const pendingReceiveCount = computed(
  () => (detailQuery.detail.value?.handovers ?? []).filter((item) => !item.receivedAt).length,
)

/** `null` while there is no selected shift or no authenticated actor to compare with. */
const isOwnShift = computed<boolean | null>(() => {
  const cashier = session.value?.cashierUserId
  const current = access.currentUserId.value
  if (!cashier || !current) return null
  return cashier === current
})

/**
 * Task availability for the CURRENT abilities and the explicitly selected
 * shift. A task is offered only when it has something real to do; nothing is
 * fabricated and no task waits on another one.
 */
function isTaskAvailable(taskId: CashWorkspaceTaskId): boolean {
  switch (taskId) {
    case 'apertura':
      return access.canReadRegisters.value || access.canOpenSession.value
    case 'historial':
      return access.canReadSessions.value
    case 'recepcion':
      return access.canReadCustody.value
    case 'conteo':
      return (
        Boolean(selectedSessionId.value) &&
        access.canCount.value &&
        (session.value?.status === 'OPEN' || isFrozenBlind.value)
      )
    case 'notas':
      return Boolean(selectedSessionId.value) && access.canCount.value && isSubmitted.value
    case 'movimientos':
    case 'verificacion':
    case 'custodia':
      return Boolean(selectedSessionId.value)
    default:
      return false
  }
}

const { visibleTasks, activeTaskId, selectTask } = useCashWorkspace({
  isAvailable: (taskId) => isTaskAvailable(taskId),
  // The session list is the caller's own unless the audit grant widens it.
  labelFor: (task) =>
    task.id === 'historial' && !sessions.canFilterByCashier.value ? 'Mis sesiones' : task.label,
  defaultTaskId: 'apertura',
})

function selectRegister(registerId: string) {
  invalidateSessionContext()
  selectedRegisterId.value = registerId
  selectedSessionId.value = null
  openFloatId.value = null
  declareComparison.value = null
  verifyComparison.value = null
}

function selectSession(sessionId: string) {
  invalidateSessionContext()
  selectedSessionId.value = sessionId
  declareComparison.value = null
  verifyComparison.value = null
}

function handleCreateRegister(name: string) {
  return withIdentityGuard('registers', 'No se pudo crear la caja. Reintenta.', async () => {
    await registers.createRegister({ name })
  })
}

function handleUpdateRegister(id: string, payload: { name?: string; isActive?: boolean }) {
  return withIdentityGuard('registers', 'No se pudo actualizar la caja. Reintenta.', async () => {
    await registers.updateRegister(id, payload)
  })
}

function handleOpenSession(payload: { openingCents: number; openingHandoverId?: string }) {
  return withIdentityGuard('open', 'No se pudo abrir la sesión. Reintenta.', async () => {
    // Captured once, before the request: a stale promise must never select an
    // old session for the new user.
    const registerId = selectedRegisterId.value
    if (!registerId) return
    const opened = await commands.openSession(registerId, payload)
    selectSession(opened.session.id)
    await Promise.all([sessions.refetch(), registers.refetch(), custody.refetch()])
  })
}

function handleMovement(payload: {
  kind: 'CASH_IN' | 'CASH_OUT'
  amountCents: number
  reason: string
}) {
  return withIdentityGuard(
    'movements',
    'No se pudo registrar el movimiento. Reintenta.',
    async () => {
      const sessionId = selectedSessionId.value
      if (!sessionId) return
      const body = { amountCents: payload.amountCents, reason: payload.reason }
      if (payload.kind === 'CASH_IN') {
        await commands.cashIn(sessionId, body)
      } else {
        await commands.cashOut(sessionId, body)
      }
    },
  )
}

function handleFreeze() {
  return withIdentityGuard('freeze', 'No se pudo iniciar el conteo. Reintenta.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.startCount(sessionId)
    await Promise.all([detailQuery.refetch(), sessions.refetch()])
  })
}

function handleDeclare(payload: CashCountPayload) {
  return withIdentityGuard('declare', 'No se pudo enviar la declaración. Reintenta.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    // A comparison belongs to the shift that was selected when it was requested;
    // a switch while it was in flight leaves it stale and unrendered.
    const result = await runForSelectedSession(sessionId, () =>
      commands.declare(sessionId, payload),
    )
    if (result === null) return
    declareComparison.value = result.comparison
    await Promise.all([detailQuery.refetch(), sessions.refetch()])
  })
}

function handleAppendNotes(notes: string) {
  return withIdentityGuard('notes', 'No se pudo agregar la nota. Reintenta.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.appendNotes(sessionId, notes)
    await detailQuery.refetch()
  })
}

function handleVerify(payload: CashCountPayload) {
  return withIdentityGuard('verify', 'No se pudo enviar la verificación. Reintenta.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    // Same shift-scoped rule as the declaration: never render B's comparison
    // from a request that was started for A.
    const result = await runForSelectedSession(sessionId, () => commands.verify(sessionId, payload))
    if (result === null) return
    verifyComparison.value = result.comparison
    await Promise.all([detailQuery.refetch(), sessions.refetch()])
  })
}

function handleReceive(payload: { id: string; receivedCents: number; notes?: string }) {
  receivingId.value = payload.id
  return withIdentityGuard('custody', 'No se pudo registrar la recepción. Reintenta.', async () => {
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
  return withIdentityGuard('custody', 'No se pudo declarar la entrega. Reintenta.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.declareHandover(sessionId, payload)
    await Promise.all([detailQuery.refetch(), custody.refetch()])
  })
}

function handleReleaseDrawer() {
  return withIdentityGuard('custody', 'No se pudo liberar el cajón. Reintenta.', async () => {
    const sessionId = selectedSessionId.value
    if (!sessionId) return
    await commands.releaseDrawer(sessionId)
    await Promise.all([detailQuery.refetch(), custody.refetch()])
  })
}
</script>

<template>
  <section class="cash-visual cash-page flex flex-col gap-6 md:px-10">
    <UCard
      v-if="!access.canAnyCashRead.value"
      :ui="{ body: 'p-4 sm:p-5' }"
      data-testid="cash-access-denied"
    >
      <h1 class="text-lg font-semibold text-highlighted">Caja</h1>
      <p class="mt-1 text-sm text-muted">
        No tienes permisos de caja. Pídele a la persona administradora que asigne los permisos de
        caja en tu rol.
      </p>
    </UCard>

    <CashWorkspace
      v-else
      :key="identityScope"
      title="Caja"
      subtitle="Opera la caja por tareas: apertura, movimientos, conteo ciego, verificación y custodia. Elige la tarea que necesites."
      :tasks="visibleTasks"
      :active-task-id="activeTaskId"
      @select-task="selectTask"
    >
      <template #shift>
        <CashWorkspaceShiftCard
          :has-selection="Boolean(selectedSessionId)"
          :detail="detailQuery.detail.value ?? null"
          :loading="detailQuery.isLoading.value"
          :error="detailQuery.isError.value"
          :is-own-shift="isOwnShift"
          @request-sessions="selectTask('historial')"
          @request-opening="selectTask('apertura')"
        />
      </template>

      <!-- Apertura: cajas existentes y apertura de sesión. -->
      <div
        v-show="activeTaskId === 'apertura'"
        class="flex flex-col gap-6"
        data-testid="cash-task-apertura"
      >
        <CashRegistersPanel
          v-if="access.canReadRegisters.value"
          :registers="registers.registers.value"
          :selected-register-id="selectedRegisterId"
          :loading="registers.isLoading.value"
          :error="registers.isError.value"
          :can-create="access.canCreateRegister.value"
          :can-update="access.canUpdateRegister.value"
          :can-open="access.canOpenSession.value"
          :creating="registers.creating.value"
          :updating="registers.updating.value"
          :error-message="errorFor('registers') ?? undefined"
          @select="selectRegister"
          @create="handleCreateRegister"
          @update="handleUpdateRegister"
          @refresh="registers.refetch()"
        />

        <CashOpenSessionForm
          v-if="access.canOpenSession.value"
          :key="`open:${selectedRegisterId ?? 'none'}`"
          :register-id="selectedRegisterId"
          :register-name="
            registers.registers.value.find((item) => item.id === selectedRegisterId)?.name ?? null
          "
          :eligible-float="custody.eligibleFloat.value"
          :custody-visible="custody.allowed.value"
          v-model:float-id="openFloatId"
          :can-open="access.canOpenSession.value"
          :submitting="commands.activeCommand.value === 'open'"
          :error-message="errorFor('open')"
          @submit="handleOpenSession"
        />
      </div>

      <!-- Sesiones: la lista existente, alcance real del permiso. -->
      <div v-show="activeTaskId === 'historial'" data-testid="cash-task-historial">
        <CashSessionsPanel
          v-if="access.canReadSessions.value"
          :sessions="sessions.sessions.value"
          :selected-session-id="selectedSessionId"
          :loading="sessions.isLoading.value"
          :fetching="sessions.isFetching.value"
          :error="sessions.isError.value"
          :can-filter-by-cashier="sessions.canFilterByCashier.value"
          :page="sessions.page.value"
          :limit="sessions.limit.value"
          :total="sessions.total.value"
          @select="selectSession"
          @refresh="sessions.refetch()"
        />
      </div>

      <!-- Tareas que dependen de una sesión seleccionada explícitamente. -->
      <div
        v-if="selectedSessionId"
        :key="sessionSectionKey"
        class="flex flex-col gap-6"
        data-testid="cash-session-tasks"
      >
        <div
          v-show="activeTaskId === 'movimientos'"
          class="flex flex-col gap-6"
          data-testid="cash-task-movimientos"
        >
          <CashMovementsPanel
            :detail="detailQuery.detail.value ?? null"
            :current-user-id="access.currentUserId.value"
            :can-cash-in="access.canCashIn.value"
            :can-cash-out="access.canCashOut.value"
            :submitting="
              commands.activeCommand.value === 'cashIn' ||
              commands.activeCommand.value === 'cashOut'
            "
            :error-message="errorFor('movements')"
            @submit="handleMovement"
          />
        </div>

        <div
          v-show="activeTaskId === 'conteo'"
          class="flex flex-col gap-6"
          data-testid="cash-task-conteo"
        >
          <div
            v-if="session?.status === 'OPEN' && access.canCount.value"
            class="flex flex-col gap-2"
          >
            <UButton
              type="button"
              class="min-h-11 self-start"
              :loading="commands.activeCommand.value === 'freeze'"
              data-testid="cash-session-freeze"
              @click="handleFreeze"
            >
              Iniciar conteo (congelar)
            </UButton>
            <p class="text-xs text-muted">
              Congelar detiene los movimientos operativos; no libera el cajón.
            </p>
            <p v-if="errorFor('freeze')" class="text-sm text-error" data-testid="cash-freeze-error">
              {{ errorFor('freeze') }}
            </p>
          </div>

          <CashCountForm
            v-if="isFrozenBlind && access.canCount.value"
            :channels="countChannels"
            :submitting="commands.activeCommand.value === 'declare'"
            :error-message="errorFor('declare')"
            @submit="handleDeclare"
          />
        </div>

        <div
          v-show="activeTaskId === 'notas'"
          class="flex flex-col gap-6"
          data-testid="cash-task-notas"
        >
          <CashDeclarationNotesForm
            v-if="isSubmitted && access.canCount.value"
            :submitting="commands.activeCommand.value === 'notes'"
            :error-message="errorFor('notes')"
            @submit="handleAppendNotes"
          />
        </div>

        <div
          v-show="activeTaskId === 'verificacion'"
          class="flex flex-col gap-6"
          data-testid="cash-task-verificacion"
        >
          <CashVerificationPanel
            :detail="detailQuery.detail.value ?? null"
            :can-verify="access.canVerifyIndependent.value"
            :current-user-id="access.currentUserId.value"
            :submitting="commands.activeCommand.value === 'verify'"
            :comparison="verificationComparison"
            :error-message="errorFor('verify')"
            @submit="handleVerify"
          />
        </div>

        <div
          v-show="activeTaskId === 'custodia'"
          class="flex flex-col gap-6"
          data-testid="cash-task-custodia"
        >
          <CashCustodyActions
            :session-id="selectedSessionId"
            :can-declare-handover="access.canDeclareHandover.value"
            :can-release-drawer="access.canDeclareHandover.value"
            :drawer-released="Boolean(session?.drawerReleasedAt)"
            :pending-receive-count="pendingReceiveCount"
            :counted-cash-cents="countedCashCents"
            :selector-entitled="recipients.entitled.value"
            :assignable-users="recipients.assignableUsers.value"
            :loading-recipients="recipients.isLoading.value"
            :current-user-id="access.currentUserId.value"
            :busy="commands.isBusy.value"
            :submitting="commands.activeCommand.value === 'declareHandover'"
            :releasing="commands.activeCommand.value === 'releaseDrawer'"
            :error-message="errorFor('custody')"
            @declare="handleDeclareHandover"
            @release="handleReleaseDrawer"
          />
        </div>
      </div>

      <!-- Recepciones: solo la custodia destinada a la persona autenticada. -->
      <div v-show="activeTaskId === 'recepcion'" data-testid="cash-task-recepcion">
        <CashCustodyDiscovery
          v-if="access.canReadCustody.value"
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
      </div>
    </CashWorkspace>
  </section>
</template>
