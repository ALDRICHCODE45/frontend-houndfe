import { computed, hasInjectionContext, shallowRef, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { fetchCatalogBranchDetail } from '../api/catalog-branch-detail.api'
import type { PublicCatalogBranchDetailDto } from '../interfaces/public-catalog-branch.types'

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function catalogBranchDetailQueryKey(slug: string) {
  return ['public-catalog', 'branch-detail', apiBase, slug] as const
}

/** True when a vue-query client is provided; surfaces mounted without one simply show no extras. */
function hasQueryClient(): boolean {
  if (!hasInjectionContext()) return false
  try {
    useQueryClient()
    return true
  } catch {
    return false
  }
}

/**
 * The public branch card (handoff 15 §4). It is an extra: a 404, a network failure or any other
 * error simply means «no branch card» (`branch` stays null), never an error state of the page.
 * The server caches the response for five minutes, so the client keeps it just as long.
 */
export function useCatalogBranchDetail(slug: MaybeRefOrGetter<string | null>) {
  if (!hasQueryClient()) return { branch: shallowRef<PublicCatalogBranchDetailDto | null>(null) }
  const selectedSlug = computed(() => {
    const value = toValue(slug)
    return value !== null && value.trim().length > 0 ? value : null
  })
  const query = useQuery<PublicCatalogBranchDetailDto | null>({
    queryKey: computed(() => catalogBranchDetailQueryKey(selectedSlug.value ?? '')),
    queryFn: ({ signal }) => {
      const value = selectedSlug.value
      if (value === null) throw new Error('A branch slug is required before fetching the branch card')
      // Any failure (404, network, bad shape) is data here: no card, never a query error.
      return fetchCatalogBranchDetail(value, signal).catch(() => null)
    },
    enabled: computed(() => selectedSlug.value !== null),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    networkMode: 'always',
  })
  const branch = computed(() => query.data.value ?? null)
  return { branch }
}
