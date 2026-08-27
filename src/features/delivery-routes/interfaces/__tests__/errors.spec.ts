import { describe, it, expect, vi } from 'vitest'
import {
  DELIVERY_ROUTE_ERROR_MAP,
  extractDeliveryRouteErrorCode,
  surfaceDeliveryRouteError,
  type DeliveryRouteDomainErrorCode,
  type DeliveryRouteErrorSurface,
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

describe('surfaceDeliveryRouteError (sdd delivery-routes S5a, design §7.2, REFACTOR of S5a)', () => {
  // The mock collaborators are constructed as plain `vi.fn()` (full
  // `Mock<…>` typing preserved for `.mock.calls` assertions) and the surface
  // wraps them through `as unknown` so vitest's strict contravariant generics
  // do not mismatch the `DeliveryRouteErrorSurface` interface. The runtime
  // contract (callable + `.mock`) is intact.
  function makeSurface(
    overrides: Partial<DeliveryRouteErrorSurface> = {},
  ): DeliveryRouteErrorSurface & {
    addToast: ReturnType<typeof vi.fn>
    setInlineError?: ReturnType<typeof vi.fn>
    setFullPage?: ReturnType<typeof vi.fn>
  } {
    return {
      addToast: vi.fn(),
      setInlineError: vi.fn(),
      setFullPage: vi.fn(),
      ...overrides,
    } as unknown as DeliveryRouteErrorSurface & {
      addToast: ReturnType<typeof vi.fn>
      setInlineError?: ReturnType<typeof vi.fn>
      setFullPage?: ReturnType<typeof vi.fn>
    }
  }

  it('DELIVERY_ROUTE_INVALID_TRANSITION (422) on toast channel → addToast with Spanish copy from map', () => {
    const surface = makeSurface()
    surfaceDeliveryRouteError(
      {
        response: {
          status: 422,
          data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', message: 'x' },
        },
      },
      'toast',
      surface,
    )
    expect(surface.addToast).toHaveBeenCalledTimes(1)
    expect((surface.addToast.mock.calls[0]?.[0] as { title: string }).title).toMatch(
      /estado actual/i,
    )
    expect(surface.setInlineError).not.toHaveBeenCalled()
    expect(surface.setFullPage).not.toHaveBeenCalled()
  })

  it('DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE (422) on inline channel → setInlineError', () => {
    const surface = makeSurface()
    surfaceDeliveryRouteError(
      {
        response: {
          status: 422,
          data: { error: 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE', message: 'x' },
        },
      },
      'inline',
      surface,
    )
    expect(surface.setInlineError).toHaveBeenCalledTimes(1)
    expect((surface.setInlineError!.mock.calls[0]?.[0] as string)).toMatch(/no es elegible/i)
    expect(surface.addToast).not.toHaveBeenCalled()
  })

  it('ENTITY_NOT_FOUND (404) on full-page channel → setFullPage(code)', () => {
    const surface = makeSurface()
    surfaceDeliveryRouteError(
      {
        response: { status: 404, data: { error: 'ENTITY_NOT_FOUND', message: 'x' } },
      },
      'full-page',
      surface,
    )
    expect(surface.setFullPage).toHaveBeenCalledTimes(1)
    expect(surface.setFullPage!.mock.calls[0]?.[0]).toBe('ENTITY_NOT_FOUND')
    expect(surface.addToast).not.toHaveBeenCalled()
  })

  it('falls back to normalizeApiError when the error has no domain code', () => {
    const surface = makeSurface()
    surfaceDeliveryRouteError(
      { response: { status: 500, data: { message: 'boom' } } },
      'toast',
      surface,
    )
    expect(surface.addToast).toHaveBeenCalledTimes(1)
    const toast = surface.addToast.mock.calls[0]?.[0] as {
      title: string
      description?: string
      color: 'success' | 'error' | 'warning'
    }
    expect(toast.color).toBe('error')
    expect(toast.description).toBeTruthy()
  })

  it('falls back to a toast when inline channel is requested but no setInlineError is provided', () => {
    const surface = makeSurface({ setInlineError: undefined })
    surfaceDeliveryRouteError(
      {
        response: {
          status: 422,
          data: { error: 'DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE', message: 'x' },
        },
      },
      'inline',
      surface,
    )
    expect(surface.addToast).toHaveBeenCalledTimes(1)
  })

  it('never throws when the error is null/undefined', () => {
    const surface = makeSurface()
    expect(() => surfaceDeliveryRouteError(undefined, 'toast', surface)).not.toThrow()
    expect(surface.addToast).toHaveBeenCalledTimes(1)
  })
})