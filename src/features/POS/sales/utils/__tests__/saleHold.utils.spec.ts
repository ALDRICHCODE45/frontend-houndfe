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

  it('still shows a hold the sweep handed to staff (stage 2, still CREDIT): it stays editable', () => {
    expect(saleHoldLine({ ...live, hold: { ...hold, stage: 2, reminderAt: null } }, { now: NOW })).toBe(
      'Apartado · pagar en tienda · vence jue 19 nov, 12:30',
    )
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
