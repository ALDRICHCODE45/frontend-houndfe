/**
 * `useAvailablePromotions.ts` — fetches the ACTIVE promotions of one method
 * so the quotation detail's SelectMenus can offer the cashier pickable
 * options instead of forcing them to type raw promotion IDs.
 *
 * Cache key: `promotionQueryKeys.available(tenantId, method)` from
 * `@/core/shared/constants/query-keys` — tenant-scoped and method-scoped, so
 * switching tenants never bleeds options and MANUAL/AUTOMATIC pickers keep
 * separate cache slots.
 *
 * The query is gated on a truthy tenantId (auth bootstrap not complete) — the
 * same `enabled` convention used by `useQuotationDetail` / `useQuotationsListTable`.
 */
import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import { promotionApi } from '@/features/POS/promotions/api/promotion.api'
import type {
  PromotionMethod,
  PromotionResponse,
} from '@/features/POS/promotions/interfaces/promotion.types'

export function useAvailablePromotions(
  tenantIdRef: MaybeRefOrGetter<string>,
  method: PromotionMethod,
) {
  const enabled = computed(() => Boolean(toValue(tenantIdRef)))
  const { data, isLoading, isError } = useQuery({
    queryKey: computed(() => promotionQueryKeys.available(toValue(tenantIdRef), method)),
    queryFn: () =>
      promotionApi.getPaginated({
        pageIndex: 0,
        pageSize: 100,
        status: 'ACTIVE',
        method,
      }),
    enabled,
  })

  const promotions = computed<PromotionResponse[]>(() => data.value?.data ?? [])

  return { promotions, isLoading, isError }
}
