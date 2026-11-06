// shippingSettings.api.ts — /tenants/:tenantId/{shipping-boxes, shipping-origin,
// opening-hours} (shipping handoff §5–§7). Bodies go out as built by the form
// utils (cm and grams); responses are returned as the backend sends them.

import { http } from '@/core/shared/api/http'
import type {
  OpeningHoursBody,
  OpeningHoursResponse,
  ShippingBox,
  ShippingBoxBody,
  ShippingBoxPatch,
  ShippingOriginBody,
  ShippingOriginResponse,
} from '../interfaces/shipping-settings.types'

const base = (tenantId: string) => `/tenants/${tenantId}`

/** Active boxes first, then by name; not paginated. */
async function listBoxes(tenantId: string): Promise<ShippingBox[]> {
  const { data } = await http.get<{ data: ShippingBox[] }>(`${base(tenantId)}/shipping-boxes`)
  return data.data
}

async function createBox(tenantId: string, body: ShippingBoxBody): Promise<ShippingBox> {
  const { data } = await http.post<ShippingBox>(`${base(tenantId)}/shipping-boxes`, body)
  return data
}

async function updateBox(tenantId: string, boxId: string, patch: ShippingBoxPatch): Promise<ShippingBox> {
  const { data } = await http.patch<ShippingBox>(`${base(tenantId)}/shipping-boxes/${boxId}`, patch)
  return data
}

/** Hard delete (204). Retiring a box is `updateBox(…, { isActive: false })`. */
async function deleteBox(tenantId: string, boxId: string): Promise<void> {
  await http.delete(`${base(tenantId)}/shipping-boxes/${boxId}`)
}

async function getOrigin(tenantId: string): Promise<ShippingOriginResponse> {
  const { data } = await http.get<ShippingOriginResponse>(`${base(tenantId)}/shipping-origin`)
  return data
}

async function putOrigin(tenantId: string, body: ShippingOriginBody): Promise<ShippingOriginResponse> {
  const { data } = await http.put<ShippingOriginResponse>(`${base(tenantId)}/shipping-origin`, body)
  return data
}

async function getOpeningHours(tenantId: string): Promise<OpeningHoursResponse> {
  const { data } = await http.get<OpeningHoursResponse>(`${base(tenantId)}/opening-hours`)
  return data
}

async function putOpeningHours(tenantId: string, body: OpeningHoursBody): Promise<OpeningHoursResponse> {
  const { data } = await http.put<OpeningHoursResponse>(`${base(tenantId)}/opening-hours`, body)
  return data
}

export const shippingSettingsApi = {
  listBoxes,
  createBox,
  updateBox,
  deleteBox,
  getOrigin,
  putOrigin,
  getOpeningHours,
  putOpeningHours,
}
