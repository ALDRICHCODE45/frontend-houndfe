import { describe, it, expect } from 'vitest'
import {
  CreateDeliveryRouteSchema,
  UpdateDeliveryRouteSchema,
  AppendDeliveryRouteStopSchema,
  ReorderDeliveryRouteStopsSchema,
  DeliveryRouteResponseSchema,
  DeliveryRouteTimelineEventSchema,
  DeliveryRouteStatusSchema,
  DeliveryRouteStopStatusSchema,
  DeliveryRouteShippingAddressSchema,
  DELIVERY_ROUTE_STATUS_LABELS,
  DELIVERY_ROUTE_STATUS_TONES,
  DELIVERY_ROUTE_STOP_STATUS_LABELS,
  type DeliveryRouteResponseDto,
  type DeliveryRouteStatus,
  type DeliveryRouteStopStatus,
} from '../delivery-route.types'

const validUuid = '11111111-1111-1111-1111-111111111111'

function makeBackendSample(): DeliveryRouteResponseDto {
  return {
    id: validUuid,
    status: 'DRAFT',
    driver: { id: '22222222-2222-2222-2222-222222222222', name: 'Carlos', email: 'c@x.com' },
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    notes: 'Entregar antes de las 5',
    stops: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        saleId: '44444444-4444-4444-4444-444444444444',
        saleFolio: 'V-001',
        sortOrder: 0,
        status: 'PENDING',
        checkedInAt: null,
        completedAt: null,
        customer: { id: '55555555-5555-5555-5555-555555555555', name: 'Maria', email: 'm@x.com' },
        shippingAddress: {
          id: '66666666-6666-6666-6666-666666666666',
          street: 'Av Reforma',
          exteriorNumber: '123',
          interiorNumber: '4B',
          zipCode: '06600',
          neighborhood: 'Centro',
          municipality: 'Cuauhtémoc',
          city: 'CDMX',
          state: 'CMX',
          label: 'Casa',
          latitude: 19.4326,
          longitude: -99.1332,
        },
      },
    ],
    timeline: [
      { type: 'ROUTE_CREATED', at: '2024-05-01T10:00:00.000Z', actor: null },
    ],
  }
}

describe('DeliveryRouteResponseSchema (sdd delivery-routes S1b, design §5.1)', () => {
  it('parses a backend sample with all 5 timeline event types', () => {
    const sample = makeBackendSample()
    sample.timeline = [
      { type: 'ROUTE_CREATED', at: '2024-05-01T10:00:00.000Z', actor: null },
      { type: 'ROUTE_STARTED', at: '2024-05-01T10:30:00.000Z', actor: { id: 'd', name: 'D' } },
      {
        type: 'STOP_CHECKED_IN',
        at: '2024-05-01T11:00:00.000Z',
        stopId: validUuid,
        sortOrder: 0,
        actor: { id: 'd', name: 'D' },
      },
      { type: 'ROUTE_COMPLETED', at: '2024-05-01T12:00:00.000Z', actor: { id: 'd', name: 'D' } },
      { type: 'ROUTE_CANCELLED', at: '2024-05-01T12:30:00.000Z', actor: null },
    ]
    const result = DeliveryRouteResponseSchema.safeParse(sample)
    expect(result.success).toBe(true)
  })

  it('ROUTE_CREATED.actor must be null', () => {
    const sample = makeBackendSample()
    sample.timeline = [{ type: 'ROUTE_CREATED', at: '2024-05-01T10:00:00.000Z', actor: null }]
    const result = DeliveryRouteResponseSchema.safeParse(sample)
    expect(result.success).toBe(true)

    const bad = {
      ...sample,
      timeline: [{ type: 'ROUTE_CREATED', at: '2024-05-01T10:00:00.000Z', actor: { id: 'x', name: 'X' } }],
    }
    const badResult = DeliveryRouteResponseSchema.safeParse(bad)
    expect(badResult.success).toBe(false)
  })

  it('STOP_CHECKED_IN requires stopId and sortOrder', () => {
    const sample = makeBackendSample()
    sample.timeline = [
      {
        type: 'STOP_CHECKED_IN',
        at: '2024-05-01T11:00:00.000Z',
        stopId: validUuid,
        sortOrder: 0,
        actor: null,
      },
    ]
    const result = DeliveryRouteResponseSchema.safeParse(sample)
    expect(result.success).toBe(true)
  })
})

describe('DeliveryRouteTimelineEventSchema discriminated union (sdd delivery-routes S1b, design §5.1)', () => {
  it('rejects an unknown event type', () => {
    const result = DeliveryRouteTimelineEventSchema.safeParse({
      type: 'ROUTE_UNKNOWN',
      at: '2024-05-01T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('each of the 5 event types parses independently', () => {
    expect(
      DeliveryRouteTimelineEventSchema.safeParse({
        type: 'ROUTE_CREATED',
        at: '2024-05-01T10:00:00.000Z',
        actor: null,
      }).success,
    ).toBe(true)
    expect(
      DeliveryRouteTimelineEventSchema.safeParse({
        type: 'ROUTE_STARTED',
        at: '2024-05-01T10:00:00.000Z',
        actor: { id: 'd', name: 'D' },
      }).success,
    ).toBe(true)
    expect(
      DeliveryRouteTimelineEventSchema.safeParse({
        type: 'STOP_CHECKED_IN',
        at: '2024-05-01T11:00:00.000Z',
        stopId: validUuid,
        sortOrder: 1,
        actor: null,
      }).success,
    ).toBe(true)
    expect(
      DeliveryRouteTimelineEventSchema.safeParse({
        type: 'ROUTE_COMPLETED',
        at: '2024-05-01T12:00:00.000Z',
        actor: null,
      }).success,
    ).toBe(true)
    expect(
      DeliveryRouteTimelineEventSchema.safeParse({
        type: 'ROUTE_CANCELLED',
        at: '2024-05-01T12:30:00.000Z',
        actor: null,
      }).success,
    ).toBe(true)
  })
})

describe('DeliveryRouteStatusSchema + StopStatusSchema (sdd delivery-routes S1b, design §5.1)', () => {
  it('DeliveryRouteStatusSchema accepts every status', () => {
    for (const v of ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as DeliveryRouteStatus[]) {
      expect(DeliveryRouteStatusSchema.safeParse(v).success).toBe(true)
    }
  })

  it('DeliveryRouteStatusSchema rejects unknown statuses', () => {
    expect(DeliveryRouteStatusSchema.safeParse('UNKNOWN').success).toBe(false)
    expect(DeliveryRouteStatusSchema.safeParse('draft').success).toBe(false)
  })

  it('DeliveryRouteStopStatusSchema accepts every stop status', () => {
    for (const v of ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'] as DeliveryRouteStopStatus[]) {
      expect(DeliveryRouteStopStatusSchema.safeParse(v).success).toBe(true)
    }
  })

  it('DeliveryRouteStopStatusSchema rejects unknown stop statuses', () => {
    expect(DeliveryRouteStopStatusSchema.safeParse('UNKNOWN').success).toBe(false)
  })
})

describe('DeliveryRouteShippingAddressSchema (sdd delivery-routes S1b, design §5.1/5.3)', () => {
  it('accepts latitude/longitude as numbers', () => {
    const r = DeliveryRouteShippingAddressSchema.safeParse({
      id: 'a',
      street: 's',
      exteriorNumber: '1',
      interiorNumber: null,
      zipCode: null,
      neighborhood: null,
      municipality: null,
      city: null,
      state: null,
      label: null,
      latitude: 19.4,
      longitude: -99.1,
    })
    expect(r.success).toBe(true)
  })

  it('accepts latitude/longitude as null (legacy omission)', () => {
    const r = DeliveryRouteShippingAddressSchema.safeParse({
      id: 'a',
      street: 's',
      exteriorNumber: '1',
      interiorNumber: null,
      zipCode: null,
      neighborhood: null,
      municipality: null,
      city: null,
      state: null,
      label: null,
      latitude: null,
      longitude: null,
    })
    expect(r.success).toBe(true)
  })

  it('accepts latitude/longitude as undefined (legacy omission)', () => {
    const r = DeliveryRouteShippingAddressSchema.safeParse({
      id: 'a',
      street: 's',
      exteriorNumber: '1',
      interiorNumber: null,
      zipCode: null,
      neighborhood: null,
      municipality: null,
      city: null,
      state: null,
      label: null,
    })
    expect(r.success).toBe(true)
  })
})

describe('CreateDeliveryRouteSchema (sdd delivery-routes S1b, design §5.1)', () => {
  const valid = {
    saleIds: [validUuid],
    driverUserId: validUuid,
  }

  it('accepts a minimal valid payload', () => {
    expect(CreateDeliveryRouteSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional notes within 280 chars', () => {
    expect(CreateDeliveryRouteSchema.safeParse({ ...valid, notes: 'ok' }).success).toBe(true)
  })

  it('rejects empty saleIds (min 1)', () => {
    expect(CreateDeliveryRouteSchema.safeParse({ ...valid, saleIds: [] }).success).toBe(false)
  })

  it('rejects non-UUID saleId', () => {
    expect(
      CreateDeliveryRouteSchema.safeParse({ ...valid, saleIds: ['not-uuid'] }).success,
    ).toBe(false)
  })

  it('rejects notes >280 chars', () => {
    const long = 'x'.repeat(281)
    expect(CreateDeliveryRouteSchema.safeParse({ ...valid, notes: long }).success).toBe(false)
  })

  it('WHITELIST: rejects id/tenantId/timeline/startedAt/completedAt/cancelledAt/createdAt/updatedAt/activeRouteId/status/stops (forbidNonWhitelisted)', () => {
    for (const forbidden of [
      'id',
      'tenantId',
      'timeline',
      'startedAt',
      'completedAt',
      'cancelledAt',
      'createdAt',
      'updatedAt',
      'activeRouteId',
      'status',
      'stops',
      'driver',
    ]) {
      const payload = { ...valid, [forbidden]: 'x' }
      const result = CreateDeliveryRouteSchema.safeParse(payload)
      expect(result.success).toBe(false)
    }
  })
})

describe('UpdateDeliveryRouteSchema (sdd delivery-routes S1b, design §5.1)', () => {
  it('accepts an empty object (no-op PATCH)', () => {
    expect(UpdateDeliveryRouteSchema.safeParse({}).success).toBe(true)
  })

  it('accepts driverUserId only', () => {
    expect(UpdateDeliveryRouteSchema.safeParse({ driverUserId: validUuid }).success).toBe(true)
  })

  it('accepts null notes (clears)', () => {
    expect(UpdateDeliveryRouteSchema.safeParse({ notes: null }).success).toBe(true)
  })

  it('rejects notes >280 chars', () => {
    expect(UpdateDeliveryRouteSchema.safeParse({ notes: 'x'.repeat(281) }).success).toBe(false)
  })

  it('WHITELIST: rejects id/tenantId/timeline/status/stops', () => {
    for (const forbidden of ['id', 'tenantId', 'timeline', 'status', 'stops', 'startedAt']) {
      const result = UpdateDeliveryRouteSchema.safeParse({ [forbidden]: 'x' })
      expect(result.success).toBe(false)
    }
  })
})

describe('AppendDeliveryRouteStopSchema (sdd delivery-routes S1b, design §5.1)', () => {
  it('accepts a valid saleId', () => {
    expect(AppendDeliveryRouteStopSchema.safeParse({ saleId: validUuid }).success).toBe(true)
  })

  it('rejects a non-UUID saleId', () => {
    expect(AppendDeliveryRouteStopSchema.safeParse({ saleId: 'bad' }).success).toBe(false)
  })

  it('WHITELIST: rejects id/sortId/stopId', () => {
    expect(AppendDeliveryRouteStopSchema.safeParse({ saleId: validUuid, id: 'x' }).success).toBe(false)
  })
})

describe('ReorderDeliveryRouteStopsSchema (sdd delivery-routes S1b, design §5.1)', () => {
  it('accepts one or more UUIDs', () => {
    expect(
      ReorderDeliveryRouteStopsSchema.safeParse({ orderedStopIds: [validUuid] }).success,
    ).toBe(true)
    expect(
      ReorderDeliveryRouteStopsSchema.safeParse({
        orderedStopIds: [validUuid, validUuid],
      }).success,
    ).toBe(true)
  })

  it('rejects empty orderedStopIds', () => {
    expect(
      ReorderDeliveryRouteStopsSchema.safeParse({ orderedStopIds: [] }).success,
    ).toBe(false)
  })

  it('rejects non-UUID entries', () => {
    expect(
      ReorderDeliveryRouteStopsSchema.safeParse({ orderedStopIds: ['bad'] }).success,
    ).toBe(false)
  })

  it('WHITELIST: rejects stop sortOrder or any other key', () => {
    expect(
      ReorderDeliveryRouteStopsSchema.safeParse({
        orderedStopIds: [validUuid],
        sortOrder: [0],
      }).success,
    ).toBe(false)
  })
})

describe('Backend sample integration (sdd delivery-routes S1b, design §5.1)', () => {
  it('parses a full route with all 5 timeline event types in mixed order', () => {
    const sample = makeBackendSample()
    sample.timeline = [
      { type: 'ROUTE_CREATED', at: '2024-05-01T08:00:00.000Z', actor: null },
      {
        type: 'STOP_CHECKED_IN',
        at: '2024-05-01T09:30:00.000Z',
        stopId: validUuid,
        sortOrder: 0,
        actor: { id: 'd-1', name: 'Carlos' },
      },
      { type: 'ROUTE_STARTED', at: '2024-05-01T09:00:00.000Z', actor: { id: 'd-1', name: 'Carlos' } },
      { type: 'ROUTE_COMPLETED', at: '2024-05-01T11:00:00.000Z', actor: null },
    ]
    const result = DeliveryRouteResponseSchema.safeParse(sample)
    expect(result.success).toBe(true)
  })

  it('STOP_CHECKED_IN rejects missing stopId', () => {
    const r = DeliveryRouteTimelineEventSchema.safeParse({
      type: 'STOP_CHECKED_IN',
      at: '2024-05-01T10:00:00.000Z',
      sortOrder: 0,
      actor: null,
    })
    expect(r.success).toBe(false)
  })

  it('STOP_CHECKED_IN rejects missing sortOrder', () => {
    const r = DeliveryRouteTimelineEventSchema.safeParse({
      type: 'STOP_CHECKED_IN',
      at: '2024-05-01T10:00:00.000Z',
      stopId: validUuid,
      actor: null,
    })
    expect(r.success).toBe(false)
  })
})

describe('Label + tone maps (sdd delivery-routes S1b, design §5.1)', () => {
  it('DELIVERY_ROUTE_STATUS_LABELS exposes every status', () => {
    expect(DELIVERY_ROUTE_STATUS_LABELS.DRAFT).toBe('Borrador')
    expect(DELIVERY_ROUTE_STATUS_LABELS.ACTIVE).toBe('Activa')
    expect(DELIVERY_ROUTE_STATUS_LABELS.COMPLETED).toBe('Completada')
    expect(DELIVERY_ROUTE_STATUS_LABELS.CANCELLED).toBe('Cancelada')
  })

  it('DELIVERY_ROUTE_STATUS_TONES exposes a tone per status', () => {
    for (const v of ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as DeliveryRouteStatus[]) {
      expect(DELIVERY_ROUTE_STATUS_TONES[v]).toMatch(/^(success|warning|error|neutral)$/)
    }
  })

  it('DELIVERY_ROUTE_STOP_STATUS_LABELS exposes every stop status', () => {
    expect(DELIVERY_ROUTE_STOP_STATUS_LABELS.PENDING).toBe('Pendiente')
    expect(DELIVERY_ROUTE_STOP_STATUS_LABELS.IN_PROGRESS).toBe('En curso')
    expect(DELIVERY_ROUTE_STOP_STATUS_LABELS.COMPLETED).toBe('Entregada')
    expect(DELIVERY_ROUTE_STOP_STATUS_LABELS.SKIPPED).toBe('Omitida')
  })
})