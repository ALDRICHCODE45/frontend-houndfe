import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import {
  fetchCatalogPriceContexts,
  type CatalogPriceContextsErrorKind,
} from '../api/catalog-price-contexts.api'
import type { PublicCatalogPriceContextDto } from '../interfaces/public-catalog-price-context.types'

export type CatalogPriceContextsState =
  | 'idle'
  | 'loading'
  | 'retry-pending'
  | 'populated'
  | 'empty'
  | 'unavailable'
  | 'rate-limit'
  | 'server'
  | 'network'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function catalogPriceContextsQueryKey(tenantSlug: string) {
  return ['public-catalog', 'price-contexts', apiBase, tenantSlug] as const
}

export function useCatalogPriceContexts(tenantSlug: MaybeRefOrGetter<string | null>) {
  const selectedTenantSlug = computed(() => {
    const slug = toValue(tenantSlug)
    return slug !== null && slug.trim().length > 0 ? slug : null
  })
  const enabled = computed(() => selectedTenantSlug.value !== null)
  const retryRequested = ref(false)
  const query = useQuery<PublicCatalogPriceContextDto[]>({
    queryKey: computed(() => catalogPriceContextsQueryKey(selectedTenantSlug.value ?? '')),
    queryFn: ({ signal }) => {
      const slug = selectedTenantSlug.value
      if (slug === null)
        throw new Error('A tenant slug is required before fetching catalog price contexts')
      return fetchCatalogPriceContexts(slug, signal)
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

  const contexts = computed(() => (enabled.value ? (query.data.value ?? []) : []))
  const errorKind = computed<CatalogPriceContextsErrorKind | null>(() => {
    const error = query.error.value
    if (!error) return null
    return 'kind' in error ? (error as { kind: CatalogPriceContextsErrorKind }).kind : 'server'
  })
  const state = computed<CatalogPriceContextsState>(() => {
    if (!enabled.value) return 'idle'
    if (retryRequested.value && query.isFetching.value) return 'retry-pending'
    if (query.isPending.value || query.isFetching.value) return 'loading'
    if (query.isError.value) return errorKind.value ?? 'server'
    return contexts.value.length > 0 ? 'populated' : 'empty'
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

  return { contexts, state, retry }
}
