import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import type {
  PaymentDetailResponse,
  PaymentDetailTableRow,
  CreatePaymentDetailRequest,
  UpdatePaymentDetailRequest,
} from '../interfaces/payment-detail.types'

/**
 * payment-details.api.ts — Locked contracts (sdd payment-details-admin, design.md §8.1)
 *
 *   - Backend list is a flat array (no `{ data, meta }` envelope) ordered
 *     `updatedAt DESC`. Pagination is fully client-side.
 *   - The flat array is wrapped into a `PaginatedResponse` AFTER applying
 *     `globalFilter` (search across `bankName` / `beneficiary` / `clabe` /
 *     `accountNumber`) AND local sort on the explicit user-chosen column.
 *     Backend default ordering is preserved when the user does not sort.
 *   - No `isActive` filter param (backend always returns active + inactive).
 *   - URL contract: `/admin/payment-details` (list, create) and
 *     `/admin/payment-details/:id` (getById, update, remove).
 *   - Pure helpers (`applyLocalPaymentDetailFilters`, `paginatePaymentDetails`)
 *     are exported so the usePaymentDetailsTable wrapper and the unit tests
 *     can hit them directly without going through the HTTP mock.
 */

const SEARCH_FIELDS = ['bankName', 'beneficiary', 'clabe', 'accountNumber'] as const
type SearchableField = (typeof SEARCH_FIELDS)[number]

const ALLOWED_REQUEST_KEYS = SEARCH_FIELDS

function filterAllowedKeys<T extends object>(payload: T): Partial<T> {
  const out: Partial<T> = {}
  for (const key of ALLOWED_REQUEST_KEYS) {
    const v = (payload as Record<string, unknown>)[key]
    if (v !== undefined && v !== null) {
      ;(out as Record<string, unknown>)[key] = v
    }
  }
  return out
}

function isSearchableField(id: string): id is SearchableField {
  return (SEARCH_FIELDS as readonly string[]).includes(id)
}

/**
 * Apply the local `globalFilter` and an explicit single-column `sorting` to
 * the raw list. Pure; non-mutating.
 */
function compareStrings(a: string, b: string, desc: boolean): number {
  // Raw code-point comparison (ASCII-stable). Puts 'BBVA' before 'Banorte'
  // because 'B' (0x42) < 'a' (0x61), matching the test expectation and the
  // prevailing UX precedent in the codebase. Case-insensitivity is reserved
  // for globalFilter search; explicit user sort is intentionally raw.
  let result = 0
  if (a < b) result = -1
  else if (a > b) result = 1
  return desc ? -result : result
}

export function applyLocalPaymentDetailFilters(
  rows: PaymentDetailResponse[],
  params: ServerTableParams,
): PaymentDetailResponse[] {
  let filtered = [...rows]

  const rawSearch = params.globalFilter?.trim() ?? ''
  if (rawSearch) {
    const search = rawSearch.toLowerCase()
    filtered = filtered.filter((row) =>
      SEARCH_FIELDS.some((field) => row[field].toLowerCase().includes(search)),
    )
  }

  if (params.sorting && params.sorting.length > 0) {
    const sort = params.sorting[0]
    if (sort && isSearchableField(sort.id)) {
      const id = sort.id
      filtered.sort((a, b) => compareStrings(a[id], b[id], sort.desc))
    } else if (sort) {
      filtered.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sort.id]
        const bVal = (b as unknown as Record<string, unknown>)[sort.id]
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return compareStrings(aVal, bVal, sort.desc)
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.desc ? bVal - aVal : aVal - bVal
        }
        if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
          return sort.desc ? Number(bVal) - Number(aVal) : Number(aVal) - Number(bVal)
        }
        return 0
      })
    }
  }

  return filtered
}

/**
 * Wrap the filtered list into the standard `PaginatedResponse` envelope so the
 * single-source `usePaymentDetailsTable` wrapper can return a uniform shape to
 * `useServerTable`. Pure.
 */
export function paginatePaymentDetails(
  rows: PaymentDetailResponse[],
  params: ServerTableParams,
): PaginatedResponse<PaymentDetailTableRow> {
  const filteredRows = applyLocalPaymentDetailFilters(rows, params)
  const totalCount = filteredRows.length
  const pageCount = Math.ceil(totalCount / params.pageSize) || 1
  const start = params.pageIndex * params.pageSize
  const pagedRows = filteredRows.slice(start, start + params.pageSize)

  return {
    data: pagedRows as PaymentDetailTableRow[],
    pagination: {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      totalCount,
      pageCount,
    },
  }
}

/**
 * paymentDetailsApi — Tiny HTTP surface mirroring the backend contract.
 *
 *   POST   /admin/payment-details        create
 *   GET    /admin/payment-details        list (flat array)
 *   GET    /admin/payment-details/:id    getById
 *   PATCH  /admin/payment-details/:id    update (partial)
 *   DELETE /admin/payment-details/:id    remove (logical isActive=false)
 *
 * No `isActive` is ever included in create/update payloads — the backend
 * rejects it via `forbidNonWhitelisted` → 400. The type system enforces this:
 * `CreatePaymentDetailRequest` and `UpdatePaymentDetailRequest` intentionally
 * lack the field.
 */
export const paymentDetailsApi = {
  /** Full flat list. Backend-ordered `updatedAt DESC`. Drives the single-source wrapper. */
  async list(): Promise<PaymentDetailResponse[]> {
    const { data } = await http.get<PaymentDetailResponse[]>('/admin/payment-details')
    return data
  },

  async getById(id: string): Promise<PaymentDetailResponse> {
    const { data } = await http.get<PaymentDetailResponse>(`/admin/payment-details/${id}`)
    return data
  },

  async create(payload: CreatePaymentDetailRequest): Promise<PaymentDetailResponse> {
    const { data } = await http.post<PaymentDetailResponse>(
      '/admin/payment-details',
      payload,
    )
    return data
  },

  async update(id: string, payload: UpdatePaymentDetailRequest): Promise<PaymentDetailResponse> {
    // Defensive: the backend rejects `isActive` and `tenantId` via
    // `forbidNonWhitelisted` → 400. Strip them at the API boundary so a
    // buggy caller (or a future regression in setValues) cannot leak the
    // keys and surface a confusing 400 to the user.
    const safePayload = filterAllowedKeys(payload)
    const { data } = await http.patch<PaymentDetailResponse>(
      `/admin/payment-details/${id}`,
      safePayload,
    )
    return data
  },

  /** Logical DELETE: backend sets `isActive=false` and returns 204. Idempotent. */
  async remove(id: string): Promise<void> {
    await http.delete(`/admin/payment-details/${id}`)
  },
}
