/**
 * useSatKeySearch — async search composable for the SatKeySelect UI.
 *
 * Backed by `GET /sat-keys?search=<term>&limit=20&offset=0` via the
 * shared `http` instance. Tenant is carried in the JWT, NEVER sent as
 * a query param.
 *
 * Behavior contract (mirrors spec R1, R2, R5):
 *  - Fires `GET /sat-keys` only when the trimmed term has ≥ MIN_SEARCH_CHARS.
 *  - Debounces input by SEARCH_DEBOUNCE_MS so we don't hammer the API.
 *  - The trimmed term is the query key, so TanStack auto-aborts the
 *    previous in-flight request when the user keeps typing
 *    (cancellation rides the query-key change).
 *  - The queryFn receives `{ signal }` and forwards it to axios so the
 *    HTTP layer can also abort the request body.
 *  - staleTime is 60s — catalog data is stable within a session.
 *
 * The `search` input accepts a plain string, a Ref<string>, or a getter
 * (MaybeRefOrGetter pattern from the create-adaptable-composable skill).
 * Use `toRef` / `toValue` to normalize the value inside reactive effects.
 */
import { ref, computed, watch, onUnmounted, toRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { satKeyQueryKeys } from '@/core/shared/constants/query-keys'
import { searchSatKeys, type SatKey } from '../api/satKey.api'
import {
  MIN_SEARCH_CHARS,
  SEARCH_DEBOUNCE_MS,
  type SatKeyOption,
} from './satKeyHelpers'

// Re-export pure helpers for ergonomic single-import consumers.
export {
  formatSatKeyLabel,
  buildSatKeyOptions,
  mergeCurrentKeyOption,
  deriveSearchState,
  MIN_SEARCH_CHARS,
  SEARCH_DEBOUNCE_MS,
  type SatKeyOption,
  type SatSearchState,
} from './satKeyHelpers'

export function useSatKeySearch(search: MaybeRefOrGetter<string>) {
  const searchRef = toRef(search)

  /** Debounced, trimmed value used as the query key. */
  const debouncedTerm = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    searchRef,
    (value) => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debouncedTerm.value = value.trim()
      }, SEARCH_DEBOUNCE_MS)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  const trimmedDebounced = computed(() => debouncedTerm.value.trim())
  const isEnabled = computed(() => trimmedDebounced.value.length >= MIN_SEARCH_CHARS)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: computed(() => satKeyQueryKeys.search(trimmedDebounced.value)),
    queryFn: ({ signal }) => searchSatKeys(trimmedDebounced.value, { signal }),
    enabled: isEnabled,
    staleTime: 60_000,
  })

  const items = computed<SatKey[]>(() => data.value?.items ?? [])
  const total = computed<number>(() => data.value?.total ?? 0)
  const limit = computed<number>(() => data.value?.limit ?? 0)
  const options = computed<SatKeyOption[]>(() =>
    items.value.map((item) => ({ value: item.key, label: `${item.key} — ${item.description}` })),
  )

  return {
    /** Raw, live search input (bind to the text input v-model). */
    search: searchRef,
    /** Debounced, trimmed term driving the query. */
    debouncedTerm: trimmedDebounced,
    /** Raw SatKey[] from the latest response. */
    items,
    /** Total count returned by the backend. */
    total,
    /** Page size that was applied (echoed by the backend). */
    limit,
    /** Ready-to-render option objects (key, label). */
    options,
    /** True while a request is in flight (including background refetch). */
    isLoading,
    /** True while a request is in flight, ignoring the initial load. */
    isFetching,
    /** Normalized: was a real search request ever fired? */
    isEnabled,
  }
}
