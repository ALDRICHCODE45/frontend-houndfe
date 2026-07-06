/**
 * Pure helpers for SatKeySelect — exported separately so they can be
 * unit-tested with ZERO mocks (no vue, no vue-query, no network).
 *
 * Re-exported from `useSatKeySearch.ts` for ergonomic imports inside the
 * component layer.
 */
import type { SatKey } from '../api/satKey.api'

export interface SatKeyOption {
  /** 8-digit key string — used as the v-model value */
  value: string
  /** "key — description" — rendered in the dropdown */
  label: string
}

export type SatSearchState = 'idle' | 'loading' | 'no-matches' | 'results'

/** Structural subset the helpers actually consume. Lets tests pass minimal objects. */
type SatKeyLike = Pick<SatKey, 'key' | 'description'>

/** Minimum trimmed-length before a search request fires (per spec R1). */
export const MIN_SEARCH_CHARS = 2
/** Debounce window (per spec R1, "250-300ms" — choose the upper bound). */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * Build the user-visible label for a single sat-key option.
 * Format: `"<key> — <description>"`. Falls back to the description
 * alone when the key is empty (defensive — never expected at runtime).
 */
export function formatSatKeyLabel(key: string, description: string): string {
  if (!key) return description
  return `${key} — ${description}`
}

/**
 * Map an array of SatKey entities to dropdown option shape.
 * Accepts the structural subset (key + description) — the helper
 * does not read the translado/validity fields.
 */
export function buildSatKeyOptions(items: SatKeyLike[]): SatKeyOption[] {
  return items.map((item) => ({
    value: item.key,
    label: formatSatKeyLabel(item.key, item.description),
  }))
}

/**
 * Prepend the current selected option so the trigger can render its
 * human label even before any search results have arrived (edit-mode
 * hydration). No-op if the current is null or already in the list.
 */
export function mergeCurrentKeyOption(
  options: SatKeyOption[],
  current: SatKeyOption | null | undefined,
): SatKeyOption[] {
  if (!current) return options
  if (options.some((o) => o.value === current.value)) return options
  return [current, ...options]
}

/**
 * Collapse the (term, isLoading, items) trio into a single visual-state
 * token the template can switch on. Loading wins over no-matches
 * because a request is in-flight.
 */
export function deriveSearchState(args: {
  term: string
  isLoading: boolean
  items: SatKeyOption[]
}): SatSearchState {
  const { term, isLoading, items } = args
  const trimmed = term.trim()
  if (!trimmed) return 'idle'
  if (isLoading) return 'loading'
  if (items.length === 0) return 'no-matches'
  return 'results'
}
