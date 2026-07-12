/**
 * usePromotionTargetNames — resolves human-readable names for hydrated
 * promotion target entries (categories / brands / products) by
 * cross-referencing the existing product catalogs via TanStack vue-query
 * (cached via useQueryClient.fetchQuery).
 *
 * Used by PromotionForm.vue AFTER `promotionToFormState` hydration in edit
 * mode to patch `name` into `formState.targetItems` (and the buy/get arrays
 * for ADVANCED) so the selected-item chips render the friendly name instead
 * of falling back to the raw UUID.
 *
 * Design notes:
 *   - Pure: the resolver only reads `items` and returns a NEW array; it never
 *     mutates the input or the form state directly (the caller assigns back).
 *   - Cached: results are stored under stable query keys so subsequent
 *     resolutions (e.g. on subsequent edits or selector queries) hit the cache.
 *   - Resilient: per-target failures (404 / network) are swallowed and the
 *     entry keeps its current name. The form keeps rendering — the chip just
 *     falls back to the UUID.
 *   - Idempotent: entries that already have a non-empty `name` are passed
 *     through untouched and the catalog is NOT re-fetched on their behalf.
 */
import { toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { useQueryClient } from '@tanstack/vue-query'
import type {
  PromotionTargetItemFormEntry,
  PromotionTargetType,
} from '../interfaces/promotion.types'

// ── Query keys (stable, namespaced under 'promotions') ─────────────────────────
//
// We use plain stable keys here (not the `productQueryKeys.*` factory) so the
// composable stays self-contained and doesn't depend on the auth store for
// tenantId. These caches are per-process and can be invalidated later via
// queryClient.invalidateQueries if the products feature needs to push updates.

export const promotionTargetNameQueryKeys = {
  categories: () => ['promotions', 'categories-all'] as const,
  brands: () => ['promotions', 'brands-all'] as const,
  product: (id: string) => ['promotions', 'product-by-id', id] as const,
  variantsByProduct: (id: string) =>
    ['promotions', 'variants-by-product', id] as const,
}

// ── Composable ────────────────────────────────────────────────────────────────

export interface UsePromotionTargetNames {
  /**
   * Resolve human-readable names for the given hydrated target entries.
   * Returns a new array; never mutates the input.
   *
   * Signature is `(targetType, items)` — type first, since the type dictates
   * the lookup strategy (catalog vs per-product fetch) and short-circuits
   * cleanly when targetType is empty.
   *
   * Accepts both arguments as value, ref, or getter so callers can pass them
   * straight from reactive form state if they wish — keeping the composable
   * adaptable per the project's composable conventions.
   */
  resolveTargetNames(
    targetType: MaybeRefOrGetter<PromotionTargetType | ''>,
    items: MaybeRefOrGetter<PromotionTargetItemFormEntry[]>,
  ): Promise<PromotionTargetItemFormEntry[]>
}

export function usePromotionTargetNames(): UsePromotionTargetNames {
  const queryClient = useQueryClient()

  async function resolveTargetNames(
    targetTypeInput: MaybeRefOrGetter<PromotionTargetType | ''>,
    itemsInput: MaybeRefOrGetter<PromotionTargetItemFormEntry[]>,
  ): Promise<PromotionTargetItemFormEntry[]> {
    const targetType = toValue(targetTypeInput)
    const items = toValue(itemsInput)

    // Nothing to resolve → short-circuit so we never hit the network.
    if (!items || items.length === 0) return []

    switch (targetType) {
      case 'CATEGORIES':
        return resolveViaCategories(queryClient, items)
      case 'BRANDS':
        return resolveViaBrands(queryClient, items)
      case 'PRODUCTS':
        return resolveProducts(queryClient, items)
      case 'VARIANTS':
        return resolveVariants(queryClient, items)
      default:
        // Unknown target type (e.g. '' before user picks) — return as-is.
        return items.map((item) => ({ ...item }))
    }
  }

  return { resolveTargetNames }
}

// ── Private helpers ───────────────────────────────────────────────────────────

type NameEntry = { id: string; name: string }

type ProductApi = {
  getCategories: () => Promise<NameEntry[]>
  getBrands: () => Promise<NameEntry[]>
  getById: (id: string) => Promise<NameEntry>
}

function fillNamesFromLookup(
  items: PromotionTargetItemFormEntry[],
  lookup: Map<string, string>,
): PromotionTargetItemFormEntry[] {
  return items.map((item) => {
    // Idempotent: skip entries that already carry a friendly name.
    if (item.name.trim().length > 0) return { ...item }
    const name = lookup.get(item.targetId)
    return name ? { targetId: item.targetId, name } : { ...item }
  })
}

async function resolveViaCategories(
  queryClient: QueryClient,
  items: PromotionTargetItemFormEntry[],
): Promise<PromotionTargetItemFormEntry[]> {
  // Idempotent short-circuit: if every entry already has a name, skip the
  // network entirely so we don't trigger a catalog fetch on every render.
  if (items.every((i) => i.name.trim().length > 0)) return items.map((i) => ({ ...i }))
  return resolveViaCatalog(queryClient, items, promotionTargetNameQueryKeys.categories(), 'categories')
}

async function resolveViaBrands(
  queryClient: QueryClient,
  items: PromotionTargetItemFormEntry[],
): Promise<PromotionTargetItemFormEntry[]> {
  if (items.every((i) => i.name.trim().length > 0)) return items.map((i) => ({ ...i }))
  return resolveViaCatalog(queryClient, items, promotionTargetNameQueryKeys.brands(), 'brands')
}

async function resolveViaCatalog(
  queryClient: QueryClient,
  items: PromotionTargetItemFormEntry[],
  queryKey: readonly unknown[],
  flavor: 'categories' | 'brands',
): Promise<PromotionTargetItemFormEntry[]> {
  try {
    // Dynamic import keeps the products API out of the composable graph until
    // we actually need to resolve categories/brands (edit-mode only path).
    const { productApi } = await import('@/features/POS/products/api/product.api')

    const catalog = await queryClient.fetchQuery<NameEntry[]>({
      queryKey,
      queryFn: () =>
        flavor === 'categories' ? productApi.getCategories() : productApi.getBrands(),
      // 5 minutes: catalogs rarely change during a session.
      staleTime: 5 * 60_000,
    })

    const lookup = new Map<string, string>(catalog.map((entry) => [entry.id, entry.name]))
    return fillNamesFromLookup(items, lookup)
  } catch (error) {
    // Network / parsing failure → keep entries as-is (chip falls back to UUID).
    // Log once so it's diagnosable in dev without crashing the form.
    console.warn('[usePromotionTargetNames] failed to resolve catalog', {
      queryKey,
      error,
    })
    return items.map((item) => ({ ...item }))
  }
}

async function resolveProducts(
  queryClient: QueryClient,
  items: PromotionTargetItemFormEntry[],
): Promise<PromotionTargetItemFormEntry[]> {
  // If every entry already has a name, skip the network entirely (idempotent).
  if (items.every((i) => i.name.trim().length > 0)) return items.map((i) => ({ ...i }))

  try {
    // Dynamic import keeps the products API out of the composable graph until
    // we actually need to resolve products.
    const productModule = await import('@/features/POS/products/api/product.api')
    const productApi: ProductApi = productModule.productApi as ProductApi

    const settled = await Promise.allSettled(
      items.map((item) => {
        if (item.name.trim().length > 0) return Promise.resolve(item.name)
        return fetchProductName(queryClient, productApi, item.targetId)
      }),
    )

    return items.map((item, index) => {
      // Idempotent: original entry already has a name → keep it untouched.
      if (item.name.trim().length > 0) return { ...item }
      const result = settled[index]
      if (result && result.status === 'fulfilled' && result.value) {
        return { targetId: item.targetId, name: result.value }
      }
      // Failure (404 / network) → keep the original entry (empty name → chip
      // renders the UUID). Never throws.
      return { ...item }
    })
  } catch (error) {
    console.warn('[usePromotionTargetNames] failed to resolve products', { error })
    return items.map((item) => ({ ...item }))
  }
}

async function fetchProductName(
  queryClient: QueryClient,
  productApi: ProductApi,
  id: string,
): Promise<string | null> {
  try {
    const product = await queryClient.fetchQuery<NameEntry>({
      queryKey: promotionTargetNameQueryKeys.product(id),
      queryFn: () => productApi.getById(id),
      // Products change more often; shorter stale window.
      staleTime: 60_000,
    })
    return product?.name ?? null
  } catch {
    return null
  }
}

type VariantEntry = { id: string; name: string }

/**
 * Resolve VARIANTS target names on edit-mode hydration.
 *
 * A VARIANTS entry that carries a `productId` (created in this session) can be
 * resolved by fetching that product's variants via productApi.getVariants and
 * mapping variantId → name. We group items by productId so each product's
 * variants are fetched EXACTLY ONCE per resolver call (and then cached by
 * QueryClient across subsequent calls).
 *
 * Entries WITHOUT a productId (e.g. loaded fresh from the backend in edit
 * mode) cannot be resolved — they're returned unchanged so the chip falls
 * back to the variant id. This matches the design's "honest fallback" choice:
 * the backend has no parent product relation to traverse.
 *
 * Like resolveProducts, this helper is wrapped in try/catch and NEVER throws
 * — per-resolver failure must not block the form from rendering.
 */
async function resolveVariants(
  queryClient: QueryClient,
  items: PromotionTargetItemFormEntry[],
): Promise<PromotionTargetItemFormEntry[]> {
  // Idempotent: skip the network entirely if every entry already has a name.
  if (items.every((i) => i.name.trim().length > 0)) {
    return items.map((i) => ({ ...i }))
  }

  try {
    const productModule = await import('@/features/POS/products/api/product.api')
    const productApi: ProductApi & { getVariants: (id: string) => Promise<VariantEntry[]> } =
      productModule.productApi as ProductApi & {
        getVariants: (id: string) => Promise<VariantEntry[]>
      }

    // Group resolvable entries by productId — fetch each product once.
    const resolvable = items.filter(
      (i) => i.name.trim().length === 0 && typeof i.productId === 'string' && i.productId.length > 0,
    )
    const productIds = Array.from(new Set(resolvable.map((i) => i.productId!)))

    const lookups = await Promise.all(
      productIds.map(async (productId) => {
        try {
          const variants = await queryClient.fetchQuery<VariantEntry[]>({
            queryKey: promotionTargetNameQueryKeys.variantsByProduct(productId),
            queryFn: () => productApi.getVariants(productId),
            // Variants change more often; shorter stale window matches the
            // ProductVariantSelector picker for consistency.
            staleTime: 60_000,
          })
          return [productId, new Map(variants.map((v) => [v.id, v.name]))] as const
        } catch {
          // Per-product failure → return empty map; entries will fall through
          // unchanged. Never let one bad product take down the whole batch.
          return [productId, new Map<string, string>()] as const
        }
      }),
    )
    const lookupByProduct = new Map<string, Map<string, string>>(lookups)

    return items.map((item) => {
      // Idempotent: original entry already has a name → keep it untouched.
      if (item.name.trim().length > 0) return { ...item }
      // Unresolvable: no productId → return as-is (chip falls back to id).
      if (!item.productId) return { ...item }
      const lookup = lookupByProduct.get(item.productId)
      const resolvedName = lookup?.get(item.targetId)
      return resolvedName
        ? { ...item, name: resolvedName }
        : { ...item }
    })
  } catch (error) {
    console.warn('[usePromotionTargetNames] failed to resolve variants', { error })
    return items.map((item) => ({ ...item }))
  }
}
