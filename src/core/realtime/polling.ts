import { computed, type ComputedRef } from 'vue'
import { isRealtimeEnabled } from './config'
import { useRealtime } from './useRealtime'

/**
 * Safety-net interval of a query the stream keeps fresh. The stream is an accelerator, not the
 * source of truth (handoff 17), so an open stream slows the polling down instead of ending it.
 */
export const REALTIME_OPEN_REFETCH_MS = 300_000

/**
 * The interval to use now: the base one while the stream is not open, and at least `openMs` while
 * it is. `false` (no polling) stays `false`; a base already longer than `openMs` is kept.
 */
export function whileStreamOpen(
  baseMs: number | false,
  open: boolean,
  openMs: number = REALTIME_OPEN_REFETCH_MS,
): number | false {
  if (baseMs === false) return false
  return open ? Math.max(baseMs, openMs) : baseMs
}

const NEVER_OPEN: ComputedRef<boolean> = computed(() => false)

/**
 * `true` while the stream is `open` (in this tab, or in the leader tab it mirrors). With the flag
 * off it is a constant `false` and the realtime service is never created. Call it in setup: the
 * subscription ends with the scope.
 */
export function useRealtimeOpen(): ComputedRef<boolean> {
  if (!isRealtimeEnabled()) return NEVER_OPEN
  const { status } = useRealtime()
  return computed(() => status.value.state === 'open')
}
