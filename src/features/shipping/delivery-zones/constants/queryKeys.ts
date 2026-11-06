import type { DeliveryZoneListParams, ZoneValidationListParams } from '../interfaces/delivery-zone.types'

/** Tenant-scoped keys: a branch switch never reuses another branch's zones. */
export const deliveryZoneKeys = {
  all: (tenantId: string) => ['delivery-zones', tenantId] as const,
  list: (tenantId: string, params: DeliveryZoneListParams) => ['delivery-zones', tenantId, 'list', params] as const,
}

/** The nav badge lives under `all`, so a resolve refreshes it with the queue. */
export const zoneValidationKeys = {
  all: (tenantId: string) => ['delivery-zone-validations', tenantId] as const,
  list: (tenantId: string, params: ZoneValidationListParams) =>
    ['delivery-zone-validations', tenantId, 'list', params] as const,
  detail: (tenantId: string, id: string) => ['delivery-zone-validations', tenantId, 'detail', id] as const,
}
