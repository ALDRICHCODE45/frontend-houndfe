import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import type { SaleHold } from '../../interfaces/sale.types'
import {
  decodeSaleHoldError,
  formatSaleHoldExpiry,
  isSaleHoldLive,
  saleHoldErrorMessage,
  saleHoldErrorNeedsReload,
  saleHoldLine,
  SALE_HOLD_ERROR_CODES,
  canExpireSaleHold,
  decodeSaleHoldExpireError,
  saleHoldExpireDescription,
  saleHoldExpireErrorMessage,
  saleHoldExpireKeepsAttempt,
  saleHoldExpireNeedsReload,
  saleHoldExpireOutcomeTitle,
  saleHoldExpiredLine,
  SALE_HOLD_EXPIRE_ERROR_CODES,
} from '../saleHold.utils'

// BE handoff 24 §1 display rule and §2 errors.
const hold: SaleHold = {
  paymentIntent: 'IN_STORE',
  expiresAt: '2026-11-19T18:30:00.000Z',
  reminderAt: '2026-11-19T15:30:00.000Z',
  stage: 0,
  version: 1,
}
const NOW = new Date('2026-11-18T12:00:00.000Z')
const live = { hold, status: 'CONFIRMED', paymentStatus: 'CREDIT' } as const

describe('formatSaleHoldExpiry', () => {
  it('renders the contract example in the sucursal zone (Mexico City by default; 19 nov 2026 is a Thursday, «vie» in the contract is a typo)', () => {
    expect(formatSaleHoldExpiry('2026-11-19T18:30:00.000Z', { now: NOW })).toBe('jue 19 nov, 12:30')
  })

  it('pads the hour and adds the year only when it is not the current one', () => {
    expect(formatSaleHoldExpiry('2027-01-04T15:05:00.000Z', { now: NOW })).toBe('lun 4 ene 2027, 09:05')
  })

  it('honours an explicit time zone', () => {
    expect(formatSaleHoldExpiry('2026-11-19T18:30:00.000Z', { now: NOW, timeZone: 'UTC' })).toBe('jue 19 nov, 18:30')
  })

  it('returns null for an invalid date', () => {
    expect(formatSaleHoldExpiry('nope', { now: NOW })).toBeNull()
  })
})

describe('isSaleHoldLive / saleHoldLine', () => {
  it('shows «Apartado · pagar en tienda · vence {fecha}» for a confirmed unpaid hold', () => {
    expect(isSaleHoldLive(live)).toBe(true)
    expect(saleHoldLine(live, { now: NOW })).toBe('Apartado · pagar en tienda · vence jue 19 nov, 12:30')
  })

  it('says «Apartado vencido · revisar» when the sweep handed it to staff (stage 2, still CREDIT); it stays editable', () => {
    const expired = { ...live, hold: { ...hold, stage: 2 as const, reminderAt: null } }
    expect(isSaleHoldLive(expired)).toBe(true)
    expect(saleHoldLine(expired, { now: NOW })).toBe('Apartado vencido · revisar')
  })

  it('says «Apartado vencido · revisar» for an expired hold with a partial payment (stage 2, PARTIAL)', () => {
    const partial = { ...live, paymentStatus: 'PARTIAL' as const, hold: { ...hold, stage: 2 as const } }
    expect(saleHoldLine(partial, { now: NOW })).toBe('Apartado vencido · revisar')
  })

  it.each([
    ['no hold', { ...live, hold: null }],
    ['an older payload without the key', { status: 'CONFIRMED', paymentStatus: 'CREDIT' }],
    ['a partial payment', { ...live, paymentStatus: 'PARTIAL' }],
    ['a paid sale', { ...live, paymentStatus: 'PAID' }],
    ['a cancelled sale', { ...live, status: 'CANCELED' }],
    ['a null payment status', { ...live, paymentStatus: null }],
  ] as const)('hides it with %s', (_, sale) => {
    expect(isSaleHoldLive(sale)).toBe(false)
    expect(saleHoldLine(sale, { now: NOW })).toBeNull()
  })
})

function httpError(status: number | null, data?: unknown): AxiosError {
  const error = new AxiosError('fail', status === null ? 'ERR_NETWORK' : 'ERR_BAD_RESPONSE')
  if (status !== null) {
    error.response = { status, data, statusText: '', headers: {}, config: { headers: new AxiosHeaders() } }
  }
  return error
}

describe('decodeSaleHoldError', () => {
  it.each([
    [409, 'HOLD_VERSION_CONFLICT'],
    [422, 'HOLD_EXPIRY_NOT_FUTURE'],
    [409, 'SALE_NOT_PAY_IN_STORE'],
    [409, 'SALE_HOLD_NOT_EDITABLE'],
    [404, 'SALE_NOT_FOUND'],
  ] as const)('%i %s', (status, code) => {
    expect(decodeSaleHoldError(httpError(status, { statusCode: status, error: code, message: 'x' }))).toBe(code)
  })

  it('403 is FORBIDDEN', () => {
    expect(decodeSaleHoldError(httpError(403, { statusCode: 403, message: 'Forbidden resource' }))).toBe('FORBIDDEN')
  })

  it('400 is VALIDATION', () => {
    expect(decodeSaleHoldError(httpError(400, { statusCode: 400, error: 'Bad Request', message: ['expiresAt'] }))).toBe(
      'VALIDATION',
    )
  })

  it('no response and 5xx are NETWORK', () => {
    expect(decodeSaleHoldError(httpError(null))).toBe('NETWORK')
    expect(decodeSaleHoldError(httpError(503, {}))).toBe('NETWORK')
  })

  it('an unknown code or a non-HTTP error is UNKNOWN', () => {
    expect(decodeSaleHoldError(httpError(409, { error: 'SOMETHING_NEW' }))).toBe('UNKNOWN')
    expect(decodeSaleHoldError(new TypeError('bug'))).toBe('UNKNOWN')
    expect(decodeSaleHoldError(undefined)).toBe('UNKNOWN')
  })

  it('has Spanish copy for every code and reloads only when the sale changed under us', () => {
    for (const code of SALE_HOLD_ERROR_CODES) expect(saleHoldErrorMessage(code)).toMatch(/\S/)
    expect(saleHoldErrorMessage('HOLD_EXPIRY_NOT_FUTURE')).toBe('Elige una fecha y hora en el futuro.')
    expect(SALE_HOLD_ERROR_CODES.filter(saleHoldErrorNeedsReload)).toEqual([
      'HOLD_VERSION_CONFLICT',
      'SALE_NOT_PAY_IN_STORE',
      'SALE_HOLD_NOT_EDITABLE',
      'SALE_NOT_FOUND',
    ])
  })
})

// hold-expire-now L5 / BE handoff 24 §6: «Vencer apartado ahora».
describe('canExpireSaleHold', () => {
  it('is true for a pay-in-store hold, CONFIRMED, stage < 2 and not fully paid', () => {
    expect(canExpireSaleHold(live)).toBe(true)
    expect(canExpireSaleHold({ ...live, hold: { ...hold, stage: 1 } })).toBe(true)
    expect(canExpireSaleHold({ ...live, paymentStatus: 'PARTIAL' })).toBe(true)
  })

  it.each([
    ['no hold', { ...live, hold: null }],
    ['hold absent', { status: 'CONFIRMED', paymentStatus: 'CREDIT' }],
    ['another intent', { ...live, hold: { ...hold, paymentIntent: 'OTHER' as 'IN_STORE' } }],
    ['cancelled', { ...live, status: 'CANCELED' }],
    ['draft', { ...live, status: 'DRAFT' }],
    ['stage 2', { ...live, hold: { ...hold, stage: 2 } }],
    ['fully paid', { ...live, paymentStatus: 'PAID' }],
    ['no payment status', { ...live, paymentStatus: null }],
  ] as const)('is false when %s', (_label, sale) => {
    expect(canExpireSaleHold(sale as Parameters<typeof canExpireSaleHold>[0])).toBe(false)
  })
})

describe('saleHoldExpireDescription', () => {
  it('unpaid: the sale is cancelled and the customer is told', () => {
    expect(saleHoldExpireDescription(live)).toBe(
      'La venta se cancela como plazo vencido y el cliente recibe el aviso.',
    )
  })

  it('with a payment: the hold expires and the sale waits for review', () => {
    expect(saleHoldExpireDescription({ ...live, paymentStatus: 'PARTIAL' })).toBe(
      'El apartado vence y la venta queda para revisar; no se cancela porque tiene un pago registrado.',
    )
  })
})

describe('saleHoldExpireOutcomeTitle', () => {
  it.each([
    ['CANCELLED', 'Apartado vencido: la venta se canceló.'],
    ['REVIEW', 'Apartado vencido: la venta quedó para revisar.'],
    ['SETTLED', 'La venta ya estaba pagada; el apartado se cerró.'],
    [null, 'Apartado vencido. Actualizamos la venta.'],
  ] as const)('%s → %s', (outcome, title) => {
    expect(saleHoldExpireOutcomeTitle(outcome)).toBe(title)
  })
})

describe('saleHoldExpiredLine', () => {
  it('«Venció el {fecha}» in the sucursal zone when the expiry cancelled the sale', () => {
    expect(saleHoldExpiredLine({ ...hold, stage: 2, expiredAt: '2026-11-19T18:30:00.000Z' }, { now: NOW })).toBe(
      'Venció el jue 19 nov, 12:30',
    )
  })

  it('is null without expiredAt or hold', () => {
    expect(saleHoldExpiredLine(hold)).toBeNull()
    expect(saleHoldExpiredLine({ ...hold, expiredAt: null })).toBeNull()
    expect(saleHoldExpiredLine(null)).toBeNull()
    expect(saleHoldExpiredLine({ ...hold, expiredAt: 'nope' })).toBeNull()
  })
})

describe('decodeSaleHoldExpireError', () => {
  it.each([
    [409, 'HOLD_VERSION_CONFLICT'],
    [409, 'HOLD_ALREADY_CLOSED'],
    [409, 'SALE_NOT_PAY_IN_STORE'],
    [409, 'SALE_HOLD_NOT_EDITABLE'],
    [404, 'SALE_NOT_FOUND'],
    [409, 'IDEMPOTENCY_KEY_CONFLICT'],
    [409, 'IDEMPOTENCY_KEY_IN_FLIGHT'],
  ] as const)('%i %s', (status, code) => {
    expect(decodeSaleHoldExpireError(httpError(status, { statusCode: status, error: code, message: 'x' }))).toBe(code)
  })

  it('400 with message IDEMPOTENCY_KEY_REQUIRED (Nest Bad Request body)', () => {
    expect(
      decodeSaleHoldExpireError(
        httpError(400, { statusCode: 400, error: 'Bad Request', message: 'IDEMPOTENCY_KEY_REQUIRED' }),
      ),
    ).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('403 FORBIDDEN, other 400 VALIDATION, 5xx/no response NETWORK, else UNKNOWN', () => {
    expect(decodeSaleHoldExpireError(httpError(403, { statusCode: 403 }))).toBe('FORBIDDEN')
    expect(decodeSaleHoldExpireError(httpError(400, { error: 'Bad Request', message: ['expectedVersion'] }))).toBe(
      'VALIDATION',
    )
    expect(decodeSaleHoldExpireError(httpError(null))).toBe('NETWORK')
    expect(decodeSaleHoldExpireError(httpError(502, {}))).toBe('NETWORK')
    expect(decodeSaleHoldExpireError(httpError(409, { error: 'HOLD_EXPIRY_NOT_FUTURE' }))).toBe('UNKNOWN')
    expect(decodeSaleHoldExpireError(new Error('bug'))).toBe('UNKNOWN')
  })

  it('has Spanish copy for every code', () => {
    for (const code of SALE_HOLD_EXPIRE_ERROR_CODES) expect(saleHoldExpireErrorMessage(code)).toMatch(/\S/)
    expect(saleHoldExpireErrorMessage('HOLD_VERSION_CONFLICT')).toBe(
      'Alguien cambió el plazo del apartado. Actualizamos la venta; revisa y vuelve a intentar.',
    )
    expect(saleHoldExpireErrorMessage('HOLD_ALREADY_CLOSED')).toBe(
      'El apartado ya estaba vencido o cerrado. Actualizamos la venta.',
    )
    expect(saleHoldExpireErrorMessage('IDEMPOTENCY_KEY_REQUIRED')).toBe(
      'No pudimos enviar la solicitud. Intenta de nuevo.',
    )
    expect(saleHoldExpireErrorMessage('IDEMPOTENCY_KEY_CONFLICT')).toBe(
      'Esa solicitud ya se usó con otros datos. Vuelve a intentarlo.',
    )
  })

  it('reloads when the sale changed under us; keeps the attempt key only when the result is uncertain', () => {
    expect(SALE_HOLD_EXPIRE_ERROR_CODES.filter(saleHoldExpireNeedsReload)).toEqual([
      'HOLD_VERSION_CONFLICT',
      'HOLD_ALREADY_CLOSED',
      'SALE_NOT_PAY_IN_STORE',
      'SALE_HOLD_NOT_EDITABLE',
      'SALE_NOT_FOUND',
    ])
    expect(SALE_HOLD_EXPIRE_ERROR_CODES.filter(saleHoldExpireKeepsAttempt)).toEqual([
      'IDEMPOTENCY_KEY_IN_FLIGHT',
      'NETWORK',
      'UNKNOWN',
    ])
  })
})
