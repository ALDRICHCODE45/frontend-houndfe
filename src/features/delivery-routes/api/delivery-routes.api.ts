import { http } from '@/core/shared/api/http'
import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import type {
  AppendDeliveryRouteStopRequest,
  CreateDeliveryRouteRequest,
  DeliveryRouteResponseDto,
  DeliveryRouteStatus,
  ReorderDeliveryRouteStopsRequest,
  UpdateDeliveryRouteRequest,
} from '../interfaces/delivery-route.types'

/**
 * delivery-routes.api.ts — Tiny HTTP surface mirroring the backend contract.
 *
 * Locked contract (sdd delivery-routes, design.md §3/§6.3):
 *   - 10 endpoints, one axios method each. Backend list is a flat array
 *     (no `{ data, meta }` envelope), ordered by backend choice; pagination is
 *     fully client-side via `paginateDeliveryRoutes` (mirrors `paginatePaymentDetails`).
 *   - Request bodies are zod-strict whitelists (`forbidNonWhitelisted`) so
 *     forbidden keys (id/tenantId/timeline/activeRouteId/startedAt/...) can
 *     NEVER cross the wire — even from a buggy caller. The API surface still
 *     does a defensive `filterAllowedKeys` strip as a belt-and-suspenders
 *     measure.
 *
 *   URL contract (backend `delivery-routes-frontend.md`):
 *     GET    /delivery-routes                       list
 *     GET    /delivery-routes/:id                   getById
 *     POST   /delivery-routes                       create
 *     PATCH  /delivery-routes/:id                   update
 *     DELETE /delivery-routes/:id                   delete (204)
 *     POST   /delivery-routes/:id/start             start
 *     POST   /delivery-routes/:id/cancel            cancel
 *     POST   /delivery-routes/:id/stops             appendStop (201)
 *     PUT    /delivery-routes/:id/stops/reorder     reorderStops
 *     POST   /delivery-routes/:id/stops/:stopId/check-in  checkInStop
 */

// ─── Whitelist per endpoint (defensive — the zod schemas already enforce this) ──
const CREATE_ALLOWED_KEYS: readonly string[] = ['saleIds', 'driverUserId', 'notes']
const UPDATE_ALLOWED_KEYS: readonly string[] = ['driverUserId', 'notes']
const APPEND_ALLOWED_KEYS: readonly string[] = ['saleId']
const REORDER_ALLOWED_KEYS: readonly string[] = ['orderedStopIds']

function filterAllowedKeys<T extends object>(
  payload: T,
  allowed: readonly string[],
): Partial<T> {
  const out: Partial<T> = {}
  for (const key of allowed) {
    const v = (payload as Record<string, unknown>)[key]
    if (v !== undefined) {
      ;(out as Record<string, unknown>)[key] = v
    }
  }
  return out
}

/**
 * paginateDeliveryRoutes — Pure client-side paginator.
 *
 * Wraps the flat `list()` array into the standard `PaginatedResponse` envelope so
 * `useDeliveryRoutesTable` (S4a) can return a uniform shape to `useServerTable`,
 * mirroring `paginatePaymentDetails`.
 */
export function paginateDeliveryRoutes(
  rows: DeliveryRouteResponseDto[],
  params: ServerTableParams,
): PaginatedResponse<DeliveryRouteResponseDto> {
  const totalCount = rows.length
  const pageCount = Math.ceil(totalCount / params.pageSize) || 1
  const start = params.pageIndex * params.pageSize
  const pagedRows = rows.slice(start, start + params.pageSize)

  return {
    data: pagedRows,
    pagination: {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      totalCount,
      pageCount,
    },
  }
}

export const deliveryRoutesApi = {
  /** Full flat list. Optional `status` filter (e.g. 'ACTIVE' for the driver branch). */
  async list(status?: DeliveryRouteStatus): Promise<DeliveryRouteResponseDto[]> {
    const { data } = await http.get<DeliveryRouteResponseDto[]>('/delivery-routes', {
      params: status ? { status } : undefined,
    })
    return data
  },

  async getById(id: string): Promise<DeliveryRouteResponseDto> {
    const { data } = await http.get<DeliveryRouteResponseDto>(`/delivery-routes/${id}`)
    return data
  },

  async create(payload: CreateDeliveryRouteRequest): Promise<DeliveryRouteResponseDto> {
    const safePayload = filterAllowedKeys(payload, CREATE_ALLOWED_KEYS)
    const { data } = await http.post<DeliveryRouteResponseDto>('/delivery-routes', safePayload)
    return data
  },

  async update(
    id: string,
    payload: UpdateDeliveryRouteRequest,
  ): Promise<DeliveryRouteResponseDto> {
    const safePayload = filterAllowedKeys(payload, UPDATE_ALLOWED_KEYS)
    const { data } = await http.patch<DeliveryRouteResponseDto>(
      `/delivery-routes/${id}`,
      safePayload,
    )
    return data
  },

  /** Hard DELETE; backend returns 204. */
  async delete(id: string): Promise<void> {
    await http.delete(`/delivery-routes/${id}`)
  },

  async start(id: string): Promise<DeliveryRouteResponseDto> {
    const { data } = await http.post<DeliveryRouteResponseDto>(`/delivery-routes/${id}/start`)
    return data
  },

  async cancel(id: string): Promise<DeliveryRouteResponseDto> {
    const { data } = await http.post<DeliveryRouteResponseDto>(`/delivery-routes/${id}/cancel`)
    return data
  },

  async appendStop(
    id: string,
    payload: AppendDeliveryRouteStopRequest,
  ): Promise<DeliveryRouteResponseDto> {
    const safePayload = filterAllowedKeys(payload, APPEND_ALLOWED_KEYS)
    const { data } = await http.post<DeliveryRouteResponseDto>(
      `/delivery-routes/${id}/stops`,
      safePayload,
    )
    return data
  },

  async reorderStops(
    id: string,
    payload: ReorderDeliveryRouteStopsRequest,
  ): Promise<DeliveryRouteResponseDto> {
    const safePayload = filterAllowedKeys(payload, REORDER_ALLOWED_KEYS)
    const { data } = await http.put<DeliveryRouteResponseDto>(
      `/delivery-routes/${id}/stops/reorder`,
      safePayload,
    )
    return data
  },

  async checkInStop(id: string, stopId: string): Promise<DeliveryRouteResponseDto> {
    const { data } = await http.post<DeliveryRouteResponseDto>(
      `/delivery-routes/${id}/stops/${stopId}/check-in`,
    )
    return data
  },
}