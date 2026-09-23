/**
 * useBranchSalesTimeseries.ts — query state for
 * `GET /analytics/sales/timeseries` (ODD dashboard-operational-insights OI-4).
 *
 * Locked contract:
 *   - Tenant identity is CACHE ISOLATION ONLY. It participates in the query key
 *     and the enabled guard; it is never sent to the API (the backend resolves
 *     tenant/branch from the JWT). The transport receives exactly
 *     `{ from, to, interval: 'day' }`.
 *   - Both boundaries are exact `YYYY-MM-DD` Mexico City calendar strings and
 *     are normalized with `toValue` inside the computed accessors, so callers
 *     may pass plain values, refs or getters.
 *   - The query runs only for a non-empty tenant and a fully valid `[from, to)`
 *     range, keeps prior data visible while refetching, never retries on its
 *     own, and exposes derived flags plus ONE guarded manual (re)fetch reachable
 *     under both `refetch` and `retry`, so no public surface can start a second
 *     pending request.
 *   - It is deliberately INDEPENDENT of `useBranchSalesSummary`: its own key,
 *     its own request and its own error state, so a malformed series never
 *     erases the summary aggregates (or the reverse).
 *   - Points are consumed exactly as the backend returned them. The composable
 *     never fills, sorts, aggregates or derives a bucket; the API boundary has
 *     already rejected any payload that would require that.
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { analyticsApi } from '../api/analytics.api'
import { analyticsQueryKeys } from '@/core/shared/constants/query-keys'
import { isValidMexicoCityDateRange } from '@/core/shared/utils/mexicoCityCalendar'
import {
  BRANCH_SALES_TIMESERIES_INTERVAL,
  type BranchSalesTimeseriesPoint,
} from '../interfaces/branch-sales-timeseries.types'

export interface UseBranchSalesTimeseriesOptions {
  /** Tenant identity used for cache isolation only; never sent to the API. */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /** Inclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
  from: MaybeRefOrGetter<string>
  /** Exclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
  to: MaybeRefOrGetter<string>
}

export function useBranchSalesTimeseries(options: UseBranchSalesTimeseriesOptions) {
  const tenantId = computed(() => toValue(options.tenantId)?.trim() ?? '')
  const from = computed(() => toValue(options.from))
  const to = computed(() => toValue(options.to))

  // A missing tenant or an invalid/equal/inverted/over-366-day range must never
  // reach the network; the backend would only answer 400.
  const enabled = computed(
    () => tenantId.value.length > 0 && isValidMexicoCityDateRange(from.value, to.value),
  )

  const query = useQuery({
    queryKey: computed(() =>
      analyticsQueryKeys.salesTimeseries(tenantId.value, {
        from: from.value,
        to: to.value,
        interval: BRANCH_SALES_TIMESERIES_INTERVAL,
      }),
    ),
    // The TanStack `signal` is forwarded so a superseded window aborts the
    // in-flight HTTP request instead of merely being ignored.
    queryFn: ({ signal }) =>
      analyticsApi.getBranchSalesTimeseries(
        { from: from.value, to: to.value, interval: BRANCH_SALES_TIMESERIES_INTERVAL },
        { signal },
      ),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: false,
  })

  const timeseries = computed(() => query.data.value)
  /** Backend-provided buckets, verbatim. Empty until the first payload lands. */
  const points = computed<BranchSalesTimeseriesPoint[]>(() => timeseries.value?.points ?? [])
  const isEmpty = computed(() => points.value.length === 0)

  /** First load with nothing to show yet; false once prior data is rendered. */
  const isInitialLoading = computed(() => query.isLoading.value)
  /** Background refresh while previous data stays visible. */
  const isRefetching = computed(() => query.isFetching.value && !query.isLoading.value)

  /**
   * Guarded manual (re)fetch. BOTH public names (`refetch` and `retry`) are the
   * same function and share ONE guard, so neither surface can start a second
   * request while the range is disabled or a request is already in flight.
   * A no-op resolves to `undefined` instead of duplicating work.
   */
  async function refetch(): Promise<unknown> {
    if (!enabled.value || query.isFetching.value) return undefined

    return query.refetch()
  }

  return {
    timeseries,
    points,
    isEmpty,
    isInitialLoading,
    isRefetching,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch,
    retry: refetch,
  }
}
