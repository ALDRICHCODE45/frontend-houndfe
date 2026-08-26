import { computed, ref } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { adminPaymentMethodQueryKeys } from '@/core/shared/constants/query-keys'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { paymentMethodsApi, paginatePaymentMethods } from '../api/payment-methods.api'
import type {
  PaymentMethodResponse,
  PaymentMethodTableRow,
} from '../interfaces/payment-method.types'

/**
 * usePaymentMethodsTable — single-source wrapper (sdd custom-payment-methods S2A, design §6).
 *
 * `useServerTable` only surfaces the current page slice (`data`), but the
 * future tile render and any "method is inactive" feedback should be able to
 * derive from the WHOLE list, not the page slice. The backend list is small,
 * flat, and client-paginated, so this wrapper performs **ONE** fetch and:
 *
 *   - keeps the FULL fetched array in `fullList` (unfiltered, unpaginated),
 *   - returns the page slice through useServerTable's `data`,
 *
 * Both the table page and any list-wide flag (future) therefore share ONE
 * source of truth. Unlike payment-details there is no `hasActiveAccount`
 * banner (REQ-PM-001 explicitly omits the "no active methods" banner) —
 * `fullList` is exposed for any consumer that needs the whole tenant set.
 *
 * The `useServerTable` primitive is NOT modified — the wrapper is the only
 * contract that returns `fullList`.
 *
 * Cache contract (REQ-PM-010):
 *   - queryKey prefix: `adminPaymentMethodQueryKeys.list(tenantId.value)`
 *   - Mutations in S3B invalidate the same prefix so all page/filter/sort
 *     cache slots refresh atomically (TanStack Query prefix-matches arrays).
 */
export function usePaymentMethodsTable() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const fullList = ref<PaymentMethodResponse[]>([])

  const table = useServerTable<PaymentMethodTableRow>({
    queryKey: () => adminPaymentMethodQueryKeys.list(tenantId.value),
    queryFn: async (params) => {
      // Single fetch: capture the flat array for `fullList`, then return the
      // paginated slice from `paginatePaymentMethods`. The local filter/sort
      // helpers are reused so SWR cache-busts stay consistent.
      const rows = await paymentMethodsApi.list()
      fullList.value = rows
      return paginatePaymentMethods(rows, params)
    },
    defaultPageSize: 10,
    persistKey: 'admin-payment-methods',
    defaultSorting: [{ id: 'updatedAt', desc: true }],
    defaultPinning: { left: [], right: ['actions'] },
  })

  return {
    ...table,
    fullList,
  }
}