/**
 * Cash sessions: principal-scoped list and detail reads.
 *
 * Scope contract (backend handoff):
 *   - `GET /cash-sessions` returns the caller's own sessions unless
 *     `read:CashSessionAudit` widens the scope.
 *   - `cashierUserId` is applied BEFORE permission visibility, so filtering by
 *     another cashier without audit returns no rows rather than ignoring the
 *     filter. The UI therefore never sends that filter without the audit grant.
 *   - Detail is reachable with `read:CashSession`; another cashier's session
 *     additionally needs `read:CashSessionAudit`.
 *
 * SECURITY: visibility is principal-dependent, so the cache slot is scoped by
 * tenant + user + permission generation (never tenant alone), and the detail
 * query reads the identity IT CAPTURED — never the live selection or the live
 * principal — after the async boundary.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import type {
  CashSessionDetail,
  CashSessionListParams,
  CashSessionListResponse,
} from '../interfaces/cash.types'
import { cashQueryKeys, type CashCacheScope } from './cashQueryKeys'
import { useCashAccess } from './useCashAccess'
import { isSameCashIdentity, type CashIdentity } from './cashRules'
import { CashIdentityError } from './cashErrorCopy'

interface CapturedDetailContext {
  scope: CashCacheScope
  sessionId: string
}

/**
 * Read the validated detail identity from the captured key. `enabled` guards
 * automatic reads only, so manual refetches still run this and never fall back
 * to a live ref.
 */
function readDetailContext(queryKey: readonly unknown[]): CapturedDetailContext {
  // Key layout:
  // ['cash', tenantId, userId, permissionFingerprint, generation, 'sessions', 'detail', id]
  const [, tenantId, userId, permissionFingerprint, generation, resource, slot, sessionId] =
    queryKey
  if (
    resource !== 'sessions' ||
    slot !== 'detail' ||
    typeof tenantId !== 'string' ||
    !tenantId ||
    typeof userId !== 'string' ||
    !userId ||
    typeof permissionFingerprint !== 'string' ||
    typeof generation !== 'string' ||
    !/^\d+$/.test(generation) ||
    typeof sessionId !== 'string' ||
    !sessionId
  ) {
    throw new CashIdentityError('changed')
  }
  return {
    scope: { tenantId, userId, permissionFingerprint, generation: Number(generation) },
    sessionId,
  }
}

export function useCashSessions(params: MaybeRefOrGetter<CashSessionListParams> = {}) {
  const access = useCashAccess()
  const canAudit = computed(() => access.canAuditSessions.value)

  /**
   * The audit gate is applied to the outbound params, not just to the control:
   * a `cashierUserId` filter can never travel without `read:CashSessionAudit`.
   */
  const effectiveParams = computed<CashSessionListParams>(() => {
    const source = toValue(params) ?? {}
    if (canAudit.value) return { ...source }
    // Only the audit grant may request another cashier's rows; drop the filter
    // instead of failing it server-side.
    const { cashierUserId: _cashierFilter, ...withoutCashier } = source
    return withoutCashier
  })

  const listQuery = useQuery<CashSessionListResponse>({
    queryKey: computed(() =>
      cashQueryKeys.sessionsList(access.identity.value, effectiveParams.value),
    ),
    queryFn: () => cashApi.listSessions(effectiveParams.value),
    enabled: computed(
      () =>
        access.canReadSessions.value &&
        access.identityReady.value &&
        access.permissionsLoaded.value,
    ),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  })

  return {
    sessions: computed(() => listQuery.data.value?.items ?? []),
    total: computed(() => listQuery.data.value?.total ?? 0),
    page: computed(() => listQuery.data.value?.page ?? effectiveParams.value.page ?? 1),
    limit: computed(() => listQuery.data.value?.limit ?? effectiveParams.value.limit ?? 25),
    effectiveParams,
    /** Whether the cashier filter may be used at all. */
    canFilterByCashier: canAudit,
    isLoading: computed(() => listQuery.isLoading.value),
    isFetching: computed(() => listQuery.isFetching.value),
    isError: computed(() => listQuery.isError.value),
    error: listQuery.error,
    refetch: listQuery.refetch,
  }
}

export function useCashSessionDetail(sessionId: MaybeRefOrGetter<string | null>) {
  const access = useCashAccess()
  const id = computed(() => toValue(sessionId))

  const query = useQuery<CashSessionDetail>({
    queryKey: computed(() => cashQueryKeys.sessionDetail(access.identity.value, id.value ?? '')),
    queryFn: ({ queryKey }) => {
      const captured = readDetailContext(queryKey)
      if (!isSameCashIdentity(captured.scope, access.identity.value as CashIdentity)) {
        // The principal changed since this slot was created: never dispatch, and
        // never write the old principal's payload anywhere.
        throw new CashIdentityError('changed')
      }
      return cashApi.getSession(captured.sessionId)
    },
    enabled: computed(
      () =>
        access.canReadSessions.value &&
        access.identityReady.value &&
        access.permissionsLoaded.value &&
        Boolean(id.value),
    ),
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  return {
    detail: query.data,
    isLoading: computed(() => query.isLoading.value),
    isFetching: computed(() => query.isFetching.value),
    isError: computed(() => query.isError.value),
    error: query.error,
    refetch: query.refetch,
  }
}
