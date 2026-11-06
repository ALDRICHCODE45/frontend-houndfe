import { http } from '@/core/shared/api/http'
import type {
  DeliveryZone,
  DeliveryZoneListParams,
  DeliveryZonePage,
  DeliveryZoneUpsertBody,
  ResolveValidationBody,
  ResolveValidationResponse,
  ZoneValidation,
  ZoneValidationListParams,
  ZoneValidationPage,
} from '../interfaces/delivery-zone.types'

// Both routes work on the JWT tenant (no tenant in the path).
const ZONES = '/delivery-zones'
const VALIDATIONS = '/delivery-zone-validations'

/** Unset filters stay out of the query: the backend rejects unknown or empty values. */
function zoneListParams({ page, limit, search, type, active }: DeliveryZoneListParams) {
  const term = search?.trim()
  return {
    page,
    limit,
    ...(term ? { search: term } : {}),
    ...(type ? { type } : {}),
    ...(active !== undefined ? { active } : {}),
  }
}

export const deliveryZonesApi = {
  async list(params: DeliveryZoneListParams, signal?: AbortSignal): Promise<DeliveryZonePage> {
    const response = await http.get<DeliveryZonePage>(ZONES, { params: zoneListParams(params), signal })
    return response.data
  },
  async upsert(zipCode: string, body: DeliveryZoneUpsertBody): Promise<DeliveryZone> {
    const response = await http.put<DeliveryZone>(`${ZONES}/${encodeURIComponent(zipCode)}`, body)
    return response.data
  },
  async deactivate(zipCode: string): Promise<DeliveryZone> {
    const response = await http.delete<DeliveryZone>(`${ZONES}/${encodeURIComponent(zipCode)}`)
    return response.data
  },
}

export const zoneValidationsApi = {
  async list(params: ZoneValidationListParams, signal?: AbortSignal): Promise<ZoneValidationPage> {
    const { page, limit, zipCode } = params
    const response = await http.get<ZoneValidationPage>(VALIDATIONS, {
      params: { page, limit, ...(zipCode ? { zipCode } : {}) },
      signal,
    })
    return response.data
  },
  async get(id: string, signal?: AbortSignal): Promise<ZoneValidation> {
    const response = await http.get<ZoneValidation>(`${VALIDATIONS}/${encodeURIComponent(id)}`, { signal })
    return response.data
  },
  // The request id travels in the body; the backend has no Idempotency-Key header here.
  async resolve(id: string, body: ResolveValidationBody): Promise<ResolveValidationResponse> {
    const response = await http.post<ResolveValidationResponse>(
      `${VALIDATIONS}/${encodeURIComponent(id)}/resolve`,
      body,
    )
    return response.data
  },
}
