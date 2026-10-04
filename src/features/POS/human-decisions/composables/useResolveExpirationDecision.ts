// EXPIRATION context-bound resolution owner — isolated, never starts cache fetches;
// fences every effect on the origin context/token and finalizes after cleanup.
import { getCurrentScope, onScopeDispose, readonly, shallowRef, watch, type Ref } from 'vue'
import { useQueryClient, type QueryKey } from '@tanstack/vue-query'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../api/human-decision.api'
import type { ResolvedExpirationDecision } from '../interfaces/expiration-decision.types'
import {
  prepareExpirationDecisionResolutionAttempt,
  type ExpirationDecisionResolutionAttempt,
  type ExpirationDecisionResolutionInput,
} from '../utils/expirationResolutionAttempt'

export type ExpirationDecisionDispatchOutcome =
  | { status: 'resolved'; decision: ResolvedExpirationDecision }
  | { status: 'rejected' }
  | { status: 'discarded' }
  | { status: 'blocked'; reason: 'disposed' | 'unauthenticated' | 'busy' | 'invalid-input' }

export interface UseResolveExpirationDecisionResult {
  dispatch: (
    decisionId: string,
    input: ExpirationDecisionResolutionInput,
  ) => Promise<ExpirationDecisionDispatchOutcome>
  isPending: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
  requiresReauthentication: Readonly<Ref<boolean>>
}

type DispatchContext = { epoch: number; userId: string; tenantId: string }

const statusOf = (error: unknown) =>
  (error as { response?: { status?: number } } | null)?.response?.status
const conflictCode = (error: unknown) =>
  (error as { response?: { data?: { code?: string } } } | null)?.response?.data?.code

export function useResolveExpirationDecision(): UseResolveExpirationDecisionResult {
  const authStore = useAuthStore()
  const queryClient = useQueryClient()
  let disposed = false
  let contextEpoch = 0
  let activeRequestToken: symbol | null = null
  let retainedAttempt: ExpirationDecisionResolutionAttempt | null = null
  const isPending = shallowRef(false)
  const error = shallowRef<unknown>(null)
  const requiresReauthentication = shallowRef(false)
  const readUserId = () => authStore.user?.id ?? null
  const readTenantId = () => authStore.currentTenantId

  watch(
    [readUserId, readTenantId],
    () => {
      contextEpoch++
      retainedAttempt = null
      activeRequestToken = null
      isPending.value = false
      error.value = null
      requiresReauthentication.value = false
    },
    { flush: 'sync' },
  )

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      activeRequestToken = null
      isPending.value = false
    })
  }

  function captureContext(): DispatchContext | null {
    const userId = readUserId()
    const tenantId = readTenantId()
    if (userId === null || tenantId === '') return null
    return { epoch: contextEpoch, userId, tenantId }
  }

  function isContextCurrent(context: DispatchContext): boolean {
    return (
      !disposed &&
      contextEpoch === context.epoch &&
      readUserId() === context.userId &&
      readTenantId() === context.tenantId
    )
  }

  const owns = (context: DispatchContext, token: symbol) =>
    activeRequestToken === token && isContextCurrent(context)

  async function runCacheEffect(effect: () => unknown): Promise<void> {
    try {
      await effect()
    } catch {
      // Cache maintenance is best-effort; it must never change the transport outcome.
    }
  }

  async function staleRelatedCaches(context: DispatchContext, token: symbol, detailKey: QueryKey) {
    for (const queryKey of [humanDecisionQueryKeys.listPrefix(context.tenantId), detailKey]) {
      if (!owns(context, token)) return
      await runCacheEffect(() => queryClient.invalidateQueries({ queryKey, refetchType: 'none' }))
    }
  }

  async function dispatch(
    decisionId: string,
    input: ExpirationDecisionResolutionInput,
  ): Promise<ExpirationDecisionDispatchOutcome> {
    if (disposed) return { status: 'blocked', reason: 'disposed' }
    const context = captureContext()
    if (context === null) return { status: 'blocked', reason: 'unauthenticated' }
    if (activeRequestToken !== null) return { status: 'blocked', reason: 'busy' }
    const prepared = prepareExpirationDecisionResolutionAttempt(decisionId, input, retainedAttempt)
    if (!prepared.ok) return { status: 'blocked', reason: 'invalid-input' }

    const token = Symbol('expiration-resolution')
    const detailKey = humanDecisionQueryKeys.detail(context.tenantId, decisionId)
    activeRequestToken = token
    retainedAttempt = prepared.attempt
    isPending.value = true
    error.value = null
    requiresReauthentication.value = false
    if (!owns(context, token)) return { status: 'discarded' }

    let outcome: ExpirationDecisionDispatchOutcome = { status: 'discarded' }
    try {
      const decision = await humanDecisionApi.resolveExpiration(
        decisionId,
        prepared.attempt.payload,
      )
      if (!owns(context, token)) return { status: 'discarded' }
      retainedAttempt = null
      await runCacheEffect(() => queryClient.setQueryData(detailKey, decision))
      if (!owns(context, token)) return { status: 'discarded' }
      await staleRelatedCaches(context, token, detailKey)
      if (!owns(context, token)) return { status: 'discarded' }
      outcome = { status: 'resolved', decision }
    } catch (caught) {
      if (!owns(context, token)) return { status: 'discarded' }
      error.value = caught
      if (!owns(context, token)) return { status: 'discarded' }
      requiresReauthentication.value = statusOf(caught) === 401
      if (!owns(context, token)) return { status: 'discarded' }
      if (statusOf(caught) === 409) {
        retainedAttempt = null
        const code = conflictCode(caught)
        if (code === 'VERSION_CONFLICT' || code === 'ALREADY_RESOLVED') {
          await staleRelatedCaches(context, token, detailKey)
          if (!owns(context, token)) return { status: 'discarded' }
        }
      }
      outcome = { status: 'rejected' }
    } finally {
      if (activeRequestToken === token) {
        activeRequestToken = null
        isPending.value = false
      }
    }
    // Cleanup can synchronously switch context; only now is the outcome valid.
    return isContextCurrent(context) ? outcome : { status: 'discarded' }
  }

  return {
    dispatch,
    isPending: readonly(isPending),
    error: readonly(error),
    requiresReauthentication: readonly(requiresReauthentication),
  }
}
