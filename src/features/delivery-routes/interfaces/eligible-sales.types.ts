/**
 * eligible-sales.types.ts — DTOs for the authoritative eligible-sales endpoint
 * (T3 S3, backend contract `GET /delivery-routes/eligible-sales`).
 *
 * Locked contract (no fabrication — every field below is supplied by the
 * backend; the client NEVER derives eligibility or availability locally):
 *
 *   GET /delivery-routes/eligible-sales
 *     query: page (default 1), limit (default 20, range 1..100),
 *            q (optional, max 200), contextRouteId (optional UUIDv4)
 *     requires: read:Sale AND create:DeliveryRoute
 *     → { data: Row[], pagination: { page, limit, total, totalPages } }
 *
 *   Row.availability is a discriminated union:
 *     { state: 'AVAILABLE' }
 *     { state: 'IN_CURRENT_ROUTE', stopId, sortOrder }
 *     { state: 'OCCUPIED', reason: 'RESERVED_BY_ROUTE',
 *       occupiedRoute: { id, status: 'DRAFT'|'ACTIVE' } | null }
 *     { state: 'INELIGIBLE', reason: 'MISSING_ADDRESS'|'DELIVERY_STATUS' }
 *
 *   Only `AVAILABLE` is selectable. `OCCUPIED` (even with a null
 *   `occupiedRoute`) is unavailable.
 *
 *   Backend order: confirmedAt DESC NULLS LAST, id DESC.
 */

// ─── Shipping address projection (eligible-sales shape) ────────────────────────
export interface EligibleSaleAddress {
  id: string
  label: string | null
  street: string
  exteriorNumber: string | null
  interiorNumber: string | null
  neighborhood: string | null
  municipality: string | null
  city: string | null
  state: string | null
  zipCode: string | null
}

// ─── Availability discriminant ─────────────────────────────────────────────────
export interface EligibleSaleAvailabilityAvailable {
  state: 'AVAILABLE'
}

export interface EligibleSaleAvailabilityInCurrentRoute {
  state: 'IN_CURRENT_ROUTE'
  stopId: string
  sortOrder: number
}

export interface EligibleSaleAvailabilityOccupied {
  state: 'OCCUPIED'
  reason: 'RESERVED_BY_ROUTE'
  occupiedRoute: { id: string, status: 'DRAFT' | 'ACTIVE' } | null
}

export interface EligibleSaleAvailabilityIneligible {
  state: 'INELIGIBLE'
  reason: 'MISSING_ADDRESS' | 'DELIVERY_STATUS'
}

export type EligibleSaleAvailability =
  | EligibleSaleAvailabilityAvailable
  | EligibleSaleAvailabilityInCurrentRoute
  | EligibleSaleAvailabilityOccupied
  | EligibleSaleAvailabilityIneligible

// ─── Row + envelope ────────────────────────────────────────────────────────────
export interface EligibleSaleRow {
  id: string
  folio: string | null
  status: string
  paymentStatus: string | null
  deliveryStatus: string
  totalCents: number
  debtCents: number
  /** ISO 8601 or null (newer sales may not be confirmed yet). */
  confirmedAt: string | null
  /** ISO 8601 or null. */
  dueDate: string | null
  customer: { id: string, name: string } | null
  shippingAddress: EligibleSaleAddress | null
  /** Already capped at 3 entries by the backend (empty on the legacy path). */
  productSummary: string[]
  /**
   * Authoritative availability from the dedicated endpoint. ABSENT on the
   * legacy confirmed-sales path (append), where the client has NO authoritative
   * availability and must not claim any.
   */
  availability?: EligibleSaleAvailability
}

export interface EligibleSalesPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface EligibleSalesResponse {
  data: EligibleSaleRow[]
  pagination: EligibleSalesPagination
}

/** Query bag accepted by the composable + sent to the endpoint. */
export interface EligibleSalesQuery {
  page?: number
  limit?: number
  q?: string
  contextRouteId?: string
}

/**
 * isEligibleSaleSelectable — the ONLY selectable availability state.
 *
 * `IN_CURRENT_ROUTE` is intentionally NOT selectable: it already belongs to the
 * route being edited (or is out of scope for the create flow), so toggling it
 * would be a no-op. `OCCUPIED` (even with a null `occupiedRoute`, a race) and
 * `INELIGIBLE` are unavailable.
 */
export function isEligibleSaleSelectable(row: Pick<EligibleSaleRow, 'availability'>): boolean {
  return row.availability?.state === 'AVAILABLE'
}
