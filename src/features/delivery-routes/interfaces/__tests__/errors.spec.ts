import { describe, it, expect, vi } from 'vitest'
import {
  DELIVERY_ROUTE_ERROR_MAP,
  DELIVERY_ROUTE_TRANSFER_REASON_MAP,
  DELIVERY_ROUTE_TRANSFER_FORBIDDEN_MESSAGE,
  DELIVERY_ROUTE_TRANSFER_DESTINATIONS_FORBIDDEN_MESSAGE,
  extractDeliveryRouteErrorCode,
  extractDeliveryRouteTransferReason,
  resolveTransferErrorMessage,
  resolveTransferDestinationsErrorMessage,
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

// ─── T3 S2/S4 — draft-to-draft transfer error mapping ────────────────────────
// The 422 reason is a FLAT `reason` string on response.data (NOT the error code,
// NOT nested under details). The 409 conflict carries the flat code and a
// possibly-empty `conflictSaleIds`. 403 INSUFFICIENT_PERMISSIONS must surface a
// meaningful permission message while the dialog stays actionable.

describe('DELIVERY_ROUTE_TRANSFER_REASON_MAP (T3 S2/S4)', () => {
  it('covers exactly the four backend transfer reasons', () => {
    expect(Object.keys(DELIVERY_ROUTE_TRANSFER_REASON_MAP).sort()).toEqual(
      ['DESTINATION_ALREADY_HAS_SALE', 'NOT_DRAFT', 'SAME_ROUTE_TRANSFER', 'UNKNOWN_STOP_ID'].sort(),
    )
  })

  it('each value is a non-empty trimmed Spanish string', () => {
    for (const value of Object.values(DELIVERY_ROUTE_TRANSFER_REASON_MAP)) {
      expect(typeof value).toBe('string')
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('describes the source/destination sameness and draft-only rules', () => {
    expect(DELIVERY_ROUTE_TRANSFER_REASON_MAP.SAME_ROUTE_TRANSFER).toMatch(/diferente|distinta/i)
    expect(DELIVERY_ROUTE_TRANSFER_REASON_MAP.NOT_DRAFT).toMatch(/borrador/i)
  })
})

describe('extractDeliveryRouteTransferReason (flat `reason`, NOT the error code)', () => {
  it('reads the flat reason when the error code is DELIVERY_ROUTE_INVALID_TRANSITION', () => {
    const err = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', reason: 'SAME_ROUTE_TRANSFER' },
      },
    }
    expect(extractDeliveryRouteTransferReason(err)).toBe('SAME_ROUTE_TRANSFER')
    // The reason is NOT the error code.
    expect(extractDeliveryRouteErrorCode(err)).toBe('DELIVERY_ROUTE_INVALID_TRANSITION')
  })

  it.each(['NOT_DRAFT', 'UNKNOWN_STOP_ID', 'DESTINATION_ALREADY_HAS_SALE'] as const)(
    'returns %s when present flat',
    (reason) => {
      expect(
        extractDeliveryRouteTransferReason({ response: { data: { reason, error: 'x' } } }),
      ).toBe(reason)
    },
  )

  it('returns null when the reason is nested under details (flat contract)', () => {
    const err = {
      response: {
        status: 422,
        data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', details: { reason: 'NOT_DRAFT' } },
      },
    }
    expect(extractDeliveryRouteTransferReason(err)).toBeNull()
  })

  it('returns null for an unknown reason / missing reason / malformed input', () => {
    expect(
      extractDeliveryRouteTransferReason({ response: { data: { reason: 'SOMETHING' } } }),
    ).toBeNull()
    expect(extractDeliveryRouteTransferReason({ response: { data: {} } })).toBeNull()
    expect(extractDeliveryRouteTransferReason({ response: { data: { reason: 42 } } })).toBeNull()
    expect(extractDeliveryRouteTransferReason(null)).toBeNull()
    expect(extractDeliveryRouteTransferReason(undefined)).toBeNull()
  })
})

describe('resolveTransferErrorMessage (T3 S2/S4)', () => {
  it('maps each 422 reason to its Spanish copy', () => {
    const reasons = Object.keys(DELIVERY_ROUTE_TRANSFER_REASON_MAP) as Array<
      keyof typeof DELIVERY_ROUTE_TRANSFER_REASON_MAP
    >
    for (const reason of reasons) {
      const msg = resolveTransferErrorMessage({
        response: { status: 422, data: { error: 'DELIVERY_ROUTE_INVALID_TRANSITION', reason } },
      })
      expect(msg).toBe(DELIVERY_ROUTE_TRANSFER_REASON_MAP[reason])
    }
  })

  it('maps a 403 to the permission message (dialog stays actionable)', () => {
    const msg = resolveTransferErrorMessage({
      response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS', message: 'no' } },
    })
    expect(msg).toBe(DELIVERY_ROUTE_TRANSFER_FORBIDDEN_MESSAGE)
  })

  it('maps a 409 active-route conflict to the existing domain copy', () => {
    const msg = resolveTransferErrorMessage({
      response: {
        status: 409,
        data: { error: 'DELIVERY_ROUTE_STOP_SALE_ALREADY_ON_ACTIVE_ROUTE', conflictSaleIds: [] },
      },
    })
    expect(msg).toMatch(/otra ruta activa/i)
  })

  it('maps ENTITY_NOT_FOUND to "Ruta no encontrada."', () => {
    expect(
      resolveTransferErrorMessage({
        response: { status: 404, data: { error: 'ENTITY_NOT_FOUND' } },
      }),
    ).toBe(DELIVERY_ROUTE_ERROR_MAP.ENTITY_NOT_FOUND)
  })

  it('falls back to normalizeApiError for a generic 500', () => {
    const msg = resolveTransferErrorMessage({ response: { status: 500, data: { message: 'boom' } } })
    expect(msg.trim().length).toBeGreaterThan(0)
    expect(msg).not.toBe('')
  })

  it('never throws for null/undefined', () => {
    expect(() => resolveTransferErrorMessage(undefined)).not.toThrow()
    expect(resolveTransferErrorMessage(undefined).trim().length).toBeGreaterThan(0)
  })
})

describe('resolveTransferDestinationsErrorMessage (list 403 stays graceful)', () => {
  it('maps a 403 list failure to the destinations permission message', () => {
    expect(
      resolveTransferDestinationsErrorMessage({
        response: { status: 403, data: { error: 'INSUFFICIENT_PERMISSIONS' } },
      }),
    ).toBe(DELIVERY_ROUTE_TRANSFER_DESTINATIONS_FORBIDDEN_MESSAGE)
  })

  it('falls back for a generic list failure', () => {
    const msg = resolveTransferDestinationsErrorMessage({
      response: { status: 500, data: { message: 'boom' } },
    })
    expect(msg.trim().length).toBeGreaterThan(0)
  })
})