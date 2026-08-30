/**
 * useCockpitBreakpoint — S2 of `driver-cockpit-responsive-polish` (REQ-DCK-009).
 *
 * Single reactive breakpoint authority reading Tailwind's `lg` boundary
 * (1024px), consistent with the app shell sidebar behavior. Wraps
 * @vueuse/core's `useMediaQuery` so the cockpit owns the ONE invocation and
 * children receive the resolved `isDesktop` value as a required prop.
 *
 * Returns a plain object with the single `isDesktop: ComputedRef<boolean>` key.
 * No second surface key — by design (REQ-DCK-009: "no second, divergent
 * breakpoint value exists for cockpit overlay selection"). The overlay
 * imports the value through props; it MUST NOT call this composable itself.
 */
import { useMediaQuery } from '@vueuse/core'
import { type ComputedRef } from 'vue'

const LG_QUERY = '(min-width: 1024px)'

export interface CockpitBreakpoint {
  isDesktop: ComputedRef<boolean>
}

export function useCockpitBreakpoint(): CockpitBreakpoint {
  const isDesktop = useMediaQuery(LG_QUERY)
  return { isDesktop }
}
