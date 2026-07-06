/**
 * useSatKeyLookup — single-key hydration composable.
 *
 * Used by the SatKeySelect component to fetch the human label of a
 * pre-existing key on mount (edit-mode hydration). 404 is the
 * "legacy/retired key" path — the select shows the raw key string
 * without crashing.
 *
 * Cancellation rides the trimmed key in the queryKey; the queryFn
 * forwards its AbortSignal to axios via getSatKey.
 */
import { computed, toRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { satKeyQueryKeys } from '@/core/shared/constants/query-keys'
import { getSatKey, type SatKey } from '../api/satKey.api'

export function useSatKeyLookup(key: MaybeRefOrGetter<string>) {
  const keyRef = toRef(key)
  const trimmedKey = computed(() => keyRef.value.trim())

  const isEnabled = computed(() => trimmedKey.value.length > 0)

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: computed(() => satKeyQueryKeys.detail(trimmedKey.value)),
    queryFn: ({ signal }) => getSatKey(trimmedKey.value, { signal }),
    enabled: isEnabled,
    // Edit-time hydration only happens once — pin to a long staleTime
    // so opening/closing the dropdown doesn't refetch.
    staleTime: Infinity,
    retry: false,
  })

  return {
    /** Resolved SatKey entity, or null on 404 / not-yet-fetched. */
    satKey: computed<SatKey | null>(() => data.value ?? null),
    isLoading,
    isFetching,
    error,
    isEnabled,
  }
}
