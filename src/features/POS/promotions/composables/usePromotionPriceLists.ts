/**
 * usePromotionPriceLists — the one ['price-lists'] query of the promotion form.
 *
 * PromotionConditionsSection (picker) and PromotionForm (summary names) both call
 * it, so they share the key, fetcher and gate: one cache entry, one request.
 * The API module is imported lazily so the form chunk stays light.
 */
import { useQuery } from '@tanstack/vue-query'

export const PROMOTION_PRICE_LISTS_QUERY_KEY = ['price-lists'] as const

/** `enabled` opens the request — the form's «Listas de precios» condition. */
export function usePromotionPriceLists(enabled: () => boolean) {
  return useQuery({
    queryKey: PROMOTION_PRICE_LISTS_QUERY_KEY,
    queryFn: async () => {
      const { productApi } = await import('@/features/POS/products/api/product.api')
      return productApi.getGlobalPriceLists()
    },
    enabled,
  })
}
