import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { backorderQueryKeys } from '@/core/shared/constants/query-keys'
import { backordersApi } from '../api/backorders.api'
import { useBackorderAccess } from './useBackorderAccess'

const COUNT_PARAMS = { page: 1, limit: 1 } as const

/**
 * Number of Apartados for the nav badge (S1: «badge con apartados»): the lightest list page,
 * read from `counts.RESERVED` (counts honour every filter except `status`, and none is sent). Under
 * the backorder prefix, so a cancel refreshes it with the list. No request without read:Backorder.
 */
export function useReservedBackordersCount() {
  const { tenantId, enabled } = useBackorderAccess()

  const query = useQuery({
    queryKey: computed(() => backorderQueryKeys.reservedCount(tenantId.value)),
    queryFn: ({ signal }) => backordersApi.list(COUNT_PARAMS, { signal }),
    enabled,
    staleTime: 60_000,
    retry: false,
  })

  return { count: computed(() => (enabled.value ? (query.data.value?.counts.RESERVED ?? 0) : 0)) }
}
