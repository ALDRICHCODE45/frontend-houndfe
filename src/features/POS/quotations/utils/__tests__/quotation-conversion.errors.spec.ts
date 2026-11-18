import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import { decodeQuotationConversionError } from '../quotation-conversion.errors'

// Backend handoff 23 «Errors» tables: switch on `error`; extra keys (`saleId`, `lines`) sit at
// the top level; IDEMPOTENCY_KEY_REQUIRED comes in `message`.

function httpError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('fail', 'ERR', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  })
}

const envelope = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  httpError(status, { statusCode: status, error, message: error, timestamp: 'now', ...extra })

const unavailableLine = {
  lineId: 'qi-1',
  productId: 'p-1',
  variantId: null,
  productName: 'Playera',
  variantName: null,
  reason: 'INSUFFICIENT_STOCK',
  requestedQuantity: 2,
  availableQuantity: 1,
}

describe('decodeQuotationConversionError — quotation → sale', () => {
  it.each([
    [422, 'QUOTATION_EXPIRED'],
    [422, 'QUOTATION_CANCELLED'],
    [422, 'QUOTATION_HAS_NO_ITEMS'],
    [404, 'ENTITY_NOT_FOUND'],
  ] as const)('%i %s → { code: %s }', (status, code) => {
    expect(decodeQuotationConversionError(envelope(status, code))).toEqual({ code })
  })

  it('QUOTATION_ALREADY_CONVERTED carries saleId', () => {
    expect(
      decodeQuotationConversionError(envelope(422, 'QUOTATION_ALREADY_CONVERTED', { saleId: 's-7' })),
    ).toEqual({ code: 'QUOTATION_ALREADY_CONVERTED', saleId: 's-7' })
  })

  it('QUOTATION_ALREADY_CONVERTED without a saleId reads null', () => {
    expect(decodeQuotationConversionError(envelope(422, 'QUOTATION_ALREADY_CONVERTED'))).toEqual({
      code: 'QUOTATION_ALREADY_CONVERTED',
      saleId: null,
    })
  })

  it('QUOTATION_LINES_UNAVAILABLE carries every line with its reason', () => {
    const lines = [
      unavailableLine,
      { ...unavailableLine, lineId: 'qi-2', reason: 'PRODUCT_NOT_FOUND', availableQuantity: null },
      { ...unavailableLine, lineId: 'qi-3', reason: 'VARIANT_NOT_FOUND', availableQuantity: null },
      { ...unavailableLine, lineId: 'qi-4', reason: 'PRODUCT_NOT_SELLABLE', availableQuantity: null },
    ]
    expect(
      decodeQuotationConversionError(envelope(422, 'QUOTATION_LINES_UNAVAILABLE', { lines })),
    ).toEqual({ code: 'QUOTATION_LINES_UNAVAILABLE', lines })
  })

  it('an unknown line reason reads UNKNOWN and a missing lines array reads []', () => {
    const decoded = decodeQuotationConversionError(
      envelope(422, 'QUOTATION_LINES_UNAVAILABLE', { lines: [{ ...unavailableLine, reason: 'NEW' }] }),
    )
    expect(decoded).toMatchObject({ lines: [{ lineId: 'qi-1', reason: 'UNKNOWN' }] })
    expect(decodeQuotationConversionError(envelope(422, 'QUOTATION_LINES_UNAVAILABLE'))).toEqual({
      code: 'QUOTATION_LINES_UNAVAILABLE',
      lines: [],
    })
  })
})

describe('decodeQuotationConversionError — sale → quotation', () => {
  it.each([
    [403, 'SALE_UPDATE_FORBIDDEN'],
    [404, 'SALE_NOT_FOUND'],
    [409, 'SALE_NOT_DRAFT'],
    [422, 'SALE_HAS_NO_ITEMS'],
    [422, 'SALE_HAS_PAYMENTS'],
    [422, 'SALE_HAS_STOCK_MOVEMENTS'],
    [422, 'SALE_NOT_DISCARDABLE'],
  ] as const)('%i %s → { code: %s }', (status, code) => {
    expect(decodeQuotationConversionError(envelope(status, code))).toEqual({ code })
  })

  it('SALE_LINES_UNAVAILABLE carries the lines', () => {
    expect(
      decodeQuotationConversionError(envelope(422, 'SALE_LINES_UNAVAILABLE', { lines: [unavailableLine] })),
    ).toEqual({ code: 'SALE_LINES_UNAVAILABLE', lines: [unavailableLine] })
  })
})

describe('decodeQuotationConversionError — common', () => {
  it('IDEMPOTENCY_KEY_REQUIRED is read from message on a 400', () => {
    expect(
      decodeQuotationConversionError(
        httpError(400, { statusCode: 400, error: 'Bad Request', message: 'IDEMPOTENCY_KEY_REQUIRED' }),
      ),
    ).toEqual({ code: 'IDEMPOTENCY_KEY_REQUIRED' })
  })

  it.each(['IDEMPOTENCY_KEY_CONFLICT', 'IDEMPOTENCY_KEY_IN_FLIGHT'] as const)('409 %s', (code) => {
    expect(decodeQuotationConversionError(envelope(409, code))).toEqual({ code })
  })

  it('a 400 validation error (customerNotes > 280) reads VALIDATION', () => {
    expect(
      decodeQuotationConversionError(
        httpError(400, {
          statusCode: 400,
          error: 'Bad Request',
          message: ['customerNotes must be shorter than or equal to 280 characters'],
        }),
      ),
    ).toEqual({ code: 'VALIDATION' })
  })

  it('a 403 without a domain code reads FORBIDDEN (missing permission)', () => {
    expect(
      decodeQuotationConversionError(httpError(403, { statusCode: 403, message: 'Forbidden resource' })),
    ).toEqual({ code: 'FORBIDDEN' })
  })

  it('no response reads NETWORK', () => {
    expect(decodeQuotationConversionError(new Error('offline'))).toEqual({ code: 'NETWORK' })
    const config = { headers: new AxiosHeaders() }
    expect(decodeQuotationConversionError(new AxiosError('timeout', 'ECONNABORTED', config))).toEqual({
      code: 'NETWORK',
    })
  })

  it('a ZodError (2xx body that broke the contract) reads RESPONSE_INVALID', () => {
    expect(decodeQuotationConversionError(new ZodError([]))).toEqual({ code: 'RESPONSE_INVALID' })
  })

  it('anything else reads UNKNOWN with status and raw code', () => {
    expect(decodeQuotationConversionError(envelope(422, 'SOMETHING_NEW'))).toEqual({
      code: 'UNKNOWN',
      status: 422,
      error: 'SOMETHING_NEW',
    })
    expect(decodeQuotationConversionError(httpError(500, 'boom'))).toEqual({
      code: 'UNKNOWN',
      status: 500,
      error: null,
    })
  })
})
