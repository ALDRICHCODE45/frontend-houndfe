/**
 * customers-bulk-actions T1 (handoff 33): every documented failure of the two bulk routes as a
 * Spanish sentence plus what the screen can do next. The server message is never shown.
 */
import { describe, expect, it } from 'vitest'
import { customerBulkFailure } from '../customerBulkErrors'

const httpError = (status: number, data: unknown) => ({ response: { status, data } })

describe('customerBulkFailure', () => {
  it('404 BULK_CUSTOMERS_NOT_FOUND names how many customers no longer exist and keeps their ids', () => {
    const failure = customerBulkFailure(
      httpError(404, { code: 'BULK_CUSTOMERS_NOT_FOUND', message: '2 customers not found', details: { missingIds: ['a', 'b'] } }),
      'csv',
    )
    expect(failure).toMatchObject({
      code: 'BULK_CUSTOMERS_NOT_FOUND',
      message: '2 clientes de la selección ya no existen.',
      missingIds: ['a', 'b'],
      canRetry: false,
    })
    expect(
      customerBulkFailure(httpError(404, { code: 'BULK_CUSTOMERS_NOT_FOUND', details: { missingIds: ['a'] } }), 'csv')
        .message,
    ).toBe('1 cliente de la selección ya no existe.')
  })

  it('400 BULK_SELECTION_TOO_LARGE explains the cap and asks for a refetch', () => {
    const failure = customerBulkFailure(
      httpError(400, { code: 'BULK_SELECTION_TOO_LARGE', details: { count: 63, max: 50 } }),
      'statements',
    )
    expect(failure).toMatchObject({
      code: 'BULK_SELECTION_TOO_LARGE',
      message: 'La selección tiene 63 clientes y el máximo es 50 por descarga. Quita algunos e intenta de nuevo.',
      refetch: true,
      canRetry: false,
    })
  })

  it('400 BULK_SELECTION_EMPTY explains and asks for a refetch', () => {
    expect(customerBulkFailure(httpError(400, { code: 'BULK_SELECTION_EMPTY' }), 'statements')).toMatchObject({
      code: 'BULK_SELECTION_EMPTY',
      message: 'La selección ya no tiene clientes. Actualizamos la lista.',
      refetch: true,
    })
  })

  it('429 BULK_EXPORT_BUSY reads retryAfterSeconds from the body', () => {
    expect(
      customerBulkFailure(httpError(429, { code: 'BULK_EXPORT_BUSY', details: { retryAfterSeconds: 10 } }), 'statements'),
    ).toMatchObject({ code: 'BULK_EXPORT_BUSY', retryAfterSeconds: 10, canRetry: true })
    // Without the detail it still waits a little.
    expect(customerBulkFailure(httpError(429, { code: 'BULK_EXPORT_BUSY' }), 'statements').retryAfterSeconds).toBe(10)
  })

  it('503 BULK_EXPORT_TIMEOUT asks for fewer customers', () => {
    expect(customerBulkFailure(httpError(503, { code: 'BULK_EXPORT_TIMEOUT' }), 'statements')).toMatchObject({
      message: 'La descarga tardó demasiado; prueba con menos clientes.',
      canRetry: false,
    })
  })

  it('500 PDF_GENERATION_FAILED offers a retry, whether the code is in `code`, `error` or `message`', () => {
    for (const data of [{ code: 'PDF_GENERATION_FAILED' }, { error: 'PDF_GENERATION_FAILED' }, { message: 'PDF_GENERATION_FAILED', error: 'Internal Server Error' }]) {
      expect(customerBulkFailure(httpError(500, data), 'statements')).toMatchObject({
        code: 'PDF_GENERATION_FAILED',
        message: 'No se pudieron generar los estados de cuenta. Intenta de nuevo.',
        canRetry: true,
      })
    }
  })

  it('LISTING_* reuses the listing copy and asks for a refetch', () => {
    const failure = customerBulkFailure(
      httpError(400, { code: 'LISTING_PARAM_REQUIRES_PERMISSION', field: 'sortBy' }),
      'csv',
    )
    expect(failure).toMatchObject({
      code: 'LISTING_PARAM_REQUIRES_PERMISSION',
      message: 'Tu rol no puede ver las ventas, así que no puede ordenar por montos ni compras.',
      canRetry: false,
    })
  })

  it('403 says which permission is missing', () => {
    expect(customerBulkFailure(httpError(403, { error: 'INSUFFICIENT_PERMISSIONS' }), 'csv').message).toBe(
      'No tienes permiso para exportar clientes.',
    )
    expect(customerBulkFailure(httpError(403, { error: 'INSUFFICIENT_PERMISSIONS' }), 'statements').message).toBe(
      'No tienes permiso para descargar estados de cuenta.',
    )
  })

  it('another 400 on statements is the period; a network error offers a retry', () => {
    expect(customerBulkFailure(httpError(400, { error: 'Bad Request', message: ['from'] }), 'statements').message).toBe(
      'Revisa el periodo: debe ser de 1 a 366 días.',
    )
    expect(customerBulkFailure(new Error('Network Error'), 'csv')).toMatchObject({
      code: 'UNKNOWN',
      message: 'No se pudo completar la descarga. Intenta de nuevo.',
      canRetry: true,
    })
  })
})
