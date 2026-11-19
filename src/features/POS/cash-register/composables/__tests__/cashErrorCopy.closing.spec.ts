/**
 * Close + listing error copy (handoff 25 §5 table, rows 1–17 in check order, plus
 * the defensive codes and the list/recipient filters). Every message is es-MX,
 * says what is missing and who has to do it, never surfaces the raw backend
 * message and never ends in «Reintenta.».
 */
import { describe, expect, it } from 'vitest'
import { cashCloseErrorInfo, cashErrorInfo, CASH_CLOSE_GENERIC_ERROR } from '../cashErrorCopy'
import { cashError } from '../../closing/__tests__/closingFixtures'

const RETRY_TEXT = /Reintenta\.|Reintenta (?:el|para)\b/

function close(code: string, details: Record<string, unknown> = {}, status = 422) {
  return cashCloseErrorInfo(cashError(code, details, status))
}

describe('cashCloseErrorInfo — §5 rows in check order', () => {
  const rows: Array<[string, number, Record<string, unknown>, RegExp]> = [
    ['Unauthorized', 401, {}, /sesión.*Inicia sesión/i],
    ['INSUFFICIENT_PERMISSIONS', 403, {}, /permiso.*«Cerrar caja».*administrador/i],
    ['Bad Request', 400, {}, /nota de cierre.*2000/i],
    ['INVALID_IDEMPOTENCY_KEY', 400, {}, /intento de cierre/i],
    ['CASH_IDEMPOTENCY_CONFLICT', 422, { key: 'k' }, /intento de cierre ya se usó/i],
    ['CASH_ACTOR_INACTIVE', 422, { userId: 'u' }, /usuario está inactivo.*administrador/i],
    ['CASH_TENANT_MEMBERSHIP_REQUIRED', 422, { userId: 'u', tenantId: 't' }, /sucursal.*administrador/i],
    ['CASH_SESSION_NOT_FOUND', 422, { sessionId: 's' }, /no existe en esta sucursal/i],
    ['CASH_PERMISSION_DENIED', 422, { action: 'create', subject: 'CashClosing', userId: 'u' }, /permiso.*«Cerrar caja»/i],
    ['CASH_SELF_CLOSING_FORBIDDEN', 422, { cashierUserId: 'c' }, /abriste.*otra persona/i],
    ['CASH_DRAWER_NOT_RELEASED', 422, { sessionId: 's' }, /^Falta liberar el cajón: la persona que abrió la caja debe liberarlo antes del cierre\.$/],
    ['CASH_VERIFICATION_REQUIRED', 422, { sessionId: 's' }, /^Falta la verificación: otra persona.*antes del cierre\.$/],
    ['CASH_CUSTODY_NOT_RECEIVED', 422, { handoverId: 'h' }, /^Falta recibir una entrega.*«Por recibir».*antes del cierre\.$/],
  ]

  it.each(rows)('%s (%i) names what is missing and who does it', (code, status, details, copy) => {
    const info = close(code, details, status)
    expect(info.code).toBe(code)
    expect(info.message).toMatch(copy)
    expect(info.message).not.toContain('raw backend message')
    expect(info.message).not.toMatch(RETRY_TEXT)
  })

  it('CASH_SESSION_NOT_WRITABLE depends on the reported status', () => {
    expect(close('CASH_SESSION_NOT_WRITABLE', { status: 'CLOSED' }).message).toMatch(
      /ya está cerrada.*«Cortes»/,
    )
    expect(close('CASH_SESSION_NOT_WRITABLE', { status: 'OPEN' }).message).toMatch(
      /^Falta la declaración: la persona que abrió la caja debe contar y enviar/,
    )
    expect(close('CASH_SESSION_NOT_WRITABLE', { status: 'COUNTING' }).message).toMatch(
      /^Falta la declaración/,
    )
    // Defensive variant (no status) → generic inconsistency copy.
    expect(close('CASH_SESSION_NOT_WRITABLE', { sessionId: 's' }).message).toMatch(
      /dato inconsistente/,
    )
  })

  it('CASH_DISCREPANCY_NOTES_REQUIRED tells which note and who writes it', () => {
    expect(close('CASH_DISCREPANCY_NOTES_REQUIRED', { stage: 'DECLARATION' }).message).toMatch(
      /^Falta explicar la diferencia: la persona que abrió la caja debe agregar una nota a su declaración antes del cierre\.$/,
    )
    expect(close('CASH_DISCREPANCY_NOTES_REQUIRED', { stage: 'VERIFICATION' }).message).toMatch(
      /quien verificó/,
    )
  })

  it('CASH_HANDOVER_ALLOCATION_MISMATCH shows both amounts in pesos', () => {
    const info = close('CASH_HANDOVER_ALLOCATION_MISMATCH', {
      declaredCents: 149500,
      allocatedCents: 100000,
    })
    expect(info.message).toMatch(/\$1,000\.00/)
    expect(info.message).toMatch(/\$1,495\.00/)
    expect(info.message).toMatch(/declarar las entregas que faltan antes del cierre/)
  })

  it.each([
    'CASH_DECLARATION_NOT_FOUND',
    'CASH_COUNT_MISSING_CHANNEL',
    'CASH_HANDOVER_DUPLICATE_ALLOCATION',
    'CASH_CENTS_OUT_OF_RANGE',
    'CASH_ARITHMETIC_OVERFLOW',
    'CASH_SNAPSHOT_SESSION_NOT_CLOSED',
    'CASH_FOLIO_REQUIRED',
    'CASH_IDENTITY_REQUIRED',
    'CASH_DATE_INVALID',
    'CASH_IDEMPOTENCY_KEY_REQUIRED',
    'CASH_IDEMPOTENCY_KEY_TOO_LONG',
  ])('defensive %s maps to the generic inconsistency copy', (code) => {
    expect(close(code).message).toMatch(/dato inconsistente/)
  })

  it('an unknown code or a network failure never shows the raw message', () => {
    expect(close('SOMETHING_NEW').message).toBe(CASH_CLOSE_GENERIC_ERROR)
    expect(cashCloseErrorInfo(new Error('Network Error')).message).toBe(CASH_CLOSE_GENERIC_ERROR)
  })
})

describe('cashErrorInfo — listing, closings and recipients', () => {
  it.each([
    ['LISTING_INVALID_ENUM_VALUE', 400, /filtros no es válido/],
    ['CASH_CLOSING_NOT_FOUND', 422, /corte no existe/],
    ['CASH_CLOSING_SNAPSHOT_INVALID', 500, /corte guardado está dañado/],
    ['CASH_QUERY_RANGE_INVALID', 422, /fecha final/],
    ['CASH_QUERY_DATE_INVALID', 422, /fecha/],
    ['CASH_QUERY_INVALID_PAGE', 422, /página/],
    ['INSUFFICIENT_PERMISSIONS', 403, /No tienes permiso/],
    ['CASH_ACTOR_INACTIVE', 422, /inactivo/],
    ['CASH_TENANT_MEMBERSHIP_REQUIRED', 422, /sucursal/],
  ])('%s has Spanish copy', (code, status, copy) => {
    const info = cashErrorInfo(cashError(code, {}, status))
    expect(info.message).toMatch(copy)
    expect(info.message).not.toContain('raw backend message')
    expect(info.message).not.toMatch(RETRY_TEXT)
  })

  it('keeps the existing copy of the codes other flows already use', () => {
    expect(cashErrorInfo(cashError('CASH_DRAWER_NOT_RELEASED')).message).toBe(
      'Primero libera el cajón físico.',
    )
  })
})
