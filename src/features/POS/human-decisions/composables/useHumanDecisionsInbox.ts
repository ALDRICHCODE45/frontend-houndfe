import { computed, ref } from 'vue'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { HumanDecisionErrorResponse } from '../interfaces/human-decision.types'
import {
  createHumanDecisionResolutionAttempt,
  type HumanDecisionResolutionAttempt,
  type HumanDecisionResolutionInput,
} from '../utils/humanDecisionResolutionAttempt'
import { useHumanDecisionDetail } from './useHumanDecisionDetail'
import { useHumanDecisionsListTable } from './useHumanDecisionsListTable'
import { useResolveHumanDecision } from './useResolveHumanDecision'

const GENERIC_RESOLUTION_ERROR = 'No se pudo registrar la respuesta. Intenta de nuevo.'
const IDEMPOTENCY_ERROR =
  'No se pudo reutilizar este intento. Revisa la respuesta e intenta de nuevo.'

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
  const resolutionErrorMessage = ref<string | null>(null)
  const resolutionConflict = ref(false)
  const resolutionSucceeded = ref(false)
  let activeAttempt: HumanDecisionResolutionAttempt | null = null

  const canUpdate = computed(() => authStore.userCan('update', 'HumanDecision'))

  function openDetail(decisionId: string): void {
    selectedDecisionId.value = decisionId
    detailOpen.value = true
    resolutionErrorMessage.value = null
    resolutionConflict.value = false
    resolutionSucceeded.value = false
    activeAttempt = null
  }

  async function resolveDecision(input: HumanDecisionResolutionInput): Promise<void> {
    if (resolutionConflict.value) return
    if (!canUpdate.value) {
      resolutionErrorMessage.value = 'No tienes permiso para registrar esta respuesta.'
      return
    }

    const decision = detail.data.value
    const actionAllowed =
      decision?.status === 'PENDING' &&
      decision.allowedActions.some((action) => action === input.action)
    if (
      !decision ||
      decision.id !== selectedDecisionId.value ||
      !actionAllowed ||
      decision.version !== input.expectedVersion
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
    retryDetail: detail.refetch,
  }
}
