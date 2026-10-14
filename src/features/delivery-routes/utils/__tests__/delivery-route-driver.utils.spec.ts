import { describe, it, expect } from 'vitest'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { buildDriverRouteMission, summarizeDriverRoutes } from '../delivery-route-driver.utils'

type StopStatus = DeliveryRouteStop['status']

function stop(sortOrder: number, status: StopStatus, extra: Partial<DeliveryRouteStop> = {}): DeliveryRouteStop {
  return {
    id: `s${sortOrder}`,
    saleId: `sale-${sortOrder}`,
    saleFolio: `V-10${sortOrder}`,
    sortOrder,
    status,
    checkedInAt: null,
    completedAt: null,
    customer: { id: `c${sortOrder}`, name: `Cliente ${sortOrder}`, email: null },
    shippingAddress: null,
    ...extra,
  }
}

function route(overrides: Partial<DeliveryRouteResponseDto> = {}): DeliveryRouteResponseDto {
  return {
    id: '9ea3c7b1-0000-4000-8000-000000000000',
    status: 'ACTIVE',
    driver: { id: 'd1', name: 'Ana', email: 'a@x' },
    startedAt: '2026-10-14T09:40:00',
    completedAt: null,
    cancelledAt: null,
    notes: null,
    stops: [],
    timeline: [{ type: 'ROUTE_CREATED', at: '2026-10-14T08:00:00', actor: null }],
    ...overrides,
  }
}

const NOW = new Date('2026-10-14T11:00:00')

describe('buildDriverRouteMission — identity and time on route', () => {
  it('titles the route by its creation day without the driver name, keeping the short id as reference', () => {
    const mission = buildDriverRouteMission(route(), NOW)
    expect(mission.title).toBe('Ruta del 14 oct')
    expect(mission.reference).toBe('9ea3c7b1')
  })

  it('falls back to the short id when the creation date is unknown', () => {
    expect(buildDriverRouteMission(route({ timeline: [] }), NOW).title).toBe('Ruta 9ea3c7b1')
  })

  it('reports the start time and the elapsed time on route', () => {
    const mission = buildDriverRouteMission(route(), NOW)
    expect(mission.startedAtLabel).toBe('Iniciada 09:40')
    expect(mission.elapsedLabel).toBe('1 h 20 min en ruta')
  })

  it('formats elapsed boundaries: under a minute, minutes only, whole hours', () => {
    expect(buildDriverRouteMission(route({ startedAt: '2026-10-14T10:59:30' }), NOW).elapsedLabel).toBe('Recién iniciada')
    expect(buildDriverRouteMission(route({ startedAt: '2026-10-14T10:15:00' }), NOW).elapsedLabel).toBe('45 min en ruta')
    expect(buildDriverRouteMission(route({ startedAt: '2026-10-14T09:00:00' }), NOW).elapsedLabel).toBe('2 h en ruta')
  })

  it('omits start and elapsed labels when the route has no start time', () => {
    const mission = buildDriverRouteMission(route({ startedAt: null }), NOW)
    expect(mission.startedAtLabel).toBeNull()
    expect(mission.elapsedLabel).toBeNull()
  })
})

describe('buildDriverRouteMission — progress', () => {
  it('reads "3 de 8 entregadas" with the percent, and counts skipped stops', () => {
    const stops = [
      stop(0, 'COMPLETED'), stop(1, 'COMPLETED'), stop(2, 'COMPLETED'), stop(3, 'SKIPPED'),
      stop(4, 'PENDING'), stop(5, 'PENDING'), stop(6, 'PENDING'), stop(7, 'PENDING'),
    ]
    const mission = buildDriverRouteMission(route({ stops }), NOW)
    expect(mission.progressLabel).toBe('3 de 8 entregadas')
    expect(mission.progress).toEqual({ completed: 3, total: 8, percent: 38 })
    expect(mission.skippedLabel).toBe('1 omitida')
  })

  it('pluralizes skipped stops and hides the label when none were skipped', () => {
    const two = buildDriverRouteMission(route({ stops: [stop(0, 'SKIPPED'), stop(1, 'SKIPPED'), stop(2, 'PENDING')] }), NOW)
    expect(two.skippedLabel).toBe('2 omitidas')
    expect(buildDriverRouteMission(route({ stops: [stop(0, 'PENDING')] }), NOW).skippedLabel).toBeNull()
  })

  it('reads "Sin paradas" for an empty route', () => {
    expect(buildDriverRouteMission(route({ stops: [] }), NOW).progressLabel).toBe('Sin paradas')
  })
})

describe('buildDriverRouteMission — target stop and call to action', () => {
  it('targets the first pending stop as "Siguiente parada" with position, customer, folio and address', () => {
    const stops = [
      stop(0, 'COMPLETED'),
      stop(1, 'PENDING', {
        customer: { id: 'c1', name: 'María López', email: null },
        saleFolio: 'V-1023',
        shippingAddress: {
          id: 'a1', street: 'Av. Juárez', exteriorNumber: '120', interiorNumber: null, zipCode: null,
          neighborhood: 'Centro', municipality: null, city: 'Monterrey', state: null, label: null,
        },
      }),
      stop(2, 'PENDING'),
    ]
    const mission = buildDriverRouteMission(route({ stops }), NOW)
    expect(mission.target).toEqual({
      heading: 'Siguiente parada',
      position: 2,
      customer: 'María López',
      folio: 'V-1023',
      address: 'Av. Juárez #120, Centro, Monterrey',
    })
    expect(mission.ctaLabel).toBe('Continuar ruta')
  })

  it('targets an in-progress stop first, headed "Parada en curso"', () => {
    const mission = buildDriverRouteMission(route({ stops: [stop(0, 'PENDING'), stop(1, 'IN_PROGRESS')] }), NOW)
    expect(mission.target?.heading).toBe('Parada en curso')
    expect(mission.target?.position).toBe(2)
  })

  it('falls back for a stop without customer, folio or address', () => {
    const mission = buildDriverRouteMission(
      route({ stops: [stop(0, 'PENDING', { customer: null, saleFolio: null, shippingAddress: null })] }),
      NOW,
    )
    expect(mission.target).toMatchObject({ customer: 'Cliente sin nombre', folio: null, address: null })
  })

  it('has no target once every stop is attended and invites to review the route', () => {
    const mission = buildDriverRouteMission(route({ stops: [stop(0, 'COMPLETED'), stop(1, 'SKIPPED')] }), NOW)
    expect(mission.target).toBeNull()
    expect(mission.doneLabel).toBe('Todas las paradas atendidas')
    expect(mission.ctaLabel).toBe('Ver ruta')
  })

  it('has no target nor done label for a route without stops', () => {
    const mission = buildDriverRouteMission(route({ stops: [] }), NOW)
    expect(mission.target).toBeNull()
    expect(mission.doneLabel).toBeNull()
    expect(mission.ctaLabel).toBe('Ver ruta')
  })

  it('exposes trimmed notes, null when blank', () => {
    expect(buildDriverRouteMission(route({ notes: '  Llevar cambio ' }), NOW).notes).toBe('Llevar cambio')
    expect(buildDriverRouteMission(route({ notes: '   ' }), NOW).notes).toBeNull()
  })
})

describe('summarizeDriverRoutes', () => {
  it('counts routes and actionable stops (pending + in progress)', () => {
    const routes = [
      route({ stops: [stop(0, 'PENDING'), stop(1, 'IN_PROGRESS'), stop(2, 'COMPLETED')] }),
      route({ id: 'r2', stops: [stop(0, 'PENDING'), stop(1, 'SKIPPED')] }),
    ]
    expect(summarizeDriverRoutes(routes)).toBe('2 rutas · 3 paradas pendientes')
  })

  it('uses singular forms', () => {
    expect(summarizeDriverRoutes([route({ stops: [stop(0, 'PENDING')] })])).toBe('1 ruta · 1 parada pendiente')
  })

  it('says when nothing is left to deliver', () => {
    expect(summarizeDriverRoutes([route({ stops: [stop(0, 'COMPLETED')] })])).toBe('1 ruta · sin paradas pendientes')
  })
})
