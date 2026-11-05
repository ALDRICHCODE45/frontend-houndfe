import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleApi } from '@/features/POS/sales/api/sale.api'

const COUNT_PARAMS = { page: 1, limit: 1 } as const

/**
 * Number of pending refunds for the nav badge: the lightest page (`limit: 1`) through the
 * strict decoder, read from `pagination.total`. Under the pending-refunds prefix, so a
 * settlement refreshes it with the list. No request without `SaleRefund` read.
 */
export function usePendingRefundsCount() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId?.trim() ?? '')
  const enabled = computed(
    () => tenantId.value.length > 0 && authStore.userCan('read', 'SaleRefund'),
  )

  const query = useQuery({
    queryKey: computed(() => saleQueryKeys.pendingRefunds(tenantId.value, COUNT_PARAMS)),
    queryFn: ({ signal }) => saleApi.listPendingRefunds(COUNT_PARAMS, { signal }),
    enabled,
    staleTime: 60_000,
    retry: false,
  })

  return {
    count: computed(() => (enabled.value ? (query.data.value?.pagination.total ?? 0) : 0)),
  }
}
