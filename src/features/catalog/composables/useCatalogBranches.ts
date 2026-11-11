import { computed, hasInjectionContext, ref, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchCatalogBranches } from '../api/catalog-branches.api'
import type { PublicBranchDto } from '../interfaces/catalog.types'

export type CatalogBranchesState = 'loading' | 'retry-pending' | 'populated' | 'empty' | 'rate-limit' | 'server' | 'network'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const catalogBranchesQueryKey = ['public-catalog', 'branches', apiBase] as const

export function useCatalogBranches() {
  const retryRequested = ref(false)
  const query = useQuery<PublicBranchDto[]>({
    queryKey: catalogBranchesQueryKey,
    queryFn: ({ signal }) => fetchCatalogBranches(signal),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    networkMode: 'always',
  })
  const branches = computed(() => query.data.value ?? [])
  const errorKind = computed(() => {
    const error = query.error.value
    if (!error) return null
    return 'kind' in error ? (error as { kind: 'rate-limit' | 'server' | 'network' }).kind : 'server'
  })
  const state = computed<CatalogBranchesState>(() => {
    if (retryRequested.value && query.isFetching.value) return 'retry-pending'
    if (query.isPending.value || query.isFetching.value) return 'loading'
    if (query.isError.value) return errorKind.value === 'rate-limit' ? 'rate-limit' : errorKind.value === 'network' ? 'network' : 'server'
    return branches.value.length > 0 ? 'populated' : 'empty'
  })

  async function retry() {
    if (query.isFetching.value) return
    retryRequested.value = true
    try {
      await query.refetch()
    } finally {
      retryRequested.value = false
    }
  }

  return { branches, state, retry }
}

/**
 * The branch of a slug read from the shared branches query without ever requesting it: the
 * listing view already owns that request, so a card or a footer only observes the cache.
 * Without a query client (or before the branches arrive) the branch is null.
 */
export function useCachedCatalogBranch(slug: MaybeRefOrGetter<string | null | undefined>) {
  let hasClient = false
  if (hasInjectionContext()) {
    try {
      useQueryClient()
      hasClient = true
    } catch {
      hasClient = false
    }
  }
  if (!hasClient) return { branch: shallowRef<PublicBranchDto | null>(null) }
  const query = useQuery<PublicBranchDto[]>({
    queryKey: catalogBranchesQueryKey,
    queryFn: ({ signal }) => fetchCatalogBranches(signal),
    enabled: false,
  })
  const branch = computed(() => {
    const value = toValue(slug)
    return (query.data.value ?? []).find((entry) => entry.slug === value) ?? null
  })
  return { branch }
}
