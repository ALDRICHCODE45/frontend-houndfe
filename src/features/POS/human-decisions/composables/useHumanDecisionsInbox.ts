import { computed, getCurrentScope, onScopeDispose, ref, watch } from 'vue'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { HumanDecisionErrorResponse } from '../interfaces/human-decision.types'
import {
  createHumanDecisionResolutionAttempt,
  type HumanDecisionResolutionAttempt,
  type HumanDecisionResolutionInput,
} from '../utils/humanDecisionResolutionAttempt'
import type { ExpirationDecisionResolutionInput } from '../utils/expirationResolutionAttempt'
import { useHumanDecisionDetail } from './useHumanDecisionDetail'
import { useHumanDecisionsListTable } from './useHumanDecisionsListTable'
import {
  useResolveExpirationDecision,
  type ExpirationDecisionDispatchOutcome,
} from './useResolveExpirationDecision'
import { useResolveHumanDecision } from './useResolveHumanDecision'

const GENERIC_RESOLUTION_ERROR = 'No se pudo registrar la respuesta. Intenta de nuevo.'
const IDEMPOTENCY_ERROR =
  'No se pudo reutilizar este intento. Revisa la respuesta e intenta de nuevo.'
const EXPIRATION_SESSION_EXPIRED_ERROR =
  'Tu sesión expiró. Inicia sesión de nuevo para registrar la respuesta.'
const EXPIRATION_IDLE = {
  message: null as string | null,
  conflict: false,
  succeeded: false,
  requiresReauthentication: false,
}

function errorCode(error: unknown): HumanDecisionErrorResponse['code'] | undefined {
  return (error as AxiosError<HumanDecisionErrorResponse>).response?.data.code
}

function matchesAttempt(
  attempt: HumanDecisionResolutionAttempt,
  decisionId: string,
  input: HumanDecisionResolutionInput,
): boolean {
  const payload = attempt.payload
  if (
    attempt.decisionId !== decisionId ||
    payload.action !== input.action ||
    payload.expectedVersion !== input.expectedVersion
  ) {
    return false
  }
  return (
    input.action === 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE' ||
    (payload.action === 'PROVIDE_RESTOCK_ESTIMATE' && payload.restockDays === input.restockDays)
  )
}

export function useHumanDecisionsInbox(generateId: () => string = () => crypto.randomUUID()) {
  const authStore = useAuthStore()
  const list = useHumanDecisionsListTable()
  const selectedDecisionId = ref<string | null>(null)
  const detailOpen = ref(false)
  const detail = useHumanDecisionDetail(selectedDecisionId)
  const resolution = useResolveHumanDecision()
  const expiration = useResolveExpirationDecision()
  const expirationState = ref({ token: null as symbol | null, feedback: EXPIRATION_IDLE })
  const expirationErrorMessage = computed(() => expirationState.value.feedback.message)
  const expirationConflict = computed(() => expirationState.value.feedback.conflict)
  const expirationSucceeded = computed(() => expirationState.value.feedback.succeeded)
  const expirationRequiresReauthentication = computed(
    () => expirationState.value.feedback.requiresReauthentication,
  )
  const expirationResolving = computed(
    () => expirationState.value.token !== null || expiration.isPending.value,
  )
  const resolutionErrorMessage = ref<string | null>(null)
  const resolutionConflict = ref(false)
  const resolutionSucceeded = ref(false)
  let activeAttempt: HumanDecisionResolutionAttempt | null = null
  let inboxDisposed = false

  function resetExpirationState(): void {
    expirationState.value = { token: null, feedback: EXPIRATION_IDLE }
  }

  function settleExpirationState(token: symbol, patch: Partial<typeof EXPIRATION_IDLE> = {}): void {
    if (expirationState.value.token !== token) return
    expirationState.value = { token: null, feedback: { ...EXPIRATION_IDLE, ...patch } }
  }

  const canUpdate = computed(() => authStore.userCan('update', 'HumanDecision'))

  watch(
    [
      () => selectedDecisionId.value,
      () => detailOpen.value,
      canUpdate,
      () => authStore.user?.id ?? null,
      () => authStore.currentTenantId,
    ],
    () => {
      resetExpirationState()
    },
    { flush: 'sync' },
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      inboxDisposed = true
      resetExpirationState()
    })
  }

  function openDetail(decisionId: string): void {
    selectedDecisionId.value = decisionId
    detailOpen.value = true
    resolutionErrorMessage.value = null
    resolutionConflict.value = false
    resolutionSucceeded.value = false
    activeAttempt = null
    resetExpirationState()
  }

  function currentExpirationId(input: ExpirationDecisionResolutionInput): string | null {
    const decision = detail.data.value
    if (
      !decision ||
      decision.type !== 'EXPIRATION' ||
      decision.status !== 'PENDING' ||
      decision.id !== selectedDecisionId.value ||
      decision.version !== input.expectedVersion ||
      !decision.allowedActions.some((action) => action === input.action)
    ) {
      return null
    }
    return decision.id
  }

  function expirationOutcomeFeedback(
    outcome: ExpirationDecisionDispatchOutcome,
  ): Partial<typeof EXPIRATION_IDLE> {
    if (outcome.status === 'resolved') return { succeeded: true }
    if (outcome.status === 'blocked') {
      if (outcome.reason === 'unauthenticated') {
        return { message: EXPIRATION_SESSION_EXPIRED_ERROR, requiresReauthentication: true }
      }
      return outcome.reason === 'invalid-input' ? { message: GENERIC_RESOLUTION_ERROR } : {}
    }
    if (outcome.status !== 'rejected') return {}
    if (expiration.requiresReauthentication.value) {
      return { message: EXPIRATION_SESSION_EXPIRED_ERROR, requiresReauthentication: true }
    }
    const error = expiration.error.value as { response?: { data?: { code?: string } } } | null
    const code = error?.response?.data?.code
    if (code === 'VERSION_CONFLICT' || code === 'ALREADY_RESOLVED') return { conflict: true }
    if (code === 'IDEMPOTENCY_CONFLICT') return { message: IDEMPOTENCY_ERROR }
    return { message: GENERIC_RESOLUTION_ERROR }
  }

  async function resolveExpirationDecision(
    input: ExpirationDecisionResolutionInput,
  ): Promise<void> {
    if (inboxDisposed || !detailOpen.value) return
    if (expirationConflict.value || expirationResolving.value) return

    const token = Symbol('expiration-inbox')
    expirationState.value = { token, feedback: EXPIRATION_IDLE }
    if (expirationState.value.token !== token) return

    if (!canUpdate.value) {
      settleExpirationState(token, {
        message: 'No tienes permiso para registrar esta respuesta.',
      })
      return
    }
    const decisionId = currentExpirationId(input)
    if (decisionId === null) {
      settleExpirationState(token, { message: 'Esta respuesta ya no está disponible.' })
      return
    }

    const outcome = await expiration.dispatch(decisionId, input)
    if (expirationState.value.token !== token) return
    settleExpirationState(token, expirationOutcomeFeedback(outcome))
  }

  async function resolveDecision(input: HumanDecisionResolutionInput): Promise<void> {
    if (resolutionConflict.value) return
    if (!canUpdate.value) {
      resolutionErrorMessage.value = 'No tienes permiso para registrar esta respuesta.'
      return
    }

    const decision = detail.data.value
    if (
      !decision ||
      decision.type !== 'RESTOCK' ||
      decision.status !== 'PENDING' ||
      decision.id !== selectedDecisionId.value ||
      decision.version !== input.expectedVersion ||
      !decision.allowedActions.some((action) => action === input.action)
    ) {
      resolutionErrorMessage.value = 'Esta respuesta ya no está disponible.'
      return
    }

    const attempt =
      activeAttempt && matchesAttempt(activeAttempt, decision.id, input)
        ? activeAttempt
        : createHumanDecisionResolutionAttempt(decision.id, input, generateId)
    activeAttempt = attempt
    resolutionErrorMessage.value = null
    resolutionSucceeded.value = false

    try {
      await resolution.mutateAsync(attempt)
      activeAttempt = null
      resolutionSucceeded.value = true
    } catch (error) {
      const code = errorCode(error)
      if (code === 'VERSION_CONFLICT' || code === 'ALREADY_RESOLVED') {
        activeAttempt = null
        resolutionConflict.value = true
        return
      }
      if (code === 'IDEMPOTENCY_CONFLICT') {
        activeAttempt = null
        resolutionErrorMessage.value = IDEMPOTENCY_ERROR
        return
      }
      resolutionErrorMessage.value = GENERIC_RESOLUTION_ERROR
    }
  }

  return {
    list,
    detail,
    detailOpen,
    selectedDecisionId,
    canUpdate,
    resolving: resolution.isPending,
    resolutionErrorMessage,
    resolutionConflict,
    resolutionSucceeded,
    openDetail,
    resolveDecision,
    expirationResolving,
    expirationErrorMessage,
    expirationConflict,
    expirationSucceeded,
    expirationRequiresReauthentication,
    resolveExpirationDecision,
    retryDetail: detail.refetch,
  }
}
