import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { ActivePaymentMethodProjection } from '../interfaces/sale.types'

const STALE_TIME_MS = 5 * 60_000 // 5 minutes (REQ-PT-003 — generous so the
// cashier does not refetch while opening the modal for the second time during
// the same sale).

/**
 * useSalePaymentMethods — sdd custom-payment-methods S4A (REQ-PT-003)
 *
 * TanStack Query wrapper over `GET /sales/payment-methods`. Returns the active
 * catalog projection. The query is NOT gated by CASL `read:PaymentMethod`
 * (the cashier has `read:Sale`; the catalog projection is part of the
 * charge flow per REQ-PT-008).
 *
 * Cache contract:
 *   - queryKey: `saleQueryKeys.paymentMethods(tenantId)`
 *   - staleTime: 5 minutes (REQ-PT-003 — generous; the catalog rarely changes
 *     during a sale session)
 *   - refetchOnWindowFocus: false (REQ-PT-003 — no surprise refetches while
 *     the cashier is mid-charge)
 *   - Invalidation is owned by S5A dispatch (PAYMENT_METHOD_NOT_FOUND /
 *     INACTIVE_PAYMENT_METHOD) and admin mutations do NOT invalidate this
 *     key (REQ-PM-010 cross-check).
 */
export function useSalePaymentMethods() {
  const tenantId = useSafeTenantId()

  const query = useQuery<ActivePaymentMethodProjection[]>({
    queryKey: computed(() => saleQueryKeys.paymentMethods(tenantId.value)),
    queryFn: () => saleApi.getPaymentMethods(),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
    enabled: computed(() => tenantId.value !== ''),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}