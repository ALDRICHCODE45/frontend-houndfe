/**
 * Domain error codes + Spanish user-facing copy for the DeliveryRoute module.
 *
 * Locked contract (sdd delivery-routes, design.md §7.1):
 *   - The backend emits `{ statusCode, error: <CODE>, message, timestamp }`.
 *     The CODE lives in `error` (NOT `message`) — same defensive shape as
 *     `extractPaymentDetailErrorCode`. Reading `message` would couple us to a
 *     corrupted domain map (Nest class-validator uses `message: string[]`).
 *   - Specific codes surface a specific Spanish toast; anything else falls
 *     back to the generic `normalizeApiError` helper in `error.utils.ts`.
 *   - Channel routing per code is the caller's responsibility (see design §7.2):
 *     toast vs inline field vs full-page "Ruta no encontrada".
 */

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