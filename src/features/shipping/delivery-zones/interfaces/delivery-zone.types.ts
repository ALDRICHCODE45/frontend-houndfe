/**
 * Delivery zones and the chatbot's pending zone validations (BE handoff
 * 10-shipping-settings-screens.md §2–§3). Money is integer cents on the wire;
 * the screens type and show pesos (S4).
 */
import type { PaginatedPage } from '@/core/shared/interfaces/paginated-page.types'

export type DeliveryZoneType = 'FREE' | 'SURCHARGE' | 'CARRIER_ONLY' | 'DENIED'

/** Zone types an approval can settle; rejecting saves the zone as DENIED. */
export type ApprovableZoneType = Exclude<DeliveryZoneType, 'DENIED'>

export interface PersonSnapshot {
  id: string
  displayName: string
}

export interface DeliveryZone {
  id: string
  zipCode: string
  type: DeliveryZoneType
  surchargeCents: number | null
  etaDays: number | null
  state: string | null
  municipality: string | null
  neighborhood: string | null
  isActive: boolean
  approvedBy: PersonSnapshot | null
  approvedAt: string | null
  sourceValidationId: string | null
  createdAt: string
  updatedAt: string
}

export type DeliveryZonePage = PaginatedPage<DeliveryZone>

/** `GET /delivery-zones` query; `page` is 1-based (the response `pageIndex` is 0-based). */
export interface DeliveryZoneListParams {
  page: number
  limit: number
  search?: string
  type?: DeliveryZoneType
  active?: boolean
}

/** `PUT /delivery-zones/:zipCode`: whole-record replace, the three labels always sent. */
export interface DeliveryZoneUpsertBody {
  type: DeliveryZoneType
  surchargeCents: number | null
  etaDays: number | null
  state: string | null
  municipality: string | null
  neighborhood: string | null
}

export type UrgencyLevel = 'OK' | 'WARNING' | 'CRITICAL' | 'EXPIRED'

export interface ValidationUrgency {
  deadlineAt: string
  hoursLeft: number
  level: UrgencyLevel
}

export interface ValidationResolution {
  action: 'APPROVE_DELIVERY_ZONE' | 'REJECT_DELIVERY_ZONE'
  zoneType: DeliveryZoneType | null
  surchargeCents: number | null
  etaDays: number | null
  resolvedAt: string
  resolvedBy: PersonSnapshot | null
}

export interface ZoneValidation {
  id: string
  zipCode: string
  state: string | null
  municipality: string | null
  neighborhood: string | null
  status: 'PENDING' | 'RESOLVED'
  version: number
  createdAt: string
  requesterCount: number
  lastCustomerMessageAt: string | null
  urgency: ValidationUrgency | null
  resolution: ValidationResolution | null
}

export type ZoneValidationPage = PaginatedPage<ZoneValidation>

export interface ZoneValidationListParams {
  page: number
  limit: number
  zipCode?: string
}

export type ResolveDecision =
  | {
      action: 'APPROVE_DELIVERY_ZONE'
      zoneType: ApprovableZoneType
      surchargeCents: number | null
      etaDays: number | null
    }
  | { action: 'REJECT_DELIVERY_ZONE' }

export type ResolveValidationBody = ResolveDecision & {
  expectedVersion: number
  resolutionRequestId: string
}

export interface ResolveValidationResponse {
  validation: ZoneValidation
  zone: DeliveryZone
}
