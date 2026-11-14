import { useMediaQuery, useSupported } from '@vueuse/core'
import { computed, type ComputedRef } from 'vue'

/** The catalog gets its sidebar (and a wrapping animal strip) at 901px; below it, a phone layout. */
const WIDE_QUERY = '(min-width: 901px)'

/**
 * True on a phone-sized viewport. Without `matchMedia` (SSR, old test environments) the answer is
 * «wide», so the desktop layout is the safe default.
 */
export function useCompactViewport(): { isCompact: ComputedRef<boolean> } {
  const wide = useMediaQuery(WIDE_QUERY)
  const supported = useSupported(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function',
  )
  return { isCompact: computed(() => supported.value && !wide.value) }
}
