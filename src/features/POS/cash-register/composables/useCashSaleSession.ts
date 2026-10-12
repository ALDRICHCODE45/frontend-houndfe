/**
 * useCashSaleSession — explicit cash-session selection for the POS charge (T6/S3).
 *
 * The POS charge may be linked to a cash session the cashier explicitly picks.
 * This composable owns the picker's data + selection so `PaymentModal` stays a
 * presentational orchestrator and the pickable set stays rule-driven:
 *
 *   - Reads are gated by `read:CashSession`, a resolved principal and resolved
 *     permissions — the same gate the rest of the Caja feature uses. Without the
 *     ability (or a principal) there is NO request, including the public
 *     `refetch` (a no-op) and the query function itself (fail-closed).
 *   - Only OWN + OPEN + current-tenant rows are offered. The backend is
 *     authoritative for owned/OPEN/active membership; this is the client-side
 *     mirror, applied to the CURRENT visible page.
 *   - `pendingOnly` is never sent: `true` EXCLUDES OPEN rows. Only `page`/`limit`
 *     travel, so the response `total` spans all statuses and is never presented
 *     as a filtered total.
 *   - Nothing is ever auto-selected: a sole, first, previous or refreshed row
 *     never becomes the selection on its own.
 *   - The selection belongs to one principal + permission set + session
 *     lifecycle. A principal, permission, unresolved-permission or lifecycle
 *     change clears it synchronously; a stale list cannot reinstate it because
 *     the query slot is identity-scoped. A non-reactive generation write is
 *     caught by the live scope guard before any emit.
 *   - `isSelectionScopeCurrent` / `revalidateSelection` revalidate the chosen
 *     id LIVE against the current access, the captured scope and the current
 *     rows. A stale/invalid selection therefore fails closed instead of
 *     silently downgrading the charge to an unbound one.
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { cashApi } from '../api/cash.api'
import { cashQueryKeys, type CashCacheScope } from './cashQueryKeys'
import { useCashAccess } from './useCashAccess'
import { isSameCashIdentity, type CashIdentity } from './cashRules'
import type { CashSession, CashSessionListResponse } from '../interfaces/cash.types'

export const CASH_SALE_SESSION_PAGE_SIZE = 25

/**
 * Strict canonical UUID check (any RFC 4122 version/variant, case-insensitive).
 * A selected id that is not a canonical UUID is never selectable, so a
 * non-UUID legacy test id can never travel as `cashSessionId`.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The selected cash session must be canonical UUID, OPEN, own and same tenant. */
export function isCashSessionSelectable(
  session: CashSession | null | undefined,
  scope: CashCacheScope | null | undefined,
): boolean {
  if (!session || !scope) return false
  if (!scope.tenantId || !scope.userId) return false
  if (session.tenantId !== scope.tenantId) return false
  if (session.cashierUserId !== scope.userId) return false
  if (session.status !== 'OPEN') return false
  return UUID_PATTERN.test(session.id)
}

/**
 * Filter the raw list page down to the rows this principal may bind:
 * own + OPEN + current tenant + canonical UUID. Foreign rows never render.
 */
export function filterSelectableCashSessions(
  items: readonly CashSession[],
  scope: CashCacheScope | null | undefined,
): CashSession[] {
  return items.filter((session) => isCashSessionSelectable(session, scope))
}

export interface UseCashSaleSession {
  /** Whether `read:CashSession` is held and permissions are resolved. */
  canReadSessions: ComputedRef<boolean>
  /** The pickable rows of the CURRENT visible page (own + OPEN + UUID). */
  availableSessions: ComputedRef<CashSession[]>
  /** The explicit selection, or `null` when the charge stays unbound. */
  selectedId: Ref<string | null>
  /** True only when `selectedId` is an eligible row of the current rows. */
  isSelectionEligible: ComputedRef<boolean>
  /** Page envelope, kept honest: `total` spans ALL statuses. */
  page: ComputedRef<number>
  pageSize: ComputedRef<number>
  total: ComputedRef<number>
  pageCount: ComputedRef<number>
  isFetching: ComputedRef<boolean>
  isError: ComputedRef<boolean>
  /** Set the explicit selection (`null`/empty clears it and restores legacy). */
  selectSession: (id: string | null | undefined) => void
  clearSelection: () => void
  /**
   * LIVE check that the captured selection scope still matches the current
   * access + principal/permission/lifecycle (the row's presence on the current
   * page is NOT considered). It tells an invalidated binding apart from a
   * merely page-stale selection.
   */
  isSelectionScopeCurrent: () => boolean
  /**
   * LIVE, non-cached authoritative revalidation for the submit gate: reads the
   * current access fence, the live session lifecycle and the current rows.
   */
  revalidateSelection: () => boolean
  setPage: (page: number) => void
  /**
   * Manual refetch, gated by the SAME current access fence as the query
   * (`read:CashSession` + resolved principal + resolved permissions). Without
   * the ability it is a no-op and never issues a request.
   */
  refetch: () => Promise<unknown>
}

export function useCashSaleSession(): UseCashSaleSession {
  const access = useCashAccess()

  const available = computed(
    () =>
      access.canReadSessions.value && access.identityReady.value && access.permissionsLoaded.value,
  )

  const page = ref(1)
  const selectedId = ref<string | null>(null)
  /**
   * The authoritative identity the selection was captured under. Re-checked
   * against the LIVE principal / permission set / session lifecycle on every
   * eligibility read, so cached rows alone can never keep a prior-scope
   * selection looking eligible.
   */
  const selectedScope = ref<CashIdentity | null>(null)

  /**
   * Every identity/permission/lifecycle input that must reset the ACTUAL
   * selection: tenant, user, permission set, session generation and whether the
   * permission set is resolved. Any change (including a same-principal
   * logout/login or an unresolved permission set) clears the selection
   * synchronously, so no old-scope id survives into a new scope.
   */
  const selectionResetKey = computed(() => {
    const identity = access.identity.value
    return [
      identity.tenantId,
      identity.userId,
      identity.permissionFingerprint,
      identity.generation,
      access.permissionsLoaded.value ? '1' : '0',
    ].join('|')
  })

  const query = useQuery<CashSessionListResponse>({
    queryKey: computed(() =>
      cashQueryKeys.sessionsList(access.identity.value, {
        page: page.value,
        limit: CASH_SALE_SESSION_PAGE_SIZE,
      }),
    ),
    queryFn: async ({ queryKey }) => {
      const [, tenantId, userId, permissionFingerprint, generation] = queryKey
      const scope: CashCacheScope = {
        tenantId: String(tenantId),
        userId: String(userId),
        permissionFingerprint: String(permissionFingerprint),
        generation: Number(generation),
      }
      const empty = {
        items: [],
        page: page.value,
        limit: CASH_SALE_SESSION_PAGE_SIZE,
        total: 0,
      }
      // Fail closed on the CURRENT access gate: an in-flight/manual
      // continuation must never reach the API after the read ability, the
      // principal or the resolved permissions were lost.
      if (
        !access.canReadSessions.value ||
        !access.identityReady.value ||
        !access.permissionsLoaded.value
      ) {
        return empty
      }
      // The slot is identity-scoped, so a stale continuation must never write
      // into the new principal's page as if it were current.
      if (!isSameCashIdentity(scope, access.identity.value as CashIdentity)) {
        return empty
      }
      return cashApi.listSessions({ page: page.value, limit: CASH_SALE_SESSION_PAGE_SIZE })
    },
    enabled: available,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  /** The eligible rows of the CURRENT visible page, only while access holds. */
  const availableSessions = computed(() => {
    if (
      !access.canReadSessions.value ||
      !access.identityReady.value ||
      !access.permissionsLoaded.value
    ) {
      return []
    }
    return filterSelectableCashSessions(query.data.value?.items ?? [], access.identity.value)
  })

  /**
   * LIVE check that the captured selection scope still matches the current
   * access + principal/permission/lifecycle (row presence is not considered).
   * The session lifecycle is read straight from storage, so a non-reactive
   * generation change is caught here before any emit.
   */
  function isSelectionScopeCurrent(): boolean {
    if (selectedId.value === null) return false
    const captured = selectedScope.value
    if (!captured) return false
    if (
      !access.canReadSessions.value ||
      !access.identityReady.value ||
      !access.permissionsLoaded.value
    ) {
      return false
    }
    return access.isCurrentIdentity(captured)
  }

  /**
   * LIVE, non-cached revalidation of the chosen id against the current access
   * gate, the captured selection scope and the current eligible rows. A revoked
   * ability, an unresolved permission set, a lifecycle change or a stale cached
   * page all fail closed.
   */
  function revalidateSelection(): boolean {
    if (!isSelectionScopeCurrent()) return false
    return availableSessions.value.some((session) => session.id === selectedId.value)
  }

  /** Reactive mirror of {@link revalidateSelection} for the picker UI. */
  const isSelectionEligible = computed(() => revalidateSelection())

  const total = computed(() => query.data.value?.total ?? 0)
  const pageSize = computed(() => query.data.value?.limit ?? CASH_SALE_SESSION_PAGE_SIZE)
  const pageCount = computed(() => {
    const limit = pageSize.value
    if (limit <= 0) return 1
    return Math.max(1, Math.ceil(total.value / limit))
  })

  function selectSession(id: string | null | undefined): void {
    const next = typeof id === 'string' && id.trim() !== '' ? id : null
    if (next === null) {
      selectedId.value = null
      selectedScope.value = null
      return
    }
    selectedId.value = next
    // Capture the authoritative scope AT SELECTION so submit revalidation can
    // reject a stale same-principal lifecycle without trusting cached rows.
    selectedScope.value = access.captureIdentity()
  }

  function clearSelection(): void {
    selectedId.value = null
    selectedScope.value = null
  }

  function setPage(next: number): void {
    if (!Number.isFinite(next)) return
    const target = Math.max(1, Math.trunc(next))
    if (target === page.value) return
    page.value = target
  }

  // Any identity/permission/lifecycle transition clears the ACTUAL selection
  // IMMEDIATELY (sync), so no old-scope id survives into a new scope. A
  // non-reactive generation write is not visible here yet; the live
  // `isSelectionScopeCurrent` / `revalidateSelection` guard catches it at submit
  // before any emit.
  watch(
    selectionResetKey,
    () => {
      if (selectedId.value !== null) selectedId.value = null
      if (selectedScope.value !== null) selectedScope.value = null
    },
    { flush: 'sync' },
  )

  /**
   * Manual refetch, gated by the SAME current access fence as the query. A
   * manual call must not bypass `enabled`; without the ability it is a no-op.
   */
  async function refetch(): Promise<unknown> {
    if (!available.value) return undefined
    return query.refetch()
  }

  return {
    canReadSessions: computed(() => access.canReadSessions.value && access.permissionsLoaded.value),
    availableSessions,
    selectedId,
    isSelectionEligible,
    page: computed(() => query.data.value?.page ?? page.value),
    pageSize,
    total,
    pageCount,
    isFetching: computed(() => query.isFetching.value),
    isError: computed(() => query.isError.value),
    selectSession,
    clearSelection,
    isSelectionScopeCurrent,
    revalidateSelection,
    setPage,
    refetch,
  }
}
