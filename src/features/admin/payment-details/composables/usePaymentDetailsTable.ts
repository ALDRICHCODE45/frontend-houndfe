import { computed, ref } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { adminPaymentDetailQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { paymentDetailsApi, paginatePaymentDetails } from '../api/payment-details.api'
import type {
  PaymentDetailResponse,
  PaymentDetailTableRow,
} from '../interfaces/payment-detail.types'

/**
 * usePaymentDetailsTable — LOCKED single-source wrapper (sdd payment-details-admin, design.md §8.2).
 *
 * `useServerTable` only surfaces the current page slice (`data`), but the
 * "Sin cuenta activa" banner must know whether the tenant has ANY active
 * account — i.e. a property of the WHOLE list, not the page slice. The
 * backend list is small, flat, and client-paginated, so this wrapper performs
 * **ONE** fetch and:
 *
 *   - keeps the FULL fetched array in `fullList` (unfiltered, unpaginated),
 *   - returns the page slice through useServerTable's `data`,
 *   - derives `hasActiveAccount` from `fullList`.
 *
 * Both the table page and the banner therefore share ONE source of truth.
 *
 * The `useServerTable` primitive is NOT modified — the wrapper is the only
 * contract that returns `fullList` + `hasActiveAccount`.
 *
 * Cache contract (REQ-PD-007):
 *   - queryKey prefix: `adminPaymentDetailQueryKeys.list(tenantId.value)`
 *   - Mutations in S4 invalidate the same prefix so all page/filter/sort
 *     cache slots refresh atomically (TanStack Query prefix-matches arrays).
 */
export function usePaymentDetailsTable() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const fullList = ref<PaymentDetailResponse[]>([])

  const table = useServerTable<PaymentDetailTableRow>({
    queryKey: () => adminPaymentDetailQueryKeys.list(tenantId.value),
    queryFn: async (params) => {
      // Single fetch: capture the flat array for `fullList`, then return the
      // paginated slice from `paginatePaymentDetails`. The local filter/sort
      // helpers are reused so SWR cache-busts stay consistent.
      const rows = await paymentDetailsApi.list()
      fullList.value = rows
      return paginatePaymentDetails(rows, params)
    },
    defaultPageSize: 10,
    persistKey: 'admin-payment-details',
    defaultSorting: [{ id: 'updatedAt', desc: true }],
    defaultPinning: { left: [], right: ['actions'] },
  })

  const hasActiveAccount = computed(() => fullList.value.some((row) => row.isActive))

  return {
    ...table,
    fullList,
    hasActiveAccount,
  }
}
