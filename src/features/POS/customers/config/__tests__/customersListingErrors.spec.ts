import { describe, expect, it } from 'vitest'
import {
  customersListingError,
  readCustomersListingError,
} from '../customersListingErrors'

// Handoff 32 §2.7: the listing codes use { statusCode, code, message, field, details? } — switch on code.
function axiosError(body: unknown) {
  return { isAxiosError: true, response: { status: 400, data: body } }
}

describe('readCustomersListingError', () => {
  it('reads the listing envelope from an axios error', () => {
    expect(
      readCustomersListingError(
        axiosError({ statusCode: 400, code: 'LISTING_INVERTED_RANGE', message: 'x', field: 'openDebt' }),
      ),
    ).toEqual({ code: 'LISTING_INVERTED_RANGE', field: 'openDebt', details: undefined })
  })

  it('returns null for anything else (network, Nest validation body, plain errors)', () => {
    expect(readCustomersListingError(new Error('Network Error'))).toBeNull()
    expect(readCustomersListingError(axiosError({ statusCode: 400, message: ['x'], error: 'Bad Request' }))).toBeNull()
    expect(readCustomersListingError(null)).toBeNull()
  })
})

describe('customersListingError', () => {
  it.each([
    ['LISTING_INVALID_NUMBER', 'openDebtMin', undefined, 'openDebt', 'Monto de deuda: escribe un número entero, de 0 en adelante.'],
    ['LISTING_INVERTED_RANGE', 'totalSold', undefined, 'totalSold', 'Total comprado: el inicio del rango es mayor que el final.'],
    ['LISTING_INVALID_DATE', 'lastPurchaseFrom', undefined, 'lastPurchase', 'Última compra: la fecha no es válida.'],
    ['LISTING_INVALID_ENUM_VALUE', 'petSize', undefined, 'petSize', 'Tamaño de mascota: uno de los valores no es válido.'],
    ['LISTING_TOO_MANY_VALUES', 'neighborhood', { cap: 200 }, 'neighborhood', 'Colonia: elige 200 valores o menos.'],
    ['LISTING_INVALID_UUID', 'priceListId', undefined, 'priceListId', 'Lista de precios: una de las listas no es válida.'],
    ['LISTING_PARAM_REQUIRES_PERMISSION', 'hasDebt', { required: 'read:Sale' }, 'hasDebt', 'Tu rol no puede ver las ventas, así que no puede usar «Con deuda».'],
  ])('%s on %s → a Spanish sentence on its filter', (code, field, details, filterId, message) => {
    expect(customersListingError(axiosError({ statusCode: 400, code, message: 'raw', field, details }))).toEqual({
      code,
      filterId,
      message,
    })
  })

  it('sends a sort without permission to no filter', () => {
    expect(
      customersListingError(axiosError({ statusCode: 400, code: 'LISTING_PARAM_REQUIRES_PERMISSION', field: 'sortBy' })),
    ).toEqual({
      code: 'LISTING_PARAM_REQUIRES_PERMISSION',
      filterId: null,
      message: 'Tu rol no puede ver las ventas, así que no puede ordenar por montos ni compras.',
    })
  })

  it('never shows the server message, and returns null for unknown codes', () => {
    const mapped = customersListingError(
      axiosError({ statusCode: 400, code: 'LISTING_INVALID_NUMBER', message: 'openDebtMin must be…', field: 'openDebtMin' }),
    )
    expect(mapped?.message).not.toContain('must be')
    expect(customersListingError(axiosError({ statusCode: 400, code: 'SOMETHING_ELSE', field: 'x' }))).toBeNull()
  })
})
