import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchCatalogProducts, type CatalogProductsErrorKind } from '../api/catalog-products.api'
import type { PublicCatalogProductsResponseDto } from '../interfaces/public-catalog-products.types'

export type CatalogProductsState =
  | 'loading'
  | 'retry-pending'
  | 'populated'
  | 'empty'
  | 'unavailable'
  | 'rate-limit'
  | 'server'
  | 'network'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// Caller-default and explicit-context identities must never collide, so absence is a marker
// segment instead of a literal id value.
const defaultPriceSelection = ['default'] as const
const explicitPriceSelection = (priceListId: string) => ['explicit', priceListId] as const

export function catalogProductsQueryKey(tenantSlug: string, priceListId?: string | null) {
  // Only null/undefined are absent. Any supplied string stays explicit exactly as given,
  // so a blank or whitespace-only value cannot collide with the caller-default identity.
  const selection =
    priceListId === null || priceListId === undefined
      ? defaultPriceSelection
      : explicitPriceSelection(priceListId)
  return ['public-catalog', 'products', apiBase, tenantSlug, selection] as const
}

export function useCatalogProducts(
  tenantSlug: MaybeRefOrGetter<string | null>,
  priceListId?: MaybeRefOrGetter<string | null>,
) {
  const selectedTenantSlug = computed(() => {
    const slug = toValue(tenantSlug)
    return slug !== null && slug.trim().length > 0 ? slug : null
  })
  const selectedPriceListId = computed<string | null>(() => {
    // Only null/undefined are absent. Preserve any supplied string, including a malformed
    // blank, so direct callers keep an explicit identity distinct from the caller default.
    if (priceListId === undefined) return null
    const value = toValue(priceListId)
    return value === null || value === undefined ? null : value
  })
  const enabled = computed(() => selectedTenantSlug.value !== null)
  const retryRequested = ref(false)
  const query = useQuery<PublicCatalogProductsResponseDto>({
    queryKey: computed(() =>
      catalogProductsQueryKey(selectedTenantSlug.value ?? '', selectedPriceListId.value),
    ),
    queryFn: ({ signal }) => {
      const slug = selectedTenantSlug.value
      if (slug === null)
        throw new Error('A tenant slug is required before fetching catalog products')
      return fetchCatalogProducts(slug, selectedPriceListId.value, signal)
    },
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: false,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    networkMode: 'always',
  })

  const products = computed(() => (enabled.value ? (query.data.value?.items ?? []) : []))
  const response = computed(() => (enabled.value ? (query.data.value ?? null) : null))
  const errorKind = computed<CatalogProductsErrorKind | null>(() => {
    const error = query.error.value
    if (!error) return null
    return 'kind' in error ? (error as { kind: CatalogProductsErrorKind }).kind : 'server'
  })
  const state = computed<CatalogProductsState>(() => {
    if (!enabled.value) return 'empty'
    if (retryRequested.value && query.isFetching.value) return 'retry-pending'
    if (query.isPending.value || query.isFetching.value) return 'loading'
    if (query.isError.value) return errorKind.value ?? 'server'
    return products.value.length > 0 ? 'populated' : 'empty'
  })

  async function retry() {
    if (!enabled.value || query.isFetching.value) return
    retryRequested.value = true
    try {
      await query.refetch()
    } finally {
      retryRequested.value = false
    }
  }

  return { products, response, state, retry }
}
