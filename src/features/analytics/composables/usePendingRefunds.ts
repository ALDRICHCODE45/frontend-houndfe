/**
 * usePendingRefunds.ts — query state for `GET /sales/refunds/pending`
 * (ODD dashboard-operational-insights OI-5B1).
 *
 * Locked contract:
 *   - Tenant identity is CACHE ISOLATION ONLY. It participates in the query key
 *     and the enabled guard; it is never sent to the API (the backend resolves
 *     tenant/branch from the JWT). The transport receives exactly
 *     `{ page: 1, limit: 5 }`.
 *   - The request is FIXED and owned here: the dashboard module always shows the
 *     first queue page of five. Callers cannot widen it.
 *   - The query runs only when the trimmed tenant is non-empty AND the caller
 *     passes an enabled permission boolean. Requiring the flag keeps an
 *     Analytics-only user from issuing a request that the backend would answer
 *     403 — the permission gate stays in the caller, the guard stays here.
 *   - The public `data`/`items` surface is MASKED the moment the effective guard
 *     goes false (missing tenant or denied permission), even though TanStack may
 *     keep the payload cached internally. Revoked permission must never leave
 *     another tenant's rows readable.
 *   - EVERY other public state surface is masked by the same guard. When the guard
 *     is false, `isInitialLoading`/`isRefetching`/`isFetching`/`isError` are false
 *     and `error` is absent, even if an authorized request was already in flight
 *     when the tenant or permission changed. The cache is never cancelled or
 *     deleted and backend order is never mutated; only the public boundary is
 *     closed until access is authorized again.
 *   - Placeholder retention is deliberately NOT configured: with a fixed page and
 *     limit, the only way a previous payload could appear is a TENANT change, and
 *     showing tenant A rows while tenant B loads is a cross-tenant disclosure.
 *     A key change therefore starts from an empty surface.
 *   - It never retries on its own and exposes derived flags plus ONE guarded
 *     manual (re)fetch reachable under both `refetch` and `retry`, so no public
 *     surface can start a second pending request. That guarded function resolves
 *     to `void`: the underlying `QueryObserverResult` is awaited and discarded
 *     because it carries `data`. A rejection is re-thrown only while the guard is
 *     still enabled; a revocation mid-flight is swallowed rather than surfaced.
 *   - It is deliberately INDEPENDENT of the summary and timeseries queries: its
 *     own key, its own request and its own error state, so a refund failure
 *     never erases the KPI strip (or the reverse).
 *   - Rows are consumed exactly as the backend ordered them. The composable
 *     never sorts, filters, aggregates or derives an obligation; the API
 *     boundary has already rejected any payload that would require that.
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type {
  PendingRefundRow,
  PendingRefundsResponse,
} from '@/features/POS/sales/interfaces/pending-refund.types'

/** 1-based first queue page — fixed by the dashboard module. */
const PENDING_REFUNDS_PAGE = 1
/** Dashboard queue page size — fixed by the dashboard module. */
const PENDING_REFUNDS_LIMIT = 5

export interface UsePendingRefundsOptions {
  /** Tenant identity used for cache isolation only; never sent to the API. */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /**
   * Caller-controlled permission flag (typically `userCan('read', 'SaleRefund')`).
   * The query runs only when this is `true` AND the tenant is non-empty.
   */
  enabled: MaybeRefOrGetter<boolean>
}

export function usePendingRefunds(options: UsePendingRefundsOptions) {
  const tenantId = computed(() => toValue(options.tenantId)?.trim() ?? '')
  const permissionEnabled = computed(() => toValue(options.enabled) === true)

  // A missing tenant or a denied permission must never reach the network.
  const enabled = computed(() => tenantId.value.length > 0 && permissionEnabled.value)

  const query = useQuery({
    queryKey: computed(() =>
      saleQueryKeys.pendingRefunds(tenantId.value, {
        page: PENDING_REFUNDS_PAGE,
        limit: PENDING_REFUNDS_LIMIT,
      }),
    ),
    // The TanStack `signal` is forwarded so a superseded request aborts the
    // in-flight HTTP request instead of merely being ignored.
    queryFn: ({ signal }) =>
      saleApi.listPendingRefunds(
        { page: PENDING_REFUNDS_PAGE, limit: PENDING_REFUNDS_LIMIT },
        { signal },
      ),
    enabled,
    staleTime: 30_000,
    retry: false,
  })

  // Masked whenever the effective guard is false: a missing tenant or a revoked
  // permission must clear the public surface immediately, even if TanStack still
  // holds the payload (or another tenant's payload) in its cache, and even if an
  // authorized request is in flight right now. The cache itself is untouched.
  const data = computed<PendingRefundsResponse | undefined>(() =>
    enabled.value ? query.data.value : undefined,
  )
  /** Backend-ordered obligations, verbatim. Empty until the first payload lands. */
  const items = computed<PendingRefundRow[]>(() => (enabled.value ? (data.value?.data ?? []) : []))
  const isEmpty = computed(() => items.value.length === 0)

  /** First load with nothing to show yet; false once prior data is rendered. */
  const isInitialLoading = computed(() => enabled.value && query.isLoading.value)
  /** Background refresh while previous data stays visible. */
  const isRefetching = computed(
    () => enabled.value && query.isFetching.value && !query.isLoading.value,
  )
  /** Any in-flight activity, masked by the same guard as `data`. */
  const isFetching = computed(() => enabled.value && query.isFetching.value)
  /** Error visibility follows the guard: revoked access reveals no failure. */
  const isError = computed(() => enabled.value && query.isError.value)
  /** The raw error object is withheld while the guard is false. */
  const error = computed(() => (enabled.value ? query.error.value : undefined))

  /**
   * Guarded manual (re)fetch. BOTH public names (`refetch` and `retry`) are the
   * same function and share ONE guard, so neither surface can start a second
   * request while the query is disabled or a request is already in flight.
   *
   * The result of the underlying `query.refetch()` is a `QueryObserverResult`
   * that carries `data`; it is awaited and DISCARDED, so this surface resolves to
   * `void` and can never hand back rows the guard has masked. A no-op resolves to
   * `void` as well.
   *
   * A rejection keeps propagating while the guard is still enabled (the
   * established error behavior). If the tenant or permission was revoked while the
   * request was in flight, the raw error is swallowed: surfacing it would leak
   * state about a request the caller is no longer authorized to see.
   */
  async function refetch(): Promise<void> {
    if (!enabled.value || query.isFetching.value) return

    try {
      await query.refetch()
    } catch (caught) {
      if (enabled.value) throw caught
    }
  }

  return {
    data,
    items,
    isEmpty,
    isInitialLoading,
    isRefetching,
    isFetching,
    isError,
    error,
    refetch,
    retry: refetch,
  }
}
