import { whileStreamOpen } from '@/core/realtime/polling'
import { isStaleCustomerKeyError, readRequestError } from '../utils/requestErrors'

/**
 * Groups, counts and the detail refetch every 30 s while the tab is visible (TanStack's
 * `refetchIntervalInBackground` stays off). Precedent: delivery-zones `useZoneValidations`.
 * While the realtime stream is open (`VITE_REALTIME_SSE`, handoff 17) this is only a safety net
 * (`REALTIME_OPEN_REFETCH_MS`): the events patch or invalidate the same queries.
 */
export const REQUESTS_REFETCH_MS = 30_000

/**
 * While a live session changes state (STARTING → ACTIVE, ENDING → ENDED) the detail is refetched as
 * often as the live thread, so «Conectando…» opens the composer promptly (`allowedActions` and the
 * session only move on the detail). ACTIVE stays at the slow cadence: nothing the detail carries
 * needs to be seen sooner there.
 */
export const REQUESTS_LIVE_TRANSITION_REFETCH_MS = 4_000

/** Page size of the cursor lists (the backend allows 1–50; default 25). */
export const REQUESTS_PAGE_SIZE = 25

/** Audit pages are the largest the backend allows (default 50). */
export const AUDIT_PAGE_SIZE = 50

/**
 * Polling interval that stops once the read can only fail the same way again: a stale token or
 * cursor (`400`, reload instead) or a request that does not exist (`404`).
 */
export function pollingInterval(query: { state: { error: unknown } }, streamOpen = false): number | false {
  const error = query.state.error
  if (error && (isStaleCustomerKeyError(error) || readRequestError(error).status === 404)) return false
  return whileStreamOpen(REQUESTS_REFETCH_MS, streamOpen)
}

/**
 * The detail's interval: fast while its live session is STARTING or ENDING, else {@link pollingInterval}.
 * With the stream open the `session.*` events refetch the detail, so the fast cadence is not used.
 */
export function detailPollingInterval(
  query: {
    state: { error: unknown; data?: { liveSession?: { state: string } | null } | undefined }
  },
  streamOpen = false,
): number | false {
  const slow = pollingInterval(query, streamOpen)
  if (slow === false || streamOpen) return slow
  const state = query.state.data?.liveSession?.state
  return state === 'STARTING' || state === 'ENDING' ? REQUESTS_LIVE_TRANSITION_REFETCH_MS : slow
}
