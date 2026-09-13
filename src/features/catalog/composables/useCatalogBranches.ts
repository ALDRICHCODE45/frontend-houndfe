import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { fetchCatalogBranches } from '../api/catalog-branches.api'
import type { PublicBranchDto } from '../interfaces/catalog.types'

export type CatalogBranchesState = 'loading' | 'populated' | 'empty' | 'server'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
export const catalogBranchesQueryKey = ['public-catalog', 'branches', apiBase] as const

export function useCatalogBranches() {
  const query = useQuery<PublicBranchDto[]>({
    queryKey: catalogBranchesQueryKey,
    queryFn: fetchCatalogBranches,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const branches = computed(() => query.data.value ?? [])
  const state = computed<CatalogBranchesState>(() => {
    if (query.isPending.value || query.isFetching.value) return 'loading'
    if (query.isError.value) return 'server'
    return branches.value.length > 0 ? 'populated' : 'empty'
  })

  return { branches, state, retry: () => query.refetch() }
}
