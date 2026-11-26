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
  CashSession,
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
    effectiveParams,
    /** Whether the cashier filter may be used at all. */
    canFilterByCashier: canAudit,
    isLoading: computed(() => listQuery.isLoading.value),
    isFetching: computed(() => listQuery.isFetching.value),
    isError: computed(() => listQuery.isError.value),
    /** The list for the CURRENT key has loaded (drives the «Tu turno» default). */
    isSuccess: computed(() => listQuery.isSuccess.value),
    error: listQuery.error,
    refetch: listQuery.refetch,
  }
}

/** Lifecycle states of a shift that can still be «Tu turno» (the drawer is held). */
const OWN_SHIFT_STATUSES: CashSession['status'][] = ['OPEN', 'COUNTING', 'SUBMITTED']

/**
 * «Tu turno» (S7, handoff 25 §2): `GET /cash-sessions?status=OPEN,COUNTING,
 * SUBMITTED&drawerOpen=true&limit=1`, newest first. Without
 * `read:CashSessionAudit` the backend already scopes the list to my sessions;
 * with it the scope is the branch, so `cashierUserId=<me>` narrows it. The row is
 * still checked (mine, drawer held) before it is offered: the backend decides
 * the filter, the UI never shows another person's shift as «Tu turno».
 */
export function useCashOwnShift() {
  const access = useCashAccess()

  const params = computed<CashSessionListParams>(() => ({
    status: [...OWN_SHIFT_STATUSES],
    drawerOpen: true,
    limit: 1,
    ...(access.canAuditSessions.value && access.currentUserId.value
      ? { cashierUserId: access.currentUserId.value }
      : {}),
  }))

  const query = useQuery<CashSessionListResponse>({
    queryKey: computed(() => cashQueryKeys.sessionsList(access.identity.value, params.value)),
    queryFn: () => cashApi.listSessions(params.value),
    enabled: computed(
      () =>
        access.canReadSessions.value &&
        access.identityReady.value &&
        access.permissionsLoaded.value,
    ),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  })

  const ownShift = computed<CashSession | null>(() => {
    const me = access.currentUserId.value
    const first = query.data.value?.items[0]
    if (!me || !first) return null
    if (first.cashierUserId !== me || first.drawerReleasedAt !== null) return null
    if (!OWN_SHIFT_STATUSES.includes(first.status)) return null
    return first
  })

  return {
    ownShift,
    params,
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    /** The read for the CURRENT key has loaded (drives the default selection). */
    isSuccess: computed(() => query.isSuccess.value),
    refetch: query.refetch,
  }
}

/** The backend list cap (`CASH_LIST_MAX_LIMIT`): one page holds every held drawer. */
const HELD_DRAWERS_LIMIT = 100

/**
 * Registers that cannot be opened (cash-picker-unreleased S2/S3): the backend
 * refuses `POST /cash-sessions` with `CASH_REGISTER_UNRELEASED_SESSION` while
 * ANY session of the register has `drawerReleasedAt = null` (OPEN, COUNTING,
 * SUBMITTED…). `GET /cash-sessions?drawerOpen=true&limit=100` lists exactly those,
 * newest first, so the first row per register is the one to show.
 *
 * Visibility follows the list scope: with `read:CashSessionAudit` it is the
 * branch (`complete`), without it only the caller's own sessions — another
 * person's held drawer stays invisible and the server remains the judge. A
 * truncated page (`total` above the rows) is likewise not complete. Only read
 * while the user may open (`create:CashSession`), the one place it is shown.
 */
export function useCashUnreleasedSessions() {
  const access = useCashAccess()

  const params: CashSessionListParams = { drawerOpen: true, limit: HELD_DRAWERS_LIMIT }

  const query = useQuery<CashSessionListResponse>({
    queryKey: computed(() => cashQueryKeys.sessionsList(access.identity.value, params)),
    queryFn: () => cashApi.listSessions(params),
    enabled: computed(
      () =>
        access.canReadSessions.value &&
        access.canOpenSession.value &&
        access.identityReady.value &&
        access.permissionsLoaded.value,
    ),
    refetchOnWindowFocus: false,
    staleTime: 15_000,
  })

  /** registerId → its newest session still holding the drawer. */
  const byRegister = computed<Record<string, CashSession>>(() => {
    const map: Record<string, CashSession> = {}
    for (const item of query.data.value?.items ?? []) {
      if (item.drawerReleasedAt !== null) continue
      if (!map[item.registerId]) map[item.registerId] = item
    }
    return map
  })

  const sessionIds = computed(
    () => new Set((query.data.value?.items ?? []).map((item) => item.id)),
  )

  return {
    byRegister,
    /** The held-drawer session is in the caller's visible list (its detail is reachable). */
    isVisible: (sessionId: string) => sessionIds.value.has(sessionId),
    /** Every held drawer of the branch is known (branch scope and one full page). */
    complete: computed(() => {
      const data = query.data.value
      if (!data || !access.canAuditSessions.value) return false
      return data.total <= data.items.length
    }),
    /** The read ran for the current key: a register missing from it is free (as far as known). */
    known: computed(() => query.isSuccess.value),
    isLoading: computed(() => query.isLoading.value),
    refetch: query.refetch,
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
