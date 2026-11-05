import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { ZodError } from 'zod'
import { mapSettlementError } from '../settlementErrors'

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, {
    status,
    statusText: '',
    data,
    headers: {},
    config,
  })
}

// Captured bodies from odd/handoff/06-refund-settlements.md §6.
const domain = (statusCode: number, error: string, message = error) => ({
  statusCode,
  error,
  message,
  timestamp: '2026-11-05T16:26:26.046Z',
})

describe('mapSettlementError', () => {
  it.each([
    [422, 'SETTLEMENT_EXCEEDS_REFUND', 'El monto es mayor que lo pendiente. Actualizamos el saldo; revisa el monto.'],
    [409, 'REFUND_ALREADY_SETTLED', 'Este reembolso ya se completó.'],
    [404, 'REFUND_NOT_FOUND', 'No encontramos este reembolso. Actualizamos la lista.'],
    [409, 'IDEMPOTENCY_KEY_IN_FLIGHT', 'Estamos registrando la devolución, espera un momento.'],
    [409, 'IDEMPOTENCY_KEY_CONFLICT', 'Los datos cambiaron desde el último intento. Vuelve a confirmar.'],
    [422, 'CASH_SESSION_CREDIT_NOT_ALLOWED', 'Una devolución a crédito no se registra en caja.'],
    [422, 'CASH_SESSION_NOT_WRITABLE', 'La caja ya está cerrada. Registra la devolución sin caja o abre una nueva.'],
    [422, 'CASH_SESSION_NOT_OWNED', 'Esta caja pertenece a otro cajero.'],
    [422, 'CASH_SESSION_NOT_FOUND', 'No encontramos tu caja. Registra la devolución sin caja.'],
    [422, 'CASH_ACTOR_INACTIVE', 'No puedes registrar movimientos en esta caja. Registra la devolución sin caja.'],
    [422, 'CASH_TENANT_MEMBERSHIP_REQUIRED', 'No puedes registrar movimientos en esta caja. Registra la devolución sin caja.'],
    [403, 'INSUFFICIENT_PERMISSIONS', 'No tienes permiso para registrar devoluciones.'],
  ])('%i %s → copy', (status, code, message) => {
    const info = mapSettlementError(httpError(status, domain(status, code)))
    expect(info).toMatchObject({ code, message })
  })

  it('places the raw validation array on the fields', () => {
    const info = mapSettlementError(
      httpError(400, {
        message: [
          { property: 'amountCents', children: [], constraints: { min: 'amountCents must not be less than 1' } },
          {
            property: 'settledAt',
            children: [],
            constraints: { matches: 'settledAt must match /(?:Z|[+-]\\d{2}:\\d{2})$/ regular expression' },
          },
          { property: 'note', constraints: { whitelistValidation: 'property note should not exist' } },
        ],
        error: 'Bad Request',
        statusCode: 400,
      }),
    )
    expect(info.code).toBe('VALIDATION')
    expect(info.fieldErrors).toEqual({
      amount: 'Escribe un monto válido mayor que $0.00.',
      settledAt: 'Elige una fecha y hora válidas.',
    })
    expect(info.message).toBe('Revisa los datos marcados e intenta de nuevo.')
  })

  it('never shows a server string for a 400 that is a FE bug', () => {
    for (const message of ['IDEMPOTENCY_KEY_REQUIRED', 'Validation failed (cuid is expected)']) {
      const info = mapSettlementError(httpError(400, { message, error: 'Bad Request', statusCode: 400 }))
      expect(info.code).toBe('UNEXPECTED')
      expect(info.message).toBe('No pudimos registrar la devolución. Recarga la página e intenta de nuevo.')
    }
  })

  it('reads a 401 and network failures as retryable without server text', () => {
    expect(mapSettlementError(new AxiosError('Network Error', 'ERR_NETWORK')).message).toBe(
      'No pudimos registrar la devolución. Revisa tu conexión e intenta de nuevo.',
    )
    expect(mapSettlementError(httpError(500, { message: 'Internal server error' })).message).toBe(
      'No pudimos registrar la devolución. Revisa tu conexión e intenta de nuevo.',
    )
  })

  it('treats an unreadable success body as recorded-but-unread', () => {
    const info = mapSettlementError(new ZodError([]))
    expect(info.code).toBe('RESPONSE_INVALID')
    expect(info.message).toBe('Registramos la devolución, pero no pudimos leer la respuesta. Revisa la lista.')
  })
})
