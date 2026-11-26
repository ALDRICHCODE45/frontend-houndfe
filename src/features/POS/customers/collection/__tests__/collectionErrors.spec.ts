/**
 * «Cobrar todo» T1 (S3; handoff 30 §8): switch on `error`, except IDEMPOTENCY_KEY_REQUIRED and
 * INVALID_FORMAT whose code is in `message`; CASH_SESSION_NOT_OWNED is a 422; the English
 * `message` of a CASH_* code is never shown.
 */
import { describe, expect, it } from 'vitest'
import { readCollectionError } from '../collectionErrors'

const httpError = (status: number, data: unknown) => ({
  isAxiosError: true,
  response: { status, data },
})

describe('readCollectionError', () => {
  it.each([
    ['COLLECTION_EXCEEDS_DEBT', 422, 'El pago supera la deuda'],
    ['COLLECTION_NO_OPEN_DEBT', 422, 'ya no tiene deuda'],
    ['COLLECTION_SALE_NOT_ELIGIBLE', 422, 'ya no se puede cobrar'],
    ['COLLECTION_DEBT_CHANGED', 409, 'La deuda del cliente cambió'],
    ['CUSTOMER_NOT_FOUND', 404, 'El cliente ya no existe'],
    ['PAYMENT_METHOD_NOT_FOUND', 404, 'método de pago ya no existe'],
    ['INACTIVE_PAYMENT_METHOD', 409, 'está desactivado'],
    ['PAYMENT_METHOD_CATEGORY_MISMATCH', 400, 'no coincide'],
    ['CASH_SESSION_REQUIRED', 422, 'Elige la caja abierta'],
    ['CASH_SESSION_NOT_FOUND', 422, 'ya no existe'],
    ['CASH_SESSION_NOT_OWNED', 422, 'es de otro cajero'],
    ['CASH_SESSION_NOT_WRITABLE', 422, 'cerrada o congelada'],
    ['CASH_ACTOR_INACTIVE', 422, 'inactivo'],
    ['CASH_TENANT_MEMBERSHIP_REQUIRED', 422, 'No perteneces a esta sucursal'],
    ['IDEMPOTENCY_KEY_IN_FLIGHT', 409, 'se sigue procesando'],
    ['IDEMPOTENCY_KEY_CONFLICT', 409, 'No se pudo confirmar el cobro'],
    ['COLLECTION_NOT_FOUND', 404, 'El cobro ya no existe'],
    ['PDF_GENERATION_FAILED', 500, 'No se pudo generar el comprobante'],
  ])('%s → Spanish copy', (code, status, copy) => {
    const failure = readCollectionError(
      httpError(status, { statusCode: status, error: code, message: code }),
    )
    expect(failure.code).toBe(code)
    expect(failure.status).toBe(status)
    expect(failure.message).toContain(copy)
  })

  it('never shows the English message of a CASH_* code', () => {
    const failure = readCollectionError(
      httpError(422, {
        error: 'CASH_SESSION_NOT_OWNED',
        message: 'Cash session belongs to another cashier',
        sessionId: 's-1',
      }),
    )
    expect(failure.code).toBe('CASH_SESSION_NOT_OWNED')
    expect(failure.message).not.toMatch(/cashier|Cash/)
  })

  it('reads IDEMPOTENCY_KEY_REQUIRED from message (error is "Bad Request")', () => {
    const failure = readCollectionError(
      httpError(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'IDEMPOTENCY_KEY_REQUIRED',
      }),
    )
    expect(failure.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(failure.message).toContain('No se pudo confirmar el cobro')
  })

  it('reads INVALID_FORMAT from message', () => {
    const failure = readCollectionError(
      httpError(400, { error: 'Bad Request', message: 'INVALID_FORMAT' }),
    )
    expect(failure.code).toBe('INVALID_FORMAT')
    expect(failure.message).toContain('Formato de comprobante')
  })

  it('maps a Nest validation body to a generic Spanish message', () => {
    const failure = readCollectionError(
      httpError(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: ['payments must contain no more than 5 elements'],
      }),
    )
    expect(failure.code).toBe('VALIDATION')
    expect(failure.message).toBe('Revisa los montos y las referencias de los pagos.')
  })

  it('maps 403 to a permission message', () => {
    expect(readCollectionError(httpError(403, { message: 'Forbidden resource' })).message).toBe(
      'No tienes permiso para cobrar ventas.',
    )
  })

  it('a missing response is a network failure', () => {
    const failure = readCollectionError({ isAxiosError: true, message: 'Network Error' })
    expect(failure.network).toBe(true)
    expect(failure.message).toContain('conexión')
  })

  it('an unknown code falls back without leaking its message', () => {
    const failure = readCollectionError(
      httpError(422, { error: 'SOMETHING_NEW', message: 'Raw english' }),
    )
    expect(failure.message).toBe('No se pudo completar el cobro. Intenta de nuevo.')
  })

  it('carries the preview of a 409 COLLECTION_DEBT_CHANGED', () => {
    const preview = { debtCents: 110000 }
    const failure = readCollectionError(
      httpError(409, { error: 'COLLECTION_DEBT_CHANGED', preview }),
    )
    expect(failure.preview).toEqual(preview)
  })
})
