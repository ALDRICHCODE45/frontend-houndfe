import { describe, it, expect } from 'vitest'
import {
  extractPaymentMethodErrorCode,
  PAYMENT_METHOD_ERROR_MAP,
  type PaymentMethodDomainErrorCode,
} from '../errors'

describe('extractPaymentMethodErrorCode (sdd custom-payment-methods S1, REQ-PM-007)', () => {
  it('returns DUPLICATE_NAME when error.response.data.error is "DUPLICATE_NAME"', () => {
    const err = {
      response: {
        data: {
          error: 'DUPLICATE_NAME',
        },
      },
    }
    const code = extractPaymentMethodErrorCode(err)
    expect(code).toBe<PaymentMethodDomainErrorCode>('DUPLICATE_NAME')
  })

  it('returns ENTITY_NOT_FOUND when error.response.data.error is "ENTITY_NOT_FOUND"', () => {
    const err = { response: { data: { error: 'ENTITY_NOT_FOUND' } } }
    expect(extractPaymentMethodErrorCode(err)).toBe('ENTITY_NOT_FOUND')
  })

  it('returns NAME_TOO_LONG for the server-side fallback (REQ-PM-007)', () => {
    const err = { response: { data: { error: 'NAME_TOO_LONG' } } }
    expect(extractPaymentMethodErrorCode(err)).toBe('NAME_TOO_LONG')
  })

  it('returns null when only error.message is set (REQ-PM-007 — read "error" field, not "message")', () => {
    const err = { message: 'Some string in message field' }
    expect(extractPaymentMethodErrorCode(err)).toBeNull()
  })

  it('returns null when response.data.error is missing', () => {
    const err = { response: { data: {} } }
    expect(extractPaymentMethodErrorCode(err)).toBeNull()
  })

  it('returns null when error is undefined / null / primitive', () => {
    expect(extractPaymentMethodErrorCode(null)).toBeNull()
    expect(extractPaymentMethodErrorCode(undefined)).toBeNull()
    expect(extractPaymentMethodErrorCode('boom')).toBeNull()
    expect(extractPaymentMethodErrorCode(42)).toBeNull()
  })

  it('returns null for an unknown code (e.g. "INTERNAL_SERVER_ERROR")', () => {
    const err = { response: { data: { error: 'INTERNAL_SERVER_ERROR' } } }
    expect(extractPaymentMethodErrorCode(err)).toBeNull()
  })

  it('ignores error.message array (string[]) — only the "error" string matters', () => {
    const err = {
      message: ['name should not be empty', 'name must be a string'],
      response: { data: { error: 'VALIDATION_FAILED' } }, // not in map
    }
    expect(extractPaymentMethodErrorCode(err)).toBeNull()
  })

  it('handles axios-style nested objects without throwing', () => {
    const err = { response: { data: { error: 'DUPLICATE_NAME', message: 'duplicate' } } }
    expect(extractPaymentMethodErrorCode(err)).toBe('DUPLICATE_NAME')
  })

  it('PAYMENT_METHOD_ERROR_MAP maps every known code to a Spanish copy (REQ-PM-007)', () => {
    expect(PAYMENT_METHOD_ERROR_MAP.DUPLICATE_NAME).toBeTruthy()
    expect(PAYMENT_METHOD_ERROR_MAP.ENTITY_NOT_FOUND).toBeTruthy()
    expect(PAYMENT_METHOD_ERROR_MAP.NAME_TOO_LONG).toBeTruthy()
    // No empty entries.
    for (const code of Object.keys(PAYMENT_METHOD_ERROR_MAP)) {
      expect(PAYMENT_METHOD_ERROR_MAP[code as PaymentMethodDomainErrorCode]).not.toBe('')
    }
  })
})