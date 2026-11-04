/**
 * O1 S7 — product stock error codes map to human copy by the envelope's
 * `error` code, never by the server message.
 */

import { describe, expect, it } from 'vitest'
import { hasStockOnHand, productStockError } from '../productStockErrors'

const rejected = (error: unknown, message = 'Some English server message') => ({
  response: { data: { statusCode: 409, error, message } },
})

describe('productStockError', () => {
  it.each([
    ['STOCK_QUANTITY_READ_ONLY', 'quantity', 'El stock no se edita aquí. Ajústalo desde Inventario.'],
    [
      'STOCK_TRACKING_HAS_STOCK',
      'useStock',
      'Hay existencias. Ajusta el stock a 0 antes de desactivar «Usar stock».',
    ],
    [
      'LOT_HAS_STOCK',
      'lots',
      'El lote aún tiene existencias. Ajústalas a 0 antes de eliminarlo.',
    ],
    [
      'PRODUCT_TYPE_CHANGE_BLOCKED',
      'type',
      'El producto tiene existencias o lotes. Ajusta el stock a 0 antes de cambiar el tipo.',
    ],
  ])('%s → field %s with human copy', (code, field, message) => {
    expect(productStockError(rejected(code))).toEqual({ code, field, message })
  })

  it('switches on the code, not the message', () => {
    const result = productStockError(rejected('LOT_HAS_STOCK', 'totally different words'))
    expect(result?.message).toBe('El lote aún tiene existencias. Ajústalas a 0 antes de eliminarlo.')
    expect(productStockError(rejected('SOMETHING_ELSE', 'LOT_HAS_STOCK'))).toBeNull()
  })

  it('returns null for unknown codes, network errors and garbage', () => {
    expect(productStockError(rejected('SAT_KEY_NOT_FOUND'))).toBeNull()
    expect(productStockError(new Error('offline'))).toBeNull()
    expect(productStockError({ response: {} })).toBeNull()
    expect(productStockError(undefined)).toBeNull()
  })
})

describe('hasStockOnHand', () => {
  it('is true with product stock or variant stock', () => {
    expect(hasStockOnHand({ quantity: 3, variantStockTotal: null })).toBe(true)
    expect(hasStockOnHand({ quantity: 0, variantStockTotal: 5 })).toBe(true)
  })

  it('is false at zero, with no product or with a missing total', () => {
    expect(hasStockOnHand({ quantity: 0, variantStockTotal: null })).toBe(false)
    expect(hasStockOnHand({ quantity: 0, variantStockTotal: 0 })).toBe(false)
    expect(hasStockOnHand(null)).toBe(false)
    expect(hasStockOnHand(undefined)).toBe(false)
  })
})
