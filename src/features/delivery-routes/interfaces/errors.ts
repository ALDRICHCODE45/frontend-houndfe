/**
 * Domain error codes + Spanish user-facing copy for the DeliveryRoute module.
 *
 * Locked contract (sdd delivery-routes, design.md §7.1, §7.2):
 *   - The backend emits `{ statusCode, error: <CODE>, message, timestamp }`.
 *     The CODE lives in `error` (NOT `message`) — same defensive shape as
 *     `extractPaymentDetailErrorCode`. Reading `message` would couple us to a
 *     corrupted domain map (Nest class-validator uses `message: string[]`).
 *   - Specific codes surface a specific Spanish toast; anything else falls
 *     back to the generic `normalizeApiError` helper in `error.utils.ts`.
 *   - Channel routing per code is owned by `surfaceDeliveryRouteError` (see
 *     design §7.2): toast vs inline field vs full-page "Ruta no encontrada".
 */

import { normalizeApiError } from '@/core/shared/utils/error.utils'

export type DeliveryRouteDomainErrorCode =
  | 'DELIVERY_ROUTE_INVALID_TRANSITION'
  | 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE'
  | 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE'
  | 'ENTITY_NOT_FOUND'

/**
 * DELIVERY_ROUTE_ERROR_MAP — Domain code → user-facing Spanish copy.
 * Copy matches design §7.1 verbatim. Do not edit without updating the spec.
 */
export const DELIVERY_ROUTE_ERROR_MAP: Record<DeliveryRouteDomainErrorCode, string> = {
  DELIVERY_ROUTE_INVALID_TRANSITION:
    'La ruta no permite esta acción en su estado actual.',
  DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE:
    'Una de las ventas no es elegible (debe estar pendiente o enviada y tener dirección de envío).',
  DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE:
    'Una de las ventas ya pertenece a otra ruta activa.',
  ENTITY_NOT_FOUND: 'Ruta no encontrada.',
}

interface MaybeAxiosError {
  response?: { data?: { error?: unknown } }
}

/**
 * extractDeliveryRouteErrorCode — pure extractor.
 *
 * Reads ONLY `error.response.data.error` (never `error.message`). Returns the
 * domain code when it is a known key, otherwise `null`. Mirrors
 * `extractPaymentDetailErrorCode`.
 *
 * Pure: never throws; accepts `unknown` so callers don't have to cast.
 */
export function extractDeliveryRouteErrorCode(
  error: unknown,
): DeliveryRouteDomainErrorCode | null {
  const maybe = error as MaybeAxiosError
  const code = maybe?.response?.data?.error
  if (typeof code === 'string' && code in DELIVERY_ROUTE_ERROR_MAP) {
    return code as DeliveryRouteDomainErrorCode
  }
  return null
}

// ─── Surfacing channel (design §7.2) ────────────────────────────────────────

/**
 * DeliveryRouteErrorChannel — Where the user sees the error.
 *
 *   - `toast`      : surface a `<UToast>` (default). Used for transition /
 *                    conflict / generic failures.
 *   - `inline`     : render the message as a field-level error (e.g. the
 *                    picker / slideover). Used for `STOP_SALE_NOT_ELIGIBLE`
 *                    on create + append-stop.
 *   - `full-page`  : render a full-page not-found state ("Ruta no
 *                    encontrada"). Used for `ENTITY_NOT_FOUND` on detail.
 *
 * Each channel produces a different "side-effect collaborator" object so the
 * helper stays decoupled from any specific toast runtime / inline render
 * function / route component.
 */
export type DeliveryRouteErrorChannel = 'toast' | 'inline' | 'full-page'

/**
 * DeliveryRouteErrorSurface — Channel-specific collaborators.
 *
 * The `surfaceDeliveryRouteError` helper delegates the visible side-effect to
 * these functions so the unit test can assert the channel routing without
 * mounting any Vue component. The defaults are the standard production wiring
 * (toast → `addToast`, inline → `setInlineError`, full-page → `setFullPage`).
 *
 * `setInlineError` and `setFullPage` are optional — when omitted, an inline /
 * full-page code falls back to the toast channel (preserving the spec wording
 * while letting call sites opt in to richer surfacing as it lands).
 */
export interface DeliveryRouteErrorSurface {
  addToast: (toast: { title: string; description?: string; color: 'success' | 'error' | 'warning' }) => void
  setInlineError?: (message: string) => void
  setFullPage?: (code: DeliveryRouteDomainErrorCode) => void
}

/**
 * Default channel routing per domain code (design §7.2 table).
 *
 * S5a only consumes the `toast` channel (the reorder panel is the only
 * S5a caller and only fires toasts on 422 INVALID_TRANSITION). S5b / S6a
 * mutation composables will pass `inline` for `STOP_SALE_NOT_ELIGIBLE` and
 * `full-page` for `ENTITY_NOT_FOUND` on detail fetches.
 */
function defaultChannelFor(code: DeliveryRouteDomainErrorCode): DeliveryRouteErrorChannel {
  switch (code) {
    case 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE':
      return 'inline'
    case 'ENTITY_NOT_FOUND':
      // 404 is either toast (action) or full-page (detail fetch) — the caller
      // picks. We default to full-page to surface the absence safely; callers
      // that want a toast for an action mutation explicitly pass channel='toast'.
      return 'full-page'
    case 'DELIVERY_ROUTE_INVALID_TRANSITION':
    case 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE':
      return 'toast'
    default:
      return 'toast'
  }
}

/**
 * surfaceDeliveryRouteError — Single pure router for every DeliveryRoute
 * mutation. Maps the domain code to the right Spanish copy and delegates to
 * the matching collaborator on `surface`. Falls back to `normalizeApiError`
 * (from `@/core/shared/utils/error.utils`) for non-domain failures.
 *
 * Pure: never throws; accepts `unknown` so callers don't have to cast.
 *
 * Reused by S5a (useReorderStops) and S5b (useDeleteDeliveryRoute,
 * useStartDeliveryRoute, useCancelDeliveryRoute, useAppendDeliveryRouteStop)
 * to keep the error wording + channel routing in ONE place.
 */
export function surfaceDeliveryRouteError(
  error: unknown,
  channel: DeliveryRouteErrorChannel,
  surface: DeliveryRouteErrorSurface,
  fallbackTitle = 'No se pudo completar la operación',
): void {
  const code = extractDeliveryRouteErrorCode(error)

  if (code) {
    // Caller-specified channel wins (e.g. ENTITY_NOT_FOUND on an action
    // mutation → toast instead of the default full-page). If the resolved
    // channel doesn't have a collaborator (e.g. channel='inline' but no
    // setInlineError), we fall through to the toast channel.
    const resolvedChannel: DeliveryRouteErrorChannel = channel ?? defaultChannelFor(code)
    const message = DELIVERY_ROUTE_ERROR_MAP[code]

    if (resolvedChannel === 'inline' && surface.setInlineError) {
      surface.setInlineError(message)
      return
    }
    if (resolvedChannel === 'full-page' && surface.setFullPage) {
      surface.setFullPage(code)
      return
    }
    surface.addToast({ title: message, color: 'error' })
    return
  }

  // Non-domain error (transport failure, 5xx, unknown code) — always toast.
  const normalized = normalizeApiError(error, fallbackTitle)
  surface.addToast({
    title: fallbackTitle,
    description: normalized.message,
    color: 'error',
  })
}