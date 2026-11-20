/**
 * «Pedidos por reposición» list state ⇄ URL ⇄ API params (ODD restock-backorder S1, S3).
 *
 * The URL query is the single source of truth (like the chatbot inbox): status tab, search, local days,
 * sort and paging are read from it (`parseListQuery`) and written back without defaults
 * (`listQueryOf`). Only the params named in `listParamsOf` reach the API.
 */
import { closingDateRange } from '@/features/POS/cash-register/closing/closingView'
import type {
  BackorderListParams,
  BackorderSortBy,
  BackorderSortOrder,
  BackorderStatus,
} from '../interfaces/backorder.types'
import { BACKORDER_TABS } from './backorderView'

export interface BackorderListState {
  tab: BackorderStatus
  /** Customer name/phone or product/variant name; at most {@link SEARCH_MAX_LENGTH}. */
  q: string
  /** Local calendar days `YYYY-MM-DD` (never a JS Date, so no zone drift); `''` = open. */
  from: string
  to: string
  sortBy: BackorderSortBy
  sortOrder: BackorderSortOrder
  /** 1-based. */
  page: number
  limit: number
}

export const SEARCH_MAX_LENGTH = 100
export const DEFAULT_TAB: BackorderStatus = 'WAITING'
export const DEFAULT_LIMIT = 20
export const PAGE_SIZE_OPTIONS = [10, 20, 50]

/** Query params of this screen; any other param of the URL is left alone. */
/** `tab` is the legacy name of `status` (still read, never written). */
export const LIST_QUERY_KEYS = ['status', 'tab', 'q', 'from', 'to', 'sort', 'order', 'page', 'limit'] as const

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Default order (S3): scheduledAt asc; Apartados by the nearest deadline first. */
export function defaultSortFor(tab: BackorderStatus): BackorderSortBy {
  return tab === 'RESERVED' ? 'reservedUntil' : 'scheduledAt'
}

function firstValue(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : null
}

function statusOf(value: string | null): BackorderStatus | null {
  const status = value?.toUpperCase()
  return BACKORDER_TABS.find((tab) => tab.status === status)?.status ?? null
}

/** `status=<STATUS>` (the API's name, any case); the legacy `tab=` is accepted when `status` is absent or invalid. */
function tabOf(query: Record<string, unknown>): BackorderStatus {
  return statusOf(firstValue(query.status)) ?? statusOf(firstValue(query.tab)) ?? DEFAULT_TAB
}

const dayOf = (value: string | null) => (value && DAY.test(value) ? value : '')

function positiveInt(value: string | null, fallback: number): number {
  const n = value !== null && /^\d+$/.test(value) ? Number(value) : NaN
  return Number.isSafeInteger(n) && n >= 1 ? n : fallback
}

export function parseListQuery(query: Record<string, unknown>): BackorderListState {
  const tab = tabOf(query)
  const sort = firstValue(query.sort)
  // `reservedUntil` only orders Apartados; `status` is one value per tab, so it is never offered.
  const sortBy: BackorderSortBy =
    sort === 'scheduledAt' || (sort === 'reservedUntil' && tab === 'RESERVED') ? sort : defaultSortFor(tab)
  const limit = positiveInt(firstValue(query.limit), DEFAULT_LIMIT)
  return {
    tab,
    q: (firstValue(query.q) ?? '').trim().slice(0, SEARCH_MAX_LENGTH),
    from: dayOf(firstValue(query.from)),
    to: dayOf(firstValue(query.to)),
    sortBy,
    sortOrder: firstValue(query.order) === 'desc' ? 'desc' : 'asc',
    page: positiveInt(firstValue(query.page), 1),
    limit: PAGE_SIZE_OPTIONS.includes(limit) ? limit : DEFAULT_LIMIT,
  }
}

/** The state as URL query, with every default left out. */
export function listQueryOf(state: BackorderListState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.tab !== DEFAULT_TAB) query.status = state.tab
  const q = state.q.trim().slice(0, SEARCH_MAX_LENGTH)
  if (q) query.q = q
  if (state.from) query.from = state.from
  if (state.to) query.to = state.to
  if (state.sortBy !== defaultSortFor(state.tab)) query.sort = state.sortBy
  if (state.sortOrder !== 'asc') query.order = state.sortOrder
  if (state.page > 1) query.page = String(state.page)
  if (state.limit !== DEFAULT_LIMIT) query.limit = String(state.limit)
  return query
}

/** The current URL query with this screen's params replaced by the new state. */
export function mergeListQuery(
  current: Record<string, unknown>,
  state: BackorderListState,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current }
  for (const param of LIST_QUERY_KEYS) delete merged[param]
  return { ...merged, ...listQueryOf(state) }
}

/** A tab change keeps the filters, but starts over: page 1 and that tab's own default sort. */
export function setListTab(state: BackorderListState, tab: BackorderStatus): BackorderListState {
  return { ...state, tab, page: 1, sortBy: defaultSortFor(tab), sortOrder: 'asc' }
}

/** «Quitar filtros»: search and dates off; the tab, sort and page size stay. */
export function clearListFilters(state: BackorderListState): BackorderListState {
  return { ...state, q: '', from: '', to: '', page: 1 }
}

export function hasActiveFilters(state: BackorderListState): boolean {
  return state.q.trim() !== '' || state.from !== '' || state.to !== ''
}

/** Params of `GET /backorders` for the state. */
export function listParamsOf(state: BackorderListState): BackorderListParams {
  const params: BackorderListParams = {
    page: state.page,
    limit: state.limit,
    status: [state.tab],
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
  }
  const q = state.q.trim()
  if (q) params.q = q
  return { ...params, ...closingDateRange(state.from, state.to) }
}
