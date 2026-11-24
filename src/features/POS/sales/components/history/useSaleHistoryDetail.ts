import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleApi } from '../../api/sale.api'

/**
 * Sales history redesign T1: GET /sales/:id for an opened history row. Same key and API as the sale
 * detail page (`useSaleDetail`), so «Abrir venta» starts from cache and a debt payment (which
 * invalidates the detail key) refreshes the open row. Reopening a row within `staleTime` does not
 * request again: one request per opened row.
 */
export const SALE_HISTORY_DETAIL_STALE_TIME = 5 * 60_000

export function useSaleHistoryDetail(saleId: MaybeRefOrGetter<string>) {
  const authStore = useAuthStore()
  const id = computed(() => toValue(saleId))

  const query = useQuery({
    queryKey: computed(() => saleQueryKeys.detail(authStore.currentTenantId, id.value)),
    queryFn: () => saleApi.getById(id.value),
    enabled: computed(() => id.value.length > 0),
    staleTime: SALE_HISTORY_DETAIL_STALE_TIME,
    retry: false,
  })

  return {
    sale: computed(() => query.data.value),
    isLoading: computed(() => query.isLoading.value),
    isError: computed(() => query.isError.value),
    refetch: () => query.refetch(),
  }
}
