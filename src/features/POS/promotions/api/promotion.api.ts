import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  CreatePromotionPayload,
  PromotionResponse,
  UpdatePromotionPayload,
} from '../interfaces/promotion.types'

// ── Pagination meta ────────────────────────────────────────────────────────────

interface PromotionPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface PromotionBackendListResponse {
  data: PromotionResponse[]
  meta: PromotionPaginationMeta
}

// ── Query params ───────────────────────────────────────────────────────────────

export interface PromotionFilters {
  type?: string
  status?: string
  method?: string
  customerScope?: string
  search?: string
}

export type PromotionTableParams = ServerTableParams & PromotionFilters

// ── Helpers ────────────────────────────────────────────────────────────────────

function mapPagination(
  meta: PromotionPaginationMeta,
): PaginatedResponse<PromotionResponse>['pagination'] {
  return {
    pageIndex: meta.page - 1,
    pageSize: meta.limit,
    totalCount: meta.total,
    pageCount: meta.totalPages,
  }
}

function resolveSort(params: ServerTableParams) {
  const firstSort = params.sorting?.[0]
  if (!firstSort) return undefined

  return {
    sortBy: firstSort.id,
    sortOrder: firstSort.desc ? 'desc' : 'asc',
  }
}

// ── API object ────────────────────────────────────────────────────────────────

export const promotionApi = {
  async getPaginated(
    params: PromotionTableParams,
  ): Promise<PaginatedResponse<PromotionResponse>> {
    const page = params.pageIndex + 1
    const limit = params.pageSize
    const sort = resolveSort(params)

    const { data } = await http.get<PromotionBackendListResponse>('/promotions', {
      params: {
        page,
        limit,
        ...(params.globalFilter ? { search: params.globalFilter } : {}),
        ...(params.type ? { type: params.type } : {}),
        ...(params.status ? { status: params.status } : {}),
        ...(params.method ? { method: params.method } : {}),
        ...(params.customerScope ? { customerScope: params.customerScope } : {}),
        ...sort,
      },
    })

    return {
      data: data.data,
      pagination: mapPagination(data.meta),
    }
  },

  async getById(promotionId: string): Promise<PromotionResponse> {
    const { data } = await http.get<PromotionResponse>(`/promotions/${promotionId}`)
    return data
  },

  async create(payload: CreatePromotionPayload): Promise<PromotionResponse> {
    const { data } = await http.post<PromotionResponse>('/promotions', payload)
    return data
  },

  async update(promotionId: string, payload: UpdatePromotionPayload): Promise<PromotionResponse> {
    const { data } = await http.patch<PromotionResponse>(`/promotions/${promotionId}`, payload)
    return data
  },

  async end(promotionId: string): Promise<PromotionResponse> {
    const { data } = await http.patch<PromotionResponse>(`/promotions/${promotionId}/end`)
    return data
  },

  async activate(promotionId: string): Promise<PromotionResponse> {
    const { data } = await http.patch<PromotionResponse>(`/promotions/${promotionId}/activate`)
    return data
  },

  async remove(promotionId: string): Promise<void> {
    await http.delete(`/promotions/${promotionId}`)
  },

  /**
   * Bulk-delete promotions. The backend is all-or-nothing atomic.
   *
   * Client-side pre-flight guards (kept in lockstep with the server):
   *  - rejects empty arrays (UI never lets the bulk button fire with 0 rows)
   *  - rejects >100 ids (matches the server cap; the UI also disables the
   *    button before the user can click into an invalid state)
   *  - deduplicates ids before posting (server would 400 on dupes anyway)
   */
  async batchDelete(ids: string[]): Promise<{ deleted: number }> {
    const uniqueIds = Array.from(new Set(ids))
    if (uniqueIds.length === 0) {
      throw new Error('batchDelete requires at least one id')
    }
    if (uniqueIds.length > 100) {
      throw new Error('batchDelete is capped at 100 ids per request')
    }

    const { data } = await http.post<{ deleted: number }>('/promotions/batch-delete', {
      ids: uniqueIds,
    })
    return data
  },

  /**
   * Bulk-end promotions. The backend is all-or-nothing atomic.
   * Client-side guards mirror the batch-delete contract and server cap.
   */
  async batchEnd(ids: string[]): Promise<{ ended: number }> {
    const uniqueIds = Array.from(new Set(ids))
    if (uniqueIds.length === 0) {
      throw new Error('batchEnd requires at least one id')
    }
    if (uniqueIds.length > 100) {
      throw new Error('batchEnd is capped at 100 ids per request')
    }

    const { data } = await http.post<{ ended: number }>('/promotions/batch-end', {
      ids: uniqueIds,
    })
    return data
  },

  /**
   * Bulk-activate promotions. The backend is all-or-nothing atomic; backend
   * treats reactivating a non-ENDED promo as a no-op (idempotent).
   *
   * Client-side guards mirror the batch-end contract and server cap.
   */
  async batchActivate(ids: string[]): Promise<{ activated: number }> {
    const uniqueIds = Array.from(new Set(ids))
    if (uniqueIds.length === 0) {
      throw new Error('batchActivate requires at least one id')
    }
    if (uniqueIds.length > 100) {
      throw new Error('batchActivate is capped at 100 ids per request')
    }

    const { data } = await http.post<{ activated: number }>('/promotions/batch-activate', {
      ids: uniqueIds,
    })
    return data
  },
}
