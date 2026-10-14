/**
 * delivery-route-list.utils.ts — Pure helpers for the manager route listing.
 *
 * The backend returns the full flat route list, so search, status filter,
 * sorting and pagination all run client-side over that array. Nothing here
 * touches Vue, the network or the clock beyond the provided ISO strings.
 */

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { PaginatedResponse, SortingParam } from '@/core/shared/types/table.types'
import type {
  DeliveryRouteResponseDto,
  DeliveryRouteStatus,
} from '../interfaces/delivery-route.types'

export type DeliveryRouteStatusFilter = DeliveryRouteStatus | 'ALL'

export const DELIVERY_ROUTE_STATUS_ORDER: readonly DeliveryRouteStatus[] = [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
]

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const

/** The DTO has no createdAt; the ROUTE_CREATED timeline event carries it. */
export function getRouteCreatedAt(route: DeliveryRouteResponseDto): string | null {
  return route.timeline.find((event) => event.type === 'ROUTE_CREATED')?.at ?? null
}

/** "13 oct 2026, 15:00" in local time; "—" for missing or invalid values. */
export function formatRouteDateTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'd MMM yyyy, HH:mm', { locale: es })
}

/** Compact route identifier: first 8 characters of the UUID. */
export function shortRouteId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id
}

/** "13 oct" in local time, independent of the runtime's Intl month data. */
function formatDayMonth(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`
}

/** "Ruta del 13 oct"; unknown creation date falls back to the short id. */
export function buildRouteTitle(route: DeliveryRouteResponseDto): string {
  const createdAt = getRouteCreatedAt(route)
  const day = createdAt ? formatDayMonth(createdAt) : null
  return day ? `Ruta del ${day}` : `Ruta ${shortRouteId(route.id)}`
}

/**
 * Human identifier derived in the front (the backend has no folio):
 * "Ruta del 13 oct · Juan Pérez". Unknown creation date falls back to the
 * short id; an unassigned route reads "Sin repartidor".
 */
export function buildRouteDisplayName(route: DeliveryRouteResponseDto): string {
  return `${buildRouteTitle(route)} · ${route.driver?.name ?? 'Sin repartidor'}`
}

/** Unique customer names in stop order; stops without customer are skipped. */
export function getRouteCustomers(route: DeliveryRouteResponseDto): string[] {
  const names: string[] = []
  for (const stop of route.stops) {
    const name = stop.customer?.name
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

export interface DeliveryRouteProgress {
  completed: number
  total: number
  /** Rounded 0–100; 0 when the route has no stops. */
  percent: number
}

export function getRouteProgress(route: DeliveryRouteResponseDto): DeliveryRouteProgress {
  const total = route.stops.length
  const completed = route.stops.filter((stop) => stop.status === 'COMPLETED').length
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Case- and accent-insensitive search over the display name, id, driver,
 * customers, sale folios and notes. A blank query matches every route.
 */
export function matchesRouteSearch(route: DeliveryRouteResponseDto, query: string): boolean {
  const needle = normalize(query.trim())
  if (!needle) return true
  const haystack = [
    buildRouteDisplayName(route),
    route.id,
    route.driver?.name ?? '',
    route.notes ?? '',
    ...getRouteCustomers(route),
    ...route.stops.map((stop) => stop.saleFolio ?? ''),
  ]
  return haystack.some((value) => normalize(value).includes(needle))
}

export function countRoutesByStatus(
  rows: readonly DeliveryRouteResponseDto[],
): Record<DeliveryRouteStatusFilter, number> {
  const counts: Record<DeliveryRouteStatusFilter, number> = {
    ALL: rows.length,
    DRAFT: 0,
    ACTIVE: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  }
  for (const row of rows) counts[row.status] += 1
  return counts
}

type SortValue = string | number | null

const SORT_ACCESSORS: Record<string, (route: DeliveryRouteResponseDto) => SortValue> = {
  createdAt: (route) => getRouteCreatedAt(route),
  startedAt: (route) => route.startedAt,
  completedAt: (route) => route.completedAt ?? route.cancelledAt,
  driver: (route) => (route.driver ? normalize(route.driver.name) : null),
  progress: (route) => getRouteProgress(route).percent,
  status: (route) => DELIVERY_ROUTE_STATUS_ORDER.indexOf(route.status),
}

/**
 * Stable sort by the first known sorting column. Null values always go last,
 * in both directions. Unknown columns keep the input order. Never mutates.
 */
export function sortDeliveryRoutes(
  rows: readonly DeliveryRouteResponseDto[],
  sorting: readonly SortingParam[] | undefined,
): DeliveryRouteResponseDto[] {
  const rule = sorting?.find((entry) => entry.id in SORT_ACCESSORS)
  if (!rule) return [...rows]
  const accessor = SORT_ACCESSORS[rule.id]!
  const direction = rule.desc ? -1 : 1
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((a, b) => {
      if (a.value === b.value) return a.index - b.index
      if (a.value === null) return 1
      if (b.value === null) return -1
      return (a.value < b.value ? -1 : 1) * direction
    })
    .map(({ row }) => row)
}

export interface DeliveryRouteListQuery {
  status: DeliveryRouteStatusFilter
  search: string
  sorting: readonly SortingParam[] | undefined
  pageIndex: number
  pageSize: number
}

/** Status filter → search → sort → page slice, in that order. */
export function queryDeliveryRoutes(
  rows: readonly DeliveryRouteResponseDto[],
  query: DeliveryRouteListQuery,
): PaginatedResponse<DeliveryRouteResponseDto> {
  const filtered = rows.filter(
    (row) =>
      (query.status === 'ALL' || row.status === query.status) &&
      matchesRouteSearch(row, query.search),
  )
  const sorted = sortDeliveryRoutes(filtered, query.sorting)
  const start = query.pageIndex * query.pageSize
  return {
    data: sorted.slice(start, start + query.pageSize),
    pagination: {
      pageIndex: query.pageIndex,
      pageSize: query.pageSize,
      totalCount: sorted.length,
      pageCount: Math.ceil(sorted.length / query.pageSize) || 1,
    },
  }
}
