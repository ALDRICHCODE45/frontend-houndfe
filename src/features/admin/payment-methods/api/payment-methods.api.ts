import type { PaginatedResponse, ServerTableParams } from '@/core/shared/types/table.types'
import { http } from '@/core/shared/api/http'
import {
  normalizeSubtitle,
  type PaymentMethodResponse,
  type PaymentMethodTableRow,
  type CreatePaymentMethodRequest,
  type UpdatePaymentMethodRequest,
} from '../interfaces/payment-method.types'

/**
 * payment-methods.api.ts — Locked contracts (sdd custom-payment-methods S2A, design.md §5)
 *
 *   - Backend list is a flat array (no `{ data, meta }` envelope) ordered
 *     `updatedAt DESC`. Pagination is fully client-side.
 *   - The flat array is wrapped into a `PaginatedResponse` AFTER applying
 *     `globalFilter` (search across `name` ONLY — exploration §9.9) AND local
 *     sort on the explicit user-chosen column. Backend default ordering is
 *     preserved when the user does not sort.
 *   - No `isActive` filter param (backend always returns active + inactive).
 *   - URL contract: `/admin/payment-methods` (list, create) and
 *     `/admin/payment-methods/:id` (getById, update, remove).
 *   - Pure helpers (`applyLocalPaymentMethodFilters`, `paginatePaymentMethods`)
 *     are exported so the usePaymentMethodsTable wrapper and the unit tests
 *     can hit them directly without going through the HTTP mock.
 *
 * **`isActive` REVERSAL (locked, REQ-PM-003).** Unlike PaymentDetail, the
 * update() payload FORWARDS `isActive` (reactivate path) but NEVER forwards
 * `tenantId`, `id`, `createdAt`, `updatedAt`, or `metadataJson`
 * (forbidNonWhitelisted → 400). The whitelist below enforces this at the
 * HTTP boundary.
 */

const SEARCH_FIELDS = ['name'] as const
type SearchableField = (typeof SEARCH_FIELDS)[number]

// Update whitelist: `isActive` IS allowed (REQ-PM-003 reversal). Everything
// else (id / tenantId / createdAt / updatedAt / metadataJson) is stripped so
// a buggy caller can't smuggle it through the wrapper.
const ALLOWED_UPDATE_KEYS = ['name', 'category', 'subtitle', 'isActive'] as const
type AllowedUpdateKey = (typeof ALLOWED_UPDATE_KEYS)[number]

// Create whitelist: NO `isActive` (REQ-PM-002 — create omits isActive).
const ALLOWED_CREATE_KEYS = ['name', 'category', 'subtitle'] as const
type AllowedCreateKey = (typeof ALLOWED_CREATE_KEYS)[number]

function filterAllowedKeys<T extends object>(
  payload: T,
  allowed: readonly string[],
): Partial<T> {
  const out: Partial<T> = {}
  for (const key of allowed) {
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
 * the raw list. Pure; non-mutating. Search is `name`-only per exploration
 * §9.9 (subtitle is intentionally NOT searchable so the user cannot
 * discover methods via a string the backend never indexes).
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

export function applyLocalPaymentMethodFilters(
  rows: PaymentMethodResponse[],
  params: ServerTableParams,
): PaymentMethodResponse[] {
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
 * single-source `usePaymentMethodsTable` wrapper can return a uniform shape to
 * `useServerTable`. Pure.
 */
export function paginatePaymentMethods(
  rows: PaymentMethodResponse[],
  params: ServerTableParams,
): PaginatedResponse<PaymentMethodTableRow> {
  const filteredRows = applyLocalPaymentMethodFilters(rows, params)
  const totalCount = filteredRows.length
  const pageCount = Math.ceil(totalCount / params.pageSize) || 1
  const start = params.pageIndex * params.pageSize
  const pagedRows = filteredRows.slice(start, start + params.pageSize)

  return {
    data: pagedRows as PaymentMethodTableRow[],
    pagination: {
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      totalCount,
      pageCount,
    },
  }
}

/**
 * paymentMethodsApi — Tiny HTTP surface mirroring the backend contract.
 *
 *   POST   /admin/payment-methods        create
 *   GET    /admin/payment-methods        list (flat array)
 *   GET    /admin/payment-methods/:id    getById
 *   PATCH  /admin/payment-methods/:id    update (partial)
 *   DELETE /admin/payment-methods/:id    remove (logical isActive=false)
 *
 * `tenantId` is NEVER forwarded (REQ-PM-002 + REO-PD-NOTE-001). `isActive`
 * is forwarded on update (REQ-PM-003 REVERSAL pin) but NEVER on create
 * (REQ-PM-002 — the backend creates every row as active).
 */
export const paymentMethodsApi = {
  /** Full flat list. Backend-ordered `updatedAt DESC`. Drives the single-source wrapper. */
  async list(): Promise<PaymentMethodResponse[]> {
    const { data } = await http.get<PaymentMethodResponse[]>('/admin/payment-methods')
    return data
  },

  async getById(id: string): Promise<PaymentMethodResponse> {
    const { data } = await http.get<PaymentMethodResponse>(`/admin/payment-methods/${id}`)
    return data
  },

  /**
   * create() — POST /admin/payment-methods.
   * Whitelist: `name`, `category`, `subtitle` ONLY. `isActive`, `id`,
   * `tenantId`, `createdAt`, `updatedAt`, `metadataJson` are stripped at the
   * boundary (REQ-PM-002 + REQ-PM-008 — backend forbids them via
   * forbidNonWhitelisted → 400).
   */
  async create(payload: CreatePaymentMethodRequest): Promise<PaymentMethodResponse> {
    const safePayload = filterAllowedKeys(payload, ALLOWED_CREATE_KEYS)
    // REQ-PM-009: trim+omit whitespace-only subtitle so the wire never sends
    // `subtitle: ''` (the backend would still default to null but the omission
    // is the explicit contract).
    if ('subtitle' in safePayload) {
      const normalized = normalizeSubtitle(safePayload.subtitle as string | undefined)
      if (normalized === undefined) {
        delete (safePayload as Record<string, unknown>).subtitle
      } else {
        ;(safePayload as Record<string, unknown>).subtitle = normalized
      }
    }
    const { data } = await http.post<PaymentMethodResponse>(
      '/admin/payment-methods',
      safePayload,
    )
    return data
  },

  /**
   * update() — PATCH /admin/payment-methods/:id.
   *
   * **REQ-PM-003 REVERSAL pin**: unlike PaymentDetail, `isActive` IS allowed
   * on update so the slideover's reactivate toggle works. The whitelist
   * keeps `tenantId`, `id`, `createdAt`, `updatedAt`, `metadataJson` OUT of
   * the wire (forbidNonWhitelisted → 400 otherwise).
   */
  async update(id: string, payload: UpdatePaymentMethodRequest): Promise<PaymentMethodResponse> {
    const safePayload = filterAllowedKeys(payload, ALLOWED_UPDATE_KEYS as readonly string[])
    // REQ-PM-009: trim+omit whitespace-only subtitle (parity with create()).
    if ('subtitle' in safePayload) {
      const normalized = normalizeSubtitle(safePayload.subtitle as string | undefined)
      if (normalized === undefined) {
        delete (safePayload as Record<string, unknown>).subtitle
      } else {
        ;(safePayload as Record<string, unknown>).subtitle = normalized
      }
    }
    const { data } = await http.patch<PaymentMethodResponse>(
      `/admin/payment-methods/${id}`,
      safePayload,
    )
    return data
  },

  /** Logical DELETE: backend sets `isActive=false` and returns 204. Idempotent. */
  async remove(id: string): Promise<void> {
    await http.delete(`/admin/payment-methods/${id}`)
  },
}

// Re-export the allowed-key tuple type aliases for tests / callers that want
// to assert on the wire shape without reaching into private tuples.
export type { AllowedCreateKey, AllowedUpdateKey }