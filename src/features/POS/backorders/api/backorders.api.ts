/**
 * Backorder transport on the shared axios `http` (ODD restock-backorder S3, S5). Query params and
 * the cancel body are picked by an explicit allow-list: nothing that is not named here reaches the
 * wire, blank values are dropped and `status` travels as a comma list.
 */
import { http } from '@/core/shared/api/http'
import type {
  BackorderListParams,
  BackorderListResponse,
  BackorderStaff,
  CancelBackorderBody,
} from '../interfaces/backorder.types'

export interface BackorderReadOptions {
  /** The executing TanStack query signal — the only read knob forwarded. */
  signal?: AbortSignal
}

const BASE = '/backorders'

const LIST_PARAMS = [
  'page',
  'limit',
  'status',
  'productId',
  'variantId',
  'customerId',
  'q',
  'from',
  'to',
  'sortBy',
  'sortOrder',
] as const

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (Array.isArray(value)) return value.length === 0
  return typeof value === 'string' && value.trim() === ''
}

function listQuery(params: BackorderListParams): Record<string, unknown> {
  const source = params as Record<string, unknown>
  const query: Record<string, unknown> = {}
  for (const key of LIST_PARAMS) {
    const value = source[key]
    if (isBlank(value)) continue
    query[key] = Array.isArray(value) ? value.join(',') : value
  }
  return query
}

const path = (id: string, suffix = '') => `${BASE}/${encodeURIComponent(id)}${suffix}`

export const backordersApi = {
  async list(params: BackorderListParams = {}, options: BackorderReadOptions = {}): Promise<BackorderListResponse> {
    const { data } = await http.get<BackorderListResponse>(BASE, {
      params: listQuery(params),
      signal: options.signal,
    })
    return data
  },

  async get(id: string, options: BackorderReadOptions = {}): Promise<BackorderStaff> {
    const { data } = await http.get<BackorderStaff>(path(id), { signal: options.signal })
    return data
  },

  /** `reason` is optional (≤ 280, enforced by the form); a blank one is not sent. */
  async cancel(id: string, body: CancelBackorderBody): Promise<BackorderStaff> {
    const payload: CancelBackorderBody = { version: body.version }
    const reason = body.reason?.trim()
    if (reason) payload.reason = reason
    const { data } = await http.post<BackorderStaff>(path(id, '/cancel'), payload)
    return data
  },
}
