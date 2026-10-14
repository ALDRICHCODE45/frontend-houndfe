/**
 * Driver mission card derivation: the pure view model behind one card of the
 * driver's "Mis rutas activas" list and the workload summary above it.
 *
 * The target stop reuses the cockpit selection (`deriveDriverRouteCockpit`)
 * so the list and the route cockpit always point at the same stop.
 */
import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatAddress } from '@/core/shared/utils/formatAddress'
import { deriveDriverRouteCockpit } from '../composables/cockpit/useDriverRouteCockpit'
import type { DeliveryRouteResponseDto } from '../interfaces/delivery-route.types'
import {
  buildRouteTitle,
  getRouteProgress,
  shortRouteId,
  type DeliveryRouteProgress,
} from './delivery-route-list.utils'

export interface DriverRouteMissionTarget {
  heading: 'Parada en curso' | 'Siguiente parada'
  /** 1-based position of the stop in the route. */
  position: number
  customer: string
  folio: string | null
  address: string | null
}

export interface DriverRouteMission {
  title: string
  reference: string
  startedAtLabel: string | null
  elapsedLabel: string | null
  progress: DeliveryRouteProgress
  progressLabel: string
  skippedLabel: string | null
  target: DriverRouteMissionTarget | null
  doneLabel: string | null
  notes: string | null
  ctaLabel: 'Continuar ruta' | 'Ver ruta'
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** "Iniciada 09:40" today, "Iniciada 13 oct, 09:40" on an earlier day. */
function formatStartedAt(startedAt: Date, now: Date): string {
  const pattern = isSameDay(startedAt, now) ? 'HH:mm' : "d MMM, HH:mm"
  return `Iniciada ${format(startedAt, pattern, { locale: es })}`
}

/** "Recién iniciada", "45 min en ruta", "2 h en ruta", "1 h 20 min en ruta". */
function formatElapsed(startedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60_000))
  if (minutes < 1) return 'Recién iniciada'
  if (minutes < 60) return `${minutes} min en ruta`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h en ruta` : `${hours} h ${rest} min en ruta`
}

export function buildDriverRouteMission(route: DeliveryRouteResponseDto, now: Date): DriverRouteMission {
  const startedAt = parseDate(route.startedAt)
  const progress = getRouteProgress(route)
  const skipped = route.stops.filter((stop) => stop.status === 'SKIPPED').length
  const { currentStop } = deriveDriverRouteCockpit(route)

  const target: DriverRouteMissionTarget | null = currentStop
    ? {
        heading: currentStop.status === 'IN_PROGRESS' ? 'Parada en curso' : 'Siguiente parada',
        position: currentStop.sortOrder + 1,
        customer: currentStop.customer?.name ?? 'Cliente sin nombre',
        folio: currentStop.saleFolio,
        address: currentStop.shippingAddress ? formatAddress(currentStop.shippingAddress) || null : null,
      }
    : null

  const notes = route.notes?.trim() ?? ''

  return {
    title: buildRouteTitle(route),
    reference: shortRouteId(route.id),
    startedAtLabel: startedAt ? formatStartedAt(startedAt, now) : null,
    elapsedLabel: startedAt ? formatElapsed(startedAt, now) : null,
    progress,
    progressLabel:
      progress.total === 0 ? 'Sin paradas' : `${progress.completed} de ${progress.total} entregadas`,
    skippedLabel: skipped === 0 ? null : `${skipped} ${skipped === 1 ? 'omitida' : 'omitidas'}`,
    target,
    doneLabel: target === null && progress.total > 0 ? 'Todas las paradas atendidas' : null,
    notes: notes.length > 0 ? notes : null,
    ctaLabel: target ? 'Continuar ruta' : 'Ver ruta',
  }
}

/** "2 rutas · 7 paradas pendientes"; pending counts PENDING and IN_PROGRESS stops. */
export function summarizeDriverRoutes(routes: readonly DeliveryRouteResponseDto[]): string {
  const pending = routes.reduce(
    (acc, route) =>
      acc + route.stops.filter((stop) => stop.status === 'PENDING' || stop.status === 'IN_PROGRESS').length,
    0,
  )
  const routesLabel = `${routes.length} ${routes.length === 1 ? 'ruta' : 'rutas'}`
  const pendingLabel =
    pending === 0
      ? 'sin paradas pendientes'
      : `${pending} ${pending === 1 ? 'parada pendiente' : 'paradas pendientes'}`
  return `${routesLabel} · ${pendingLabel}`
}
