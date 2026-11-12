import { isStaleCustomerKeyError, readRequestError } from '../utils/requestErrors'

/**
 * Groups, counts and the detail refetch every 30 s while the tab is visible (TanStack's
 * `refetchIntervalInBackground` stays off). Precedent: delivery-zones `useZoneValidations`.
 * SSE (unit 8) replaces this later.
 */
export const REQUESTS_REFETCH_MS = 30_000

/** Page size of the cursor lists (the backend allows 1–50; default 25). */
export const REQUESTS_PAGE_SIZE = 25

/** Audit pages are the largest the backend allows (default 50). */
export const AUDIT_PAGE_SIZE = 50

/**
 * Polling interval that stops once the read can only fail the same way again: a stale token or
 * cursor (`400`, reload instead) or a request that does not exist (`404`).
 */
export function pollingInterval(query: { state: { error: unknown } }): number | false {
  const error = query.state.error
  if (error && (isStaleCustomerKeyError(error) || readRequestError(error).status === 404)) return false
  return REQUESTS_REFETCH_MS
}
