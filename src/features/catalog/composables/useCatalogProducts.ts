import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchCatalogProducts } from '../api/catalog-products.api'
import type { PublicCatalogProductsResponseDto } from '../interfaces/public-catalog-products.types'

export type CatalogProductsState =
  | 'loading'
  | 'retry-pending'
  | 'populated'
  | 'empty'
  | 'rate-limit'
  | 'server'
  | 'network'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function catalogProductsQueryKey(tenantSlug: string) {
  return ['public-catalog', 'products', apiBase, tenantSlug] as const
}

export function useCatalogProducts(tenantSlug: MaybeRefOrGetter<string | null>) {
  const selectedTenantSlug = computed(() => {
    const slug = toValue(tenantSlug)
    return slug !== null && slug.trim().length > 0 ? slug : null
  })
  const enabled = computed(() => selectedTenantSlug.value !== null)
  const retryRequested = ref(false)
  const query = useQuery<PublicCatalogProductsResponseDto>({
    queryKey: computed(() => catalogProductsQueryKey(selectedTenantSlug.value ?? '')),
    queryFn: ({ signal }) => {
      const slug = selectedTenantSlug.value
      if (slug === null)
        throw new Error('A tenant slug is required before fetching catalog products')
      return fetchCatalogProducts(slug, signal)
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
  const errorKind = computed(() => {
    const error = query.error.value
    if (!error) return null
    return 'kind' in error
      ? (error as { kind: 'rate-limit' | 'server' | 'network' }).kind
      : 'server'
  })
  const state = computed<CatalogProductsState>(() => {
    if (!enabled.value) return 'empty'
    if (retryRequested.value && query.isFetching.value) return 'retry-pending'
    if (query.isPending.value || query.isFetching.value) return 'loading'
    if (query.isError.value)
      return errorKind.value === 'rate-limit'
        ? 'rate-limit'
        : errorKind.value === 'network'
          ? 'network'
          : 'server'
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
