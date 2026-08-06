/**
 * `useQuotationItemStock.ts` — Slice 8 / REQ-QTN-013 (stock badges).
 *
 * Stock info for a quotation item is NOT part of `QuotationItemResponseDto`
 * (backend §4.2 — the embedded `product` is `{id,name,sku,imageUrl}` only).
 * Re-using `productApi.getById` is the simplest way to hydrate stock without
 * adding a new endpoint. The data is purely informational — it NEVER gates
 * any mutation (see spec REQ-QTN-013 "stock badges MUST be advisory only").
 *
 * Design notes:
 *   - The query reuses `productQueryKeys.detail(tenantId, productId)` so
 *     multiple quotation items pointing at the same product share one cache
 *     slot. The ProductDetailView already populates that slot, so quotations
 *     benefit from any in-flight fetch already happening on the page.
 *   - `staleTime: 60_000` (task S8.1 budget). Listings of 30 items stay cheap
 *     because TanStack de-dupes the same `productId` into a single fetch.
 *   - Errors are swallowed: `stock` resolves to `null` and components fall
 *     back to "no badge" — exactly the same surface as the
 *     "useStock === false" path.
 */
import { computed, toRef, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { productApi } from '@/features/POS/products/api/product.api'

/** Stock shape derived from ProductDetail — only the fields the badge cares
 *  about. Lives close to the only consumer to keep cross-module coupling
 *  explicit. */
export interface QuotationItemStock {
  quantity: number
  minQuantity: number
  /** `quantity <= minQuantity && quantity > 0` — warning tone in UI. */
  isLow: boolean
  /** `quantity <= 0` — error tone ("Agotado"). */
  isOut: boolean
}

export function useQuotationItemStock(
  productId: MaybeRefOrGetter<string | null | undefined>,
  variantId?: MaybeRefOrGetter<string | null | undefined>,
) {
  const authStore = useAuthStore()
  // Re-keyed reactively so a row swapping productId triggers a refetch.
  const productIdRef = toRef(productId)
  const variantIdRef = toRef(variantId)
  const tenantId = computed(() => authStore.currentTenantId)
  const trimmedId = computed(() => productIdRef.value?.trim() ?? '')
  const isEnabled = computed(() => trimmedId.value.length > 0)

  const { data, isLoading, isError } = useQuery({
    queryKey: computed(() => productQueryKeys.detail(tenantId.value, trimmedId.value)),
    queryFn: () => productApi.getById(trimmedId.value).then((p) => {
      // Project the fields the badge actually uses; the rest of the shape
      // (variants, prices, lots…) is irrelevant to a row context.
      return {
        id: p.id,
        useStock: p.useStock,
        quantity: p.quantity,
        minQuantity: p.minQuantity,
        hasVariants: p.hasVariants,
        variantStockTotal: p.variantStockTotal,
      }
    }),
    enabled: isEnabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // ── Variant-level stock (only when a variant is selected) ──────────────────
  const variantTrimmedId = computed(() => variantIdRef.value?.trim() ?? '')
  const isVariantEnabled = computed(
    () => isEnabled.value && variantTrimmedId.value.length > 0 && data.value?.hasVariants === true,
  )

  const { data: variantStockData } = useQuery({
    queryKey: computed(() =>
      productQueryKeys.variants(tenantId.value, trimmedId.value),
    ),
    queryFn: () => productApi.getVariants(trimmedId.value),
    enabled: isVariantEnabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  /** Hydrated stock record, or `null` when (a) no fetch ran, (b) the product
   *  has `useStock === false`, or (c) the request failed.
   *
   *  Resolution order:
   *    1. Specific variant's stock (when `variantId` is provided and variants
   *       data is available) — the most accurate per-row number.
   *    2. `variantStockTotal` (aggregate across all variants) for variant
   *       products when no specific variant is selected.
   *    3. `quantity` (product-level) for non-variant products. */
  const stock = computed<QuotationItemStock | null>(() => {
    const p = data.value
    if (!p) return null
    if (!p.useStock) return null

    // Variant-specific stock takes precedence when available.
    const variantId = variantTrimmedId.value
    const variants = variantStockData.value
    if (variantId && variants) {
      const variant = variants.find((v) => v.id === variantId)
      if (variant) {
        return {
          quantity: variant.quantity,
          minQuantity: variant.minQuantity,
          isOut: variant.quantity <= 0,
          isLow: variant.quantity <= variant.minQuantity,
        }
      }
    }

    // Fall back to product-level aggregate.
    const stockQty =
      p.hasVariants && p.variantStockTotal != null
        ? p.variantStockTotal
        : p.quantity
    return {
      quantity: stockQty,
      minQuantity: p.minQuantity,
      isOut: stockQty <= 0,
      isLow: stockQty <= p.minQuantity,
    }
  })

  /** True when at least one fetch completed and `useStock === true`. Components
   *  check `isAvailable` to decide whether to render ANY stock chip. */
  const isAvailable = computed(() => stock.value !== null)

  return {
    stock,
    isAvailable,
    isLoading,
    isError,
  }
}
