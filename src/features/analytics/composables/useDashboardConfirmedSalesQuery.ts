/**
 * useDashboardConfirmedSalesQuery.ts — PRIVATE shared boundary for the two fixed
 * dashboard sales slots (ODD dashboard-operational-insights OI-5B2 S1).
 *
 * Locked contract:
 *   - Callers select a KIND ('recent' | 'debt'), never a request. The exact fixed
 *     `ListSalesParams` for each kind is module-owned, so no caller-supplied
 *     filter can ever widen the wire surface. The two public wrappers own the
 *     kind choice; this helper exposes no filter parameter at all.
 *   - Tenant identity is CACHE ISOLATION ONLY. It participates in the query key
 *     and the enabled guard; it is never sent to the API (the backend resolves
 *     tenant/branch from the JWT).
 *   - The query runs only when the trimmed tenant is non-empty AND the caller
 *     passes an enabled permission boolean. The permission gate stays in the
 *     caller; the guard stays here.
 *   - The public `data`/`items` surface is MASKED the moment the effective guard
 *     goes false, even though TanStack may keep the payload cached internally.
 *     EVERY other public state surface is masked by the same guard: while it is
 *     false, `isInitialLoading`/`isRefetching`/`isFetching`/`isError` are false
 *     and `error` is absent, even if an authorized request was already in flight
 *     when the tenant or permission changed. The cache is never cancelled or
 *     deleted; only the public boundary is closed until access is authorized.
 *   - Placeholder retention is deliberately NOT configured: with a fixed page and
 *     limit the only way a previous payload could appear is a TENANT change, and
 *     showing tenant A rows while tenant B loads is a cross-tenant disclosure.
 *     A tenant change is masked SYNCHRONOUSLY for EVERY surface — data, items and
 *     every loading/fetching/error flag — through ONE adoption guard that proves
 *     the observer has taken ownership of the current tenant's query. Until then
 *     the previous tenant's payload, flags and error are withheld, never read
 *     across tenants.
 *   - It never retries on its own and exposes derived flags plus ONE guarded
 *     manual (re)fetch reachable under both `refetch` and `retry`. The guarded
 *     function resolves to `void`: the underlying `QueryObserverResult` is awaited
 *     and discarded because it carries `data`. The invocation tenant is captured
 *     so a rejection is re-thrown ONLY while the same tenant is still current and
 *     enabled; a revocation or tenant switch mid-flight is swallowed instead of
 *     surfaced.
 *   - Rows are consumed exactly as the backend ordered them. The composable never
 *     sorts, filters, aggregates or derives an amount.
 */

import {
  computed,
  hasInjectionContext,
  onScopeDispose,
  ref,
  toRaw,
  toValue,
  type MaybeRefOrGetter,
} from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type {
  ConfirmedSaleRow,
  ConfirmedSalesListResponse,
  ListSalesParams,
} from '@/features/POS/sales/interfaces/sale.types'

/** The two fixed dashboard sales slots. Callers pick a kind, never a request. */
export type DashboardConfirmedSalesKind = 'recent' | 'debt'

export interface UseDashboardConfirmedSalesQueryOptions {
  /** Tenant identity used for cache isolation only; never sent to the API. */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /**
   * Caller-controlled permission flag (typically `userCan('read', 'Sale')`).
   * The query runs only when this is `true` AND the tenant is non-empty.
   */
  enabled: MaybeRefOrGetter<boolean>
}

/** Fixed dashboard-recent request. 1-based first page of five, newest first. */
const RECENT_REQUEST: ListSalesParams = Object.freeze<ListSalesParams>({
  page: 1,
  limit: 5,
  status: ['CONFIRMED'],
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
})

/** Fixed dashboard-debt request. Confirmed sales with an outstanding balance. */
const DEBT_REQUEST: ListSalesParams = Object.freeze<ListSalesParams>({
  page: 1,
  limit: 5,
  status: ['CONFIRMED'],
  paymentStatus: ['PARTIAL', 'CREDIT'],
  debtMin: 1,
  sortBy: 'confirmedAt',
  sortOrder: 'desc',
})

const REQUEST_BY_KIND: Record<DashboardConfirmedSalesKind, ListSalesParams> = {
  recent: RECENT_REQUEST,
  debt: DEBT_REQUEST,
}

export function useDashboardConfirmedSalesQuery(
  kind: DashboardConfirmedSalesKind,
  options: UseDashboardConfirmedSalesQueryOptions,
) {
  const tenantId = computed(() => toValue(options.tenantId)?.trim() ?? '')
  const permissionEnabled = computed(() => toValue(options.enabled) === true)

  // A missing tenant or a denied permission must never reach the network.
  const enabled = computed(() => tenantId.value.length > 0 && permissionEnabled.value)

  // Both fixed requests come from the module-owned map: no caller input reaches
  // the params, so the wire surface cannot be widened.
  const request = REQUEST_BY_KIND[kind]

  // The exact tenant-scoped cache slot for the current tenant.
  const queryKey = computed(() =>
    kind === 'recent'
      ? saleQueryKeys.dashboardRecent(tenantId.value)
      : saleQueryKeys.dashboardDebt(tenantId.value),
  )

  // The active query client when the composable runs inside a Vue app (the real
  // runtime). Unit harnesses that drive a mocked `useQuery` outside an injection
  // context have none; the adoption guard below then uses a documented safe
  // fallback that trusts the mocked observer (config-level tests only).
  const queryClient = hasInjectionContext() ? useQueryClient() : undefined

  const query = useQuery({
    queryKey,
    // The TanStack `signal` is forwarded so a superseded request aborts the
    // in-flight HTTP request instead of merely being ignored.
    queryFn: ({ signal }) => saleApi.listConfirmed(request, { signal }),
    enabled,
    staleTime: 30_000,
    retry: false,
  })

  /**
   * ADOPTION GUARD — the single ownership decision every public surface hangs
   * from.
   *
   * Vue Query applies option/key changes through a default-flush watcher, so right
   * after a tenant change the observer still reads the PREVIOUS tenant's query
   * until the next tick. Gating on `enabled` alone would let tenant A's data,
   * loading/fetching flags and error surface under tenant B.
   *
   * The observer's current query identity is proven against the CURRENT key's
   * QueryClient state. The comparison covers the no-response cases too (initial
   * loading / initial error), so it does not rely on success data existing:
   * `status`, `fetchStatus`, `dataUpdatedAt` and `errorUpdatedAt` distinguish a
   * pending/fetching/error query from a different key's query, while `data`/`error`
   * references confirm the payload/error owner. When the current key has no cache
   * entry yet the observer cannot be on it, so ownership is false.
   *
   * Reactivity anchor: the guard also subscribes to query-cache events, because
   * two different keys can carry IDENTICAL observer field values (e.g. both
   * initial-loading), so the observer fields alone would not re-trigger the guard
   * when adoption happens. Any cache event re-evaluates ownership.
   *
   * No-`select` assumption: with no `select`/placeholder the observer result maps
   * these fields 1:1 onto the query state, so reference equality holds after
   * `toRaw` unwraps the reactive proxy. A future `select` transform would need
   * this guard revisited.
   *
   * Outside an injection context (config-level unit harness with a mocked observer)
   * there is no QueryClient; the documented safe fallback trusts the mock. Real
   * mounted runtime always proves identity.
   */
  // Reactive anchor for adoption. Query-cache events fire whenever the current (or
  // previous) tenant's query is built, updated or removed, so the ownership guard
  // re-evaluates even when the observer's field values are identical across two
  // keys (e.g. both initial-loading).
  const cacheVersion = ref(0)
  if (queryClient) {
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      cacheVersion.value += 1
    })
    onScopeDispose(unsubscribe)
  }

  const owned = computed<boolean>(() => {
    // Config-level fallback: outside an injection context there is no QueryClient
    // (the mocked observer has none of the identity fields below), so the mock is
    // trusted. Real mounted runtime always proves identity.
    if (!queryClient) return true

    // Read the observer identity fields and the cache version UNCONDITIONALLY and
    // before any early return, so this computed re-evaluates the moment the
    // observer adopts or updates the current key (including when the current key's
    // query does not exist yet at read time).
    const observerStatus = query.status.value
    const observerFetchStatus = query.fetchStatus.value
    const observerDataUpdatedAt = query.dataUpdatedAt.value
    const observerErrorUpdatedAt = query.errorUpdatedAt.value
    const observerData = query.data.value
    const observerError = query.error.value
    void cacheVersion.value

    const state = queryClient.getQueryState<ConfirmedSalesListResponse, Error>(queryKey.value)
    if (!state) return false

    return (
      state.status === observerStatus &&
      state.fetchStatus === observerFetchStatus &&
      state.dataUpdatedAt === observerDataUpdatedAt &&
      state.errorUpdatedAt === observerErrorUpdatedAt &&
      state.data === toRaw(observerData) &&
      state.error === observerError
    )
  })

  /** Authorized AND the observer has adopted the current tenant's query. */
  const surface = computed(() => enabled.value && owned.value)

  /** Backend payload, verbatim. Withheld until access + adoption both hold. */
  const data = computed<ConfirmedSalesListResponse | undefined>(() =>
    surface.value ? query.data.value : undefined,
  )
  /** Backend-ordered rows, verbatim. Empty until the first payload lands. */
  const items = computed<ConfirmedSaleRow[]>(() => data.value?.data ?? [])
  const isEmpty = computed(() => items.value.length === 0)

  /** First load with nothing to show yet; false once prior data is rendered. */
  const isInitialLoading = computed(() => surface.value && query.isLoading.value)
  /** Background refresh while previous data stays visible. */
  const isRefetching = computed(
    () => surface.value && query.isFetching.value && !query.isLoading.value,
  )
  /** Any in-flight activity, gated by the same adoption guard as `data`. */
  const isFetching = computed(() => surface.value && query.isFetching.value)
  /** Error visibility follows the guard: revoked or stale access reveals no failure. */
  const isError = computed(() => surface.value && query.isError.value)
  /** The raw error object is withheld until access + adoption both hold. */
  const error = computed(() => (surface.value ? query.error.value : undefined))

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
   * The invocation tenant is captured before the request starts. A rejection is
   * re-thrown ONLY while the same tenant is still current AND enabled (the
   * established error behavior). If the tenant changed or the permission was
   * revoked while the request was in flight, the raw error is swallowed:
   * surfacing it would leak state about a request the caller is no longer
   * authorized to see.
   */
  async function refetch(): Promise<void> {
    if (!enabled.value || query.isFetching.value) return

    const invocationTenant = tenantId.value
    try {
      await query.refetch()
    } catch (caught) {
      if (enabled.value && tenantId.value === invocationTenant) throw caught
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
