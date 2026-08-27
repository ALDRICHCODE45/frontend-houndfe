import { describe, it, expect } from 'vitest'
import {
  DELIVERY_ROUTE_ERROR_MAP,
  extractDeliveryRouteErrorCode,
  type DeliveryRouteDomainErrorCode,
} from '../errors'

describe('DELIVERY_ROUTE_ERROR_MAP (sdd delivery-routes S1b, design §7.1)', () => {
  it('DELIVERY_ROUTE_INVALID_TRANSITION maps to the exact Spanish copy', () => {
    expect(DELIVERY_ROUTE_ERROR_MAP.DELIVERY_ROUTE_INVALID_TRANSITION).toBe(
      'La ruta no permite esta acción en su estado actual.',
    )
  })

  it('DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE maps to the exact Spanish copy', () => {
    expect(DELIVERY_ROUTE_ERROR_MAP.DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE).toBe(
      'Una de las ventas no es elegible (debe estar pendiente o enviada y tener dirección de envío).',
    )
  })

  it('DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE maps to the exact Spanish copy', () => {
    expect(DELIVERY_ROUTE_ERROR_MAP.DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE).toBe(
      'Una de las ventas ya pertenece a otra ruta activa.',
    )
  })

  it('ENTITY_NOT_FOUND maps to "Ruta no encontrada."', () => {
    expect(DELIVERY_ROUTE_ERROR_MAP.ENTITY_NOT_FOUND).toBe('Ruta no encontrada.')
  })

  it('covers exactly the four known domain codes', () => {
    expect(Object.keys(DELIVERY_ROUTE_ERROR_MAP).sort()).toEqual(
      [
        'DELIVERY_ROUTE_INVALID_TRANSITION',
        'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
        'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE',
        'ENTITY_NOT_FOUND',
      ].sort(),
    )
  })

  it('each value is a non-empty trimmed Spanish string', () => {
    for (const value of Object.values(DELIVERY_ROUTE_ERROR_MAP)) {
      expect(typeof value).toBe('string')
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('extractDeliveryRouteErrorCode (sdd delivery-routes S1b, design §7.1)', () => {
  it('returns the code from response.data.error', () => {
    const err = {
      response: { data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'other' } },
    }
    expect(extractDeliveryRouteErrorCode(err)).toBe('DELIVERY_ROUTE_INVALID_TRANSITION')
  })

  it('returns ENTITY_NOT_FOUND when present in response.data.error', () => {
    const err = { response: { data: { error: 'ENTITY_NOT_FOUND', message: '404' } } }
    expect(extractDeliveryRouteErrorCode(err)).toBe('ENTITY_NOT_FOUND')
  })

  it('returns the 409 conflict code from response.data.error', () => {
    const err = {
      response: { data: { error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE' } },
    }
    expect(extractDeliveryRouteErrorCode(err)).toBe(
      'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE',
    )
  })

  it('returns null when the code lives only in .message (NOT .error)', () => {
    const err = {
      response: { data: { error: 'Bad Request', message: 'DELIVERY_ROUTE_INVALID_TRANSITION' } },
    }
    expect(extractDeliveryRouteErrorCode(err)).toBeNull()
  })

  it('returns null when the code is unknown', () => {
    const err = { response: { data: { error: 'SOMETHING_NEW', message: 'Nope' } } }
    expect(extractDeliveryRouteErrorCode(err)).toBeNull()
  })

  it('returns null for null/undefined errors', () => {
    expect(extractDeliveryRouteErrorCode(null)).toBeNull()
    expect(extractDeliveryRouteErrorCode(undefined)).toBeNull()
  })

  it('returns null when response.data.error is missing entirely', () => {
    const err = { response: { data: { message: 'Network Error' } } }
    expect(extractDeliveryRouteErrorCode(err)).toBeNull()
  })

  it('returns null when response.data.error is not a string', () => {
    const err = { response: { data: { error: 42 } } }
    expect(extractDeliveryRouteErrorCode(err)).toBeNull()
  })

  it('returns null when response is missing entirely (non-Axios error)', () => {
    const err = new Error('boom')
    expect(extractDeliveryRouteErrorCode(err)).toBeNull()
  })

  it('still returns the code when .message diverges from .error', () => {
    const err = {
      response: { data: { error: 'ENTITY_NOT_FOUND', message: 'Generic failure' } },
    }
    expect(extractDeliveryRouteErrorCode(err)).toBe('ENTITY_NOT_FOUND')
  })

  it('narrows the return type to DeliveryRouteDomainErrorCode when non-null', () => {
    const result = extractDeliveryRouteErrorCode({
      response: { data: { error: 'ENTITY_NOT_FOUND' } },
    })
    const code: DeliveryRouteDomainErrorCode | null = result
    expect(code).toBe('ENTITY_NOT_FOUND')
  })
})