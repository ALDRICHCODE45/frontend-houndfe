/**
 * useBranchSalesSummary.ts — query state for `GET /analytics/sales/summary`.
 *
 * Locked contract (ODD branch-sales-summary A2):
 *   - Tenant identity is CACHE ISOLATION ONLY. It participates in the query key
 *     and the enabled guard; it is never sent to the API (the backend resolves
 *     tenant/branch from the JWT). The transport receives exactly `{ from, to }`.
 *   - Both boundaries are exact `YYYY-MM-DD` Mexico City calendar strings and
 *     are normalized with `toValue` inside the computed accessors, so callers
 *     may pass plain values, refs or getters.
 *   - The query runs only for a non-empty tenant and a fully valid `[from, to)`
 *     range, keeps prior data visible while refetching, never retries on its
 *     own, and exposes derived flags plus a guarded manual retry so a second
 *     pending refetch is never started.
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { analyticsApi } from '../api/analytics.api'
import { analyticsQueryKeys } from '@/core/shared/constants/query-keys'
import { isValidMexicoCityDateRange } from '@/core/shared/utils/mexicoCityCalendar'
import { isBranchSalesSummaryEmpty } from '../utils/branchSalesSummary.utils'

export interface UseBranchSalesSummaryOptions {
  /** Tenant identity used for cache isolation only; never sent to the API. */
  tenantId: MaybeRefOrGetter<string | null | undefined>
  /** Inclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
  from: MaybeRefOrGetter<string>
  /** Exclusive `YYYY-MM-DD` boundary in `America/Mexico_City`. */
  to: MaybeRefOrGetter<string>
}

export function useBranchSalesSummary(options: UseBranchSalesSummaryOptions) {
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
      analyticsQueryKeys.salesSummary(tenantId.value, { from: from.value, to: to.value }),
    ),
    queryFn: () => analyticsApi.getBranchSalesSummary({ from: from.value, to: to.value }),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    retry: false,
  })

  const summary = computed(() => query.data.value)
  const isEmpty = computed(() => isBranchSalesSummaryEmpty(summary.value))

  /** First load with nothing to show yet; false once prior data is rendered. */
  const isInitialLoading = computed(() => query.isLoading.value)
  /** Background refresh while previous data stays visible. */
  const isRefetching = computed(() => query.isFetching.value && !query.isLoading.value)

  /** Manual retry that no-ops while a request is already in flight or disabled. */
  async function retry(): Promise<unknown> {
    if (!enabled.value || query.isFetching.value) return undefined

    return query.refetch()
  }

  return {
    summary,
    isEmpty,
    isInitialLoading,
    isRefetching,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    retry,
  }
}
