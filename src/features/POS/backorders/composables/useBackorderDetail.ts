import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { backorderQueryKeys } from '@/core/shared/constants/query-keys'
import { backordersApi } from '../api/backorders.api'
import { readBackorderError } from '../utils/backorderErrors'
import { useBackorderAccess } from './useBackorderAccess'

/** `GET /backorders/:id`. A 404 (`BACKORDER_NOT_FOUND`) is «not found», never a generic error. */
export function useBackorderDetail(id: MaybeRefOrGetter<string>) {
  const { tenantId, enabled: canFetch } = useBackorderAccess()
  const enabled = computed(() => canFetch.value && toValue(id).length > 0)

  const query = useQuery({
    queryKey: computed(() => backorderQueryKeys.detail(tenantId.value, toValue(id))),
    queryFn: ({ signal }) => backordersApi.get(toValue(id), { signal }),
    enabled,
    staleTime: 15_000,
    retry: false,
  })

  const notFound = computed(() => query.isError.value && readBackorderError(query.error.value).notFound)
  return {
    backorder: computed(() => (enabled.value ? query.data.value : undefined)),
    isLoading: computed(() => enabled.value && query.isLoading.value),
    isFetching: computed(() => enabled.value && query.isFetching.value),
    isNotFound: notFound,
    isError: computed(() => enabled.value && query.isError.value && !notFound.value),
    refetch: () => query.refetch(),
  }
}
