import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { keepPreviousData, useQuery } from '@tanstack/vue-query'
import { backorderQueryKeys } from '@/core/shared/constants/query-keys'
import { backordersApi } from '../api/backorders.api'
import type { BackorderListParams } from '../interfaces/backorder.types'
import { useBackorderAccess } from './useBackorderAccess'

/** One page of `GET /backorders` for the given params; keeps the previous page while the next loads. */
export function useBackorderList(params: MaybeRefOrGetter<BackorderListParams>) {
  const { tenantId, enabled } = useBackorderAccess()

  const query = useQuery({
    queryKey: computed(() => backorderQueryKeys.list(tenantId.value, toValue(params))),
    queryFn: ({ signal }) => backordersApi.list(toValue(params), { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })

  const data = computed(() => (enabled.value ? query.data.value : undefined))
  return {
    items: computed(() => data.value?.items ?? []),
    total: computed(() => data.value?.total ?? 0),
    counts: computed(() => data.value?.counts ?? null),
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: computed(() => enabled.value && query.isFetching.value),
    isError: computed(() => enabled.value && query.isError.value),
    refetch: () => query.refetch(),
  }
}
