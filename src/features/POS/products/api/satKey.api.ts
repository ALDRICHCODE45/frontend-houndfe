/**
 * satKey.api — HTTP client for the SAT c_ClaveProdServ catalog.
 *
 * Endpoints:
 *  - GET /sat-keys?search=&limit=&offset=  → typeahead search
 *  - GET /sat-keys/:key                    → single-key lookup (404 on miss)
 *
 * The response shape on the search endpoint is documented as
 * `{ items, limit, offset, total }` (see sat-catalog.service.ts in the
 * backend). A tolerant adapter `toSatKeySearchResponse` also handles
 * the `{ data, meta.total }` shape used by other list endpoints in
 * this repo (product.api.ts), so the client won't silently break if
 * the backend is ever refactored to match the repo convention.
 *
 * Tenant is carried in the JWT — never sent as a query param
 * (see useManagerPicker rules).
 */
import type { AxiosError } from 'axios'
import { http } from '@/core/shared/api/http'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * One row of the SAT c_ClaveProdServ catalog.
 * The backend currently returns the raw entity (including `searchText`,
 * known leak per obs #2618). The frontend ignores `searchText` and
 * only consumes the 6 fields it actually needs.
 */
export interface SatKey {
  key: string
  description: string
  includeIva: 'REQUIRED' | 'NONE' | 'OPTIONAL'
  includeIeps: 'REQUIRED' | 'NONE' | 'OPTIONAL'
  validFrom: string | null
  validTo: string | null
  /** Internal — present in the current backend response, unused in UI. */
  searchText?: string
}

/** Canonical shape consumed by the UI (post-adapter). */
export interface SatKeySearchResponse {
  items: SatKey[]
  limit: number
  offset: number
  total: number
}

export interface SatKeySearchOpts {
  limit?: number
  offset?: number
  signal?: AbortSignal
}

// ─── Tolerant response adapter ───────────────────────────────────────────────

/**
 * Normalize the search response to `{ items, limit, offset, total }`.
 *
 * Handles BOTH the documented backend shape (`{ items, total, ... }`)
 * and the repo-precedent shape (`{ data, meta: { total } }`) used by
 * product.api.ts. If neither shape matches, falls back to a safe
 * empty result so a malformed payload can never crash the dropdown.
 */
export function toSatKeySearchResponse(raw: unknown): SatKeySearchResponse {
  if (!raw || typeof raw !== 'object') {
    return { items: [], limit: 0, offset: 0, total: 0 }
  }

  const record = raw as Record<string, unknown>

  // Shape A: { items, limit, offset, total } (the sat-catalog contract)
  if (Array.isArray(record.items)) {
    return {
      items: record.items as SatKey[],
      limit: typeof record.limit === 'number' ? record.limit : 0,
      offset: typeof record.offset === 'number' ? record.offset : 0,
      total: typeof record.total === 'number' ? record.total : 0,
    }
  }

  // Shape B: { data, meta: { total, ... } } (the repo list convention)
  if (Array.isArray(record.data)) {
    const meta = (record.meta as Record<string, unknown> | undefined) ?? {}
    return {
      items: record.data as SatKey[],
      limit: typeof meta.limit === 'number' ? meta.limit : 0,
      offset: typeof meta.offset === 'number' ? meta.offset : 0,
      total: typeof meta.total === 'number' ? meta.total : 0,
    }
  }

  return { items: [], limit: 0, offset: 0, total: 0 }
}

// ─── HTTP entry points ───────────────────────────────────────────────────────

/**
 * GET /sat-keys — typeahead search.
 * `search` is trimmed and (per spec) the request is gated on
 * `term.length >= MIN_SEARCH_CHARS` by the composable, not here.
 */
export async function searchSatKeys(
  search: string,
  opts: SatKeySearchOpts = {},
): Promise<SatKeySearchResponse> {
  const { limit = 20, offset = 0, signal } = opts
  const trimmed = search.trim()
  const { data } = await http.get<unknown>('/sat-keys', {
    params: { search: trimmed, limit, offset },
    signal,
  })
  return toSatKeySearchResponse(data)
}

/**
 * GET /sat-keys/:key — single-key lookup.
 * 404 → returns `null` (legacy/retired key path). All other errors
 * are rethrown so the caller can decide.
 */
export async function getSatKey(
  key: string,
  opts: { signal?: AbortSignal } = {},
): Promise<SatKey | null> {
  try {
    const { data } = await http.get<SatKey>(`/sat-keys/${key}`, { signal: opts.signal })
    return data
  } catch (e) {
    if ((e as AxiosError).response?.status === 404) return null
    throw e
  }
}
