// useCatalogPriceListCandidatesQuery.ts — WU3B candidate enumeration (REQ-6A).
// Reuses productApi.getGlobalPriceLists() and its existing
// productQueryKeys.globalPriceLists() key. Fires ONLY when BOTH
// update:TenantCatalogSettings AND read:GlobalPriceList are granted; candidate
// rows never redefine accepted public membership — that always comes from
// settings priceContexts.

import { computed, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { productApi } from '@/features/POS/products/api/product.api'
import type { GlobalPriceList } from '@/features/POS/products/interfaces/product.types'

export interface UseCatalogPriceListCandidatesQueryResult {
  candidates: Ref<GlobalPriceList[] | undefined>
  isLoading: Ref<boolean>
  isError: Ref<boolean>
  refetch: () => Promise<unknown>
}

export function useCatalogPriceListCandidatesQuery(
  canUpdateSettings: MaybeRefOrGetter<boolean>,
  canReadGlobalPriceLists: MaybeRefOrGetter<boolean>,
): UseCatalogPriceListCandidatesQueryResult {
  // Least privilege: BOTH grants must hold before any candidate request.
  const enabled = computed(
    () => toValue(canUpdateSettings) && toValue(canReadGlobalPriceLists),
  )

  const query = useQuery({
    queryKey: productQueryKeys.globalPriceLists(),
    queryFn: () => productApi.getGlobalPriceLists(),
    enabled,
  })

  return {
    candidates: query.data as Ref<GlobalPriceList[] | undefined>,
    isLoading: query.isLoading,
    isError: query.isError,
    // Manual refetch is guarded by the SAME computed permission gate (REQ-6A:
    // a missing grant must never issue a candidate request, even manually).
    refetch: () => (enabled.value ? query.refetch() : Promise.resolve()),
  }
}
