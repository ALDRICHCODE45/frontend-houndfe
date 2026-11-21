import { describe, expect, it } from 'vitest'
import {
  CUSTOMER_HAS_ACTIVE_BACKORDERS_MESSAGE,
  isCustomerHasActiveBackordersError,
} from '../customerDeleteError'

// ODD restock-backorder S10 / backend L11: DELETE /customers/:id → 409 CUSTOMER_HAS_ACTIVE_BACKORDERS
// with body {statusCode, error, message, timestamp}.
const http = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })

describe('isCustomerHasActiveBackordersError', () => {
  it('matches the 409 with the code in `error`', () => {
    expect(
      isCustomerHasActiveBackordersError(
        http(409, {
          statusCode: 409,
          error: 'CUSTOMER_HAS_ACTIVE_BACKORDERS',
          message: 'Customer has active backorders',
          timestamp: '2026-11-20T18:00:00.000Z',
        }),
      ),
    ).toBe(true)
  })

  it('matches the 409 with the code in `code`', () => {
    expect(isCustomerHasActiveBackordersError(http(409, { code: 'CUSTOMER_HAS_ACTIVE_BACKORDERS' }))).toBe(true)
  })

  it('does not match another 409 code, another status or a non-HTTP error', () => {
    expect(isCustomerHasActiveBackordersError(http(409, { error: 'Conflict', message: 'x' }))).toBe(false)
    expect(isCustomerHasActiveBackordersError(http(409, { error: 'VERSION_CONFLICT' }))).toBe(false)
    expect(isCustomerHasActiveBackordersError(http(500, { error: 'CUSTOMER_HAS_ACTIVE_BACKORDERS' }))).toBe(false)
    expect(isCustomerHasActiveBackordersError(http(404, {}))).toBe(false)
    expect(isCustomerHasActiveBackordersError(new Error('Network Error'))).toBe(false)
    expect(isCustomerHasActiveBackordersError(null)).toBe(false)
  })
})

describe('CUSTOMER_HAS_ACTIVE_BACKORDERS_MESSAGE', () => {
  it('tells what to do in Spanish', () => {
    expect(CUSTOMER_HAS_ACTIVE_BACKORDERS_MESSAGE).toBe(
      'No se puede eliminar: este cliente tiene un pedido por reposición en espera o apartado. Cancélalo primero en Pedidos por reposición.',
    )
  })
})
