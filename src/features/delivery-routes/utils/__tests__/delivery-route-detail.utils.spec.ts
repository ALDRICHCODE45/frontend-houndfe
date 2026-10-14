import { describe, it, expect } from 'vitest'
import type { DeliveryRouteResponseDto, DeliveryRouteStop } from '../../interfaces/delivery-route.types'
import { buildManagerRouteDetail } from '../delivery-route-detail.utils'

type StopStatus = DeliveryRouteStop['status']

function stop(sortOrder: number, status: StopStatus, extra: Partial<DeliveryRouteStop> = {}): DeliveryRouteStop {
  return {
    id: `stop-${sortOrder}-0000-0000`,
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
    driver: { id: 'd1', name: 'Juan Pérez', email: 'j@x' },
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

describe('buildManagerRouteDetail — header', () => {
  it('titles the route with day and driver and keeps the short id as reference', () => {
    const detail = buildManagerRouteDetail(route(), NOW)
    expect(detail.title).toBe('Ruta del 14 oct · Juan Pérez')
    expect(detail.reference).toBe('9ea3c7b1')
  })

  it('lists the lifecycle moments that exist, same-day as time only', () => {
    expect(buildManagerRouteDetail(route(), NOW).moments).toEqual(['Creada 08:00', 'Iniciada 09:40'])
    expect(buildManagerRouteDetail(route({ status: 'DRAFT', startedAt: null }), NOW).moments).toEqual(['Creada 08:00'])
  })

  it('adds the end moment and dates earlier days', () => {
    const completed = buildManagerRouteDetail(
      route({ status: 'COMPLETED', completedAt: '2026-10-14T12:30:00' }),
      new Date('2026-10-15T09:00:00'),
    )
    expect(completed.moments).toEqual(['Creada 14 oct, 08:00', 'Iniciada 14 oct, 09:40', 'Completada 14 oct, 12:30'])
    const cancelled = buildManagerRouteDetail(route({ status: 'CANCELLED', cancelledAt: '2026-10-14T10:00:00' }), NOW)
    expect(cancelled.moments).toContain('Cancelada 10:00')
  })
})

describe('buildManagerRouteDetail — KPIs and progress', () => {
  const stops = [
    stop(0, 'COMPLETED'), stop(1, 'COMPLETED'), stop(2, 'COMPLETED'), stop(3, 'SKIPPED'),
    stop(4, 'IN_PROGRESS'), stop(5, 'PENDING'), stop(6, 'PENDING'), stop(7, 'PENDING'),
  ]

  it('counts delivered, pending (pending + in progress) and skipped stops, with time on route', () => {
    const detail = buildManagerRouteDetail(route({ stops }), NOW)
    expect(detail.kpis).toEqual([
      { key: 'delivered', label: 'Entregadas', value: '3' },
      { key: 'pending', label: 'Pendientes', value: '4' },
      { key: 'skipped', label: 'Omitidas', value: '1' },
      { key: 'time', label: 'En ruta', value: '1 h 20 min' },
    ])
    expect(detail.progress).toEqual({ completed: 3, total: 8, percent: 38 })
    expect(detail.progressLabel).toBe('3 de 8 entregadas')
  })

  it('reports the total duration of a finished route and "—" before it starts', () => {
    const done = buildManagerRouteDetail(route({ status: 'COMPLETED', completedAt: '2026-10-14T10:25:00' }), NOW)
    expect(done.kpis[3]).toEqual({ key: 'time', label: 'Duración', value: '45 min' })
    const draft = buildManagerRouteDetail(route({ status: 'DRAFT', startedAt: null }), NOW)
    expect(draft.kpis[3]).toEqual({ key: 'time', label: 'En ruta', value: '—' })
    expect(draft.progressLabel).toBe('Sin paradas')
  })
})

describe('buildManagerRouteDetail — stop rows', () => {
  it('translates each stop status with a tone and marks the current stop of an active route', () => {
    const detail = buildManagerRouteDetail(
      route({ stops: [stop(0, 'COMPLETED'), stop(1, 'IN_PROGRESS'), stop(2, 'PENDING'), stop(3, 'SKIPPED')] }),
      NOW,
    )
    expect(detail.stops.map((s) => [s.position, s.statusLabel, s.statusTone, s.isCurrent])).toEqual([
      [1, 'Entregada', 'success', false],
      [2, 'En curso', 'warning', true],
      [3, 'Pendiente', 'neutral', false],
      [4, 'Omitida', 'inactive', false],
    ])
  })

  it('does not mark a current stop outside an active route', () => {
    const detail = buildManagerRouteDetail(route({ status: 'DRAFT', startedAt: null, stops: [stop(0, 'PENDING')] }), NOW)
    expect(detail.stops[0]?.isCurrent).toBe(false)
  })

  it('carries customer, folio, address and the delivery or check-in time', () => {
    const detail = buildManagerRouteDetail(
      route({
        stops: [
          stop(0, 'COMPLETED', {
            completedAt: '2026-10-14T10:05:00',
            checkedInAt: '2026-10-14T10:00:00',
            customer: { id: 'c', name: 'María López', email: null },
            saleFolio: 'V-1023',
            shippingAddress: {
              id: 'a', street: 'Av. Juárez', exteriorNumber: '120', interiorNumber: null, zipCode: null,
              neighborhood: 'Centro', municipality: null, city: 'Monterrey', state: null, label: null,
            },
          }),
          stop(1, 'IN_PROGRESS', { checkedInAt: '2026-10-14T10:40:00' }),
          stop(2, 'PENDING', { customer: null, saleFolio: null }),
        ],
      }),
      NOW,
    )
    expect(detail.stops[0]).toMatchObject({
      customer: 'María López',
      folio: 'V-1023',
      address: 'Av. Juárez #120, Centro, Monterrey',
      timeLabel: 'Entregada 10:05',
    })
    expect(detail.stops[1]?.timeLabel).toBe('Check-in 10:40')
    expect(detail.stops[2]).toMatchObject({ customer: 'Cliente sin nombre', folio: 'stop-2-0', address: null, timeLabel: null })
  })
})
