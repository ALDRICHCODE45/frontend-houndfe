import { describe, it, expect } from 'vitest'
import {
  PAYMENT_DETAIL_ERROR_MAP,
  extractPaymentDetailErrorCode,
  type PaymentDetailDomainErrorCode,
} from '../errors'

describe('PAYMENT_DETAIL_ERROR_MAP (sdd payment-details-admin S1, REQ-PD-008)', () => {
  it('DUPLICATE_CLABE maps to the exact user-facing Spanish copy', () => {
    expect(PAYMENT_DETAIL_ERROR_MAP.DUPLICATE_CLABE).toBe(
      'Esta CLABE ya existe en esta sucursal',
    )
  })

  it('ENTITY_NOT_FOUND maps to the exact user-facing Spanish copy', () => {
    expect(PAYMENT_DETAIL_ERROR_MAP.ENTITY_NOT_FOUND).toBe('No encontrado')
  })

  it('NO_ACTIVE_PAYMENT_DETAIL maps to a non-empty Spanish copy', () => {
    expect(PAYMENT_DETAIL_ERROR_MAP.NO_ACTIVE_PAYMENT_DETAIL).toBeTypeOf('string')
    expect(PAYMENT_DETAIL_ERROR_MAP.NO_ACTIVE_PAYMENT_DETAIL.length).toBeGreaterThan(0)
  })

  it('the map covers exactly the three known domain codes', () => {
    const codes = Object.keys(PAYMENT_DETAIL_ERROR_MAP).sort()
    expect(codes).toEqual(
      ['DUPLICATE_CLABE', 'ENTITY_NOT_FOUND', 'NO_ACTIVE_PAYMENT_DETAIL'].sort(),
    )
  })

  it('each value is a non-empty trimmed Spanish string', () => {
    for (const value of Object.values(PAYMENT_DETAIL_ERROR_MAP)) {
      expect(value).toBeTypeOf('string')
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('extractPaymentDetailErrorCode (sdd payment-details-admin S1, REQ-PD-008)', () => {
  it('returns the domain code from response.data.error', () => {
    const axiosLike = {
      response: { data: { error: 'DUPLICATE_CLABE', message: 'Some other message' } },
    }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBe('DUPLICATE_CLABE')
  })

  it('returns ENTITY_NOT_FOUND when that code is present in response.data.error', () => {
    const axiosLike = {
      response: { data: { error: 'ENTITY_NOT_FOUND', message: '404' } },
    }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBe('ENTITY_NOT_FOUND')
  })

  it('returns null when the code lives only in response.data.message (not error)', () => {
    const axiosLike = {
      response: { data: { error: 'Bad Request', message: 'DUPLICATE_CLABE' } },
    }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBeNull()
  })

  it('returns null when the error code is unknown', () => {
    const axiosLike = {
      response: { data: { error: 'SOMETHING_NEW', message: 'Nope' } },
    }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBeNull()
  })

  it('returns null for a null/undefined error', () => {
    expect(extractPaymentDetailErrorCode(null)).toBeNull()
    expect(extractPaymentDetailErrorCode(undefined)).toBeNull()
  })

  it('returns null when response.data.error is missing entirely', () => {
    const axiosLike = { response: { data: { message: 'Network Error' } } }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBeNull()
  })

  it('returns null when response.data.error is not a string', () => {
    const axiosLike = { response: { data: { error: 42 } } }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBeNull()
  })

  it('returns null when response is missing entirely (non-Axios error)', () => {
    const err = new Error('boom')
    expect(extractPaymentDetailErrorCode(err)).toBeNull()
  })

  it('still returns the code when the message diverges from the error field', () => {
    const axiosLike = {
      response: { data: { error: 'DUPLICATE_CLABE', message: 'Generic failure' } },
    }
    expect(extractPaymentDetailErrorCode(axiosLike)).toBe('DUPLICATE_CLABE')
  })

  it('narrows the return type to PaymentDetailDomainErrorCode when non-null', () => {
    const result = extractPaymentDetailErrorCode({
      response: { data: { error: 'ENTITY_NOT_FOUND' } },
    })
    // Type-level only — TS would fail the build if the cast broke.
    const code: PaymentDetailDomainErrorCode | null = result
    expect(code).toBe('ENTITY_NOT_FOUND')
  })
})
