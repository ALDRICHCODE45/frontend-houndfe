/**
 * useRecentConfirmedSales.ts — permission-aware state for the fixed
 * "recent confirmed sales" dashboard slot (ODD dashboard-operational-insights
 * OI-5B2 S1).
 *
 * This public wrapper owns the RECENT slot only. It delegates to the shared,
 * private `useDashboardConfirmedSalesQuery` boundary with the `'recent'` kind, so
 * the exact request
 *   `{ page: 1, limit: 5, status: ['CONFIRMED'], sortBy: 'confirmedAt', sortOrder: 'desc' }`
 * and the tenant-scoped key `['sales', tenantId, 'dashboard-recent']` are fixed.
 * Callers can pass only `{ tenantId, enabled }` — there is no filter parameter to
 * widen. Tenant is cache isolation only and is never sent to the API.
 *
 * Public surface (matches the reviewed pending-refund boundary):
 *   data, items, isEmpty, isInitialLoading, isRefetching, isFetching, isError,
 *   error, refetch, retry.
 * Every data/flag/error surface is masked the moment the tenant is empty or the
 * permission is false, staleTime is 30s, there is no automatic retry and no
 * placeholder retention, and rows keep the backend order verbatim.
 */

import type { MaybeRefOrGetter } from 'vue'
import { useDashboardConfirmedSalesQuery } from './useDashboardConfirmedSalesQuery'

export interface UseRecentConfirmedSalesOptions {
  /** Tenant identity used for cache isolation only; never sent to the API. */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /**
   * Caller-controlled permission flag. The query runs only when this is `true`
   * AND the tenant is non-empty.
   */
  enabled: MaybeRefOrGetter<boolean>
}

export function useRecentConfirmedSales(options: UseRecentConfirmedSalesOptions) {
  return useDashboardConfirmedSalesQuery('recent', options)
}
