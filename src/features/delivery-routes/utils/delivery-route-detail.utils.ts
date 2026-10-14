/**
 * Manager route detail derivation: the pure view model behind the manager
 * branch of `DeliveryRouteDetailView` (header, KPI tiles, progress and the
 * rich stop rows). The current stop reuses the cockpit selection so the
 * manager sees the same stop the driver is working on.
 */
import { formatAddress } from '@/core/shared/utils/formatAddress'
import type { AppBadgeTone } from '@/core/shared/utils/badge.utils'
import { deriveDriverRouteCockpit } from '../composables/cockpit/useDriverRouteCockpit'
import {
  DELIVERY_ROUTE_STOP_STATUS_LABELS,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStop,
  type DeliveryRouteStopStatus,
} from '../interfaces/delivery-route.types'
import {
  buildRouteDisplayName,
  formatDurationMinutes,
  formatRouteMoment,
  getRouteCreatedAt,
  getRouteProgress,
  minutesBetween,
  shortRouteId,
  type DeliveryRouteProgress,
} from './delivery-route-list.utils'

export const DELIVERY_ROUTE_STOP_STATUS_TONES: Record<DeliveryRouteStopStatus, AppBadgeTone> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  SKIPPED: 'inactive',
}

export interface ManagerRouteKpi {
  key: 'delivered' | 'pending' | 'skipped' | 'time'
  label: string
  value: string
}

export interface ManagerRouteStopRow {
  stop: DeliveryRouteStop
  /** 1-based position in the route. */
  position: number
  customer: string
  folio: string
  statusLabel: string
  statusTone: AppBadgeTone
  address: string | null
  /** "Entregada 10:05" or "Check-in 10:40"; null when nothing happened yet. */
  timeLabel: string | null
  isCurrent: boolean
}

export interface ManagerRouteDetail {
  title: string
  reference: string
  /** "Creada 08:00", "Iniciada 09:40", "Completada …" / "Cancelada …". */
  moments: string[]
  kpis: ManagerRouteKpi[]
  progress: DeliveryRouteProgress
  progressLabel: string
  stops: ManagerRouteStopRow[]
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function moment(label: string, iso: string | null, now: Date): string | null {
  const value = formatRouteMoment(iso, now)
  return value ? `${label} ${value}` : null
}

function buildTimeKpi(route: DeliveryRouteResponseDto, now: Date): ManagerRouteKpi {
  const startedAt = parseDate(route.startedAt)
  const endedAt = parseDate(route.completedAt) ?? parseDate(route.cancelledAt)
  const label = endedAt ? 'Duración' : 'En ruta'
  if (!startedAt) return { key: 'time', label, value: '—' }
  return { key: 'time', label, value: formatDurationMinutes(minutesBetween(startedAt, endedAt ?? now)) }
}

function buildStopRow(stop: DeliveryRouteStop, currentId: string | null, now: Date): ManagerRouteStopRow {
  const address = stop.shippingAddress ? formatAddress(stop.shippingAddress) : ''
  return {
    stop,
    position: stop.sortOrder + 1,
    customer: stop.customer?.name ?? 'Cliente sin nombre',
    folio: stop.saleFolio ?? stop.id.slice(0, 8),
    statusLabel: DELIVERY_ROUTE_STOP_STATUS_LABELS[stop.status],
    statusTone: DELIVERY_ROUTE_STOP_STATUS_TONES[stop.status],
    address: address.length > 0 ? address : null,
    timeLabel: moment('Entregada', stop.completedAt, now) ?? moment('Check-in', stop.checkedInAt, now),
    isCurrent: currentId !== null && stop.id === currentId,
  }
}

export function buildManagerRouteDetail(route: DeliveryRouteResponseDto, now: Date): ManagerRouteDetail {
  const progress = getRouteProgress(route)
  const count = (status: DeliveryRouteStopStatus) => route.stops.filter((s) => s.status === status).length
  const currentId = route.status === 'ACTIVE' ? (deriveDriverRouteCockpit(route).currentStop?.id ?? null) : null

  const moments = [
    moment('Creada', getRouteCreatedAt(route), now),
    moment('Iniciada', route.startedAt, now),
    moment('Completada', route.completedAt, now),
    moment('Cancelada', route.cancelledAt, now),
  ].filter((value): value is string => value !== null)

  return {
    title: buildRouteDisplayName(route),
    reference: shortRouteId(route.id),
    moments,
    kpis: [
      { key: 'delivered', label: 'Entregadas', value: String(count('COMPLETED')) },
      { key: 'pending', label: 'Pendientes', value: String(count('PENDING') + count('IN_PROGRESS')) },
      { key: 'skipped', label: 'Omitidas', value: String(count('SKIPPED')) },
      buildTimeKpi(route, now),
    ],
    progress,
    progressLabel:
      progress.total === 0 ? 'Sin paradas' : `${progress.completed} de ${progress.total} entregadas`,
    stops: route.stops.map((stop) => buildStopRow(stop, currentId, now)),
  }
}
