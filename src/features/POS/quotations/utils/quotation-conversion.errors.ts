import { isAxiosError } from 'axios'
import { ZodError } from 'zod'
import { parseUnavailableLines } from '../interfaces/quotation-conversion.schema'
import type { QuotationConversionFailure } from '../interfaces/quotation.types'

/**
 * Decodes a rejection of `quotationApi.createFromSale` or `quotationApi.convertToSale`
 * (backend handoff 23 «Errors»). Switches on the envelope's `error`; `saleId` and `lines` sit at
 * the top level of the body; `IDEMPOTENCY_KEY_REQUIRED` arrives in `message`. Copy is the UI's job.
 */

type PlainCode = Exclude<
  QuotationConversionFailure['code'],
  | 'QUOTATION_ALREADY_CONVERTED'
  | 'QUOTATION_LINES_UNAVAILABLE'
  | 'SALE_LINES_UNAVAILABLE'
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'NETWORK'
  | 'RESPONSE_INVALID'
  | 'UNKNOWN'
>

const PLAIN_CODES = new Set<string>([
  'QUOTATION_EXPIRED',
  'QUOTATION_CANCELLED',
  'QUOTATION_HAS_NO_ITEMS',
  'ENTITY_NOT_FOUND',
  'SALE_UPDATE_FORBIDDEN',
  'SALE_NOT_FOUND',
  'SALE_NOT_DRAFT',
  'SALE_HAS_NO_ITEMS',
  'SALE_HAS_PAYMENTS',
  'SALE_HAS_STOCK_MOVEMENTS',
  'SALE_NOT_DISCARDABLE',
  'IDEMPOTENCY_KEY_REQUIRED',
  'IDEMPOTENCY_KEY_CONFLICT',
  'IDEMPOTENCY_KEY_IN_FLIGHT',
])

interface ErrorBody {
  error?: unknown
  message?: unknown
  saleId?: unknown
  lines?: unknown
}

function isPlainCode(value: unknown): value is PlainCode {
  return typeof value === 'string' && PLAIN_CODES.has(value)
}

export function decodeQuotationConversionError(error: unknown): QuotationConversionFailure {
  if (error instanceof ZodError) return { code: 'RESPONSE_INVALID' }
  if (!isAxiosError(error) || !error.response) return { code: 'NETWORK' }

  const { status } = error.response
  const raw = error.response.data
  const body: ErrorBody = raw && typeof raw === 'object' ? (raw as ErrorBody) : {}
  const code = body.error

  if (code === 'QUOTATION_ALREADY_CONVERTED') {
    return { code, saleId: typeof body.saleId === 'string' ? body.saleId : null }
  }
  if (code === 'QUOTATION_LINES_UNAVAILABLE' || code === 'SALE_LINES_UNAVAILABLE') {
    return { code, lines: parseUnavailableLines(body.lines) }
  }
  if (isPlainCode(code)) return { code }
  // The idempotency guard puts its code in `message` (400 IDEMPOTENCY_KEY_REQUIRED).
  if (isPlainCode(body.message) && body.message.startsWith('IDEMPOTENCY_KEY_')) {
    return { code: body.message }
  }

  if (status === 403) return { code: 'FORBIDDEN' }
  if (status === 400 && Array.isArray(body.message)) return { code: 'VALIDATION' }
  return {
    code: 'UNKNOWN',
    status,
    error: typeof body.error === 'string' ? body.error : null,
  }
}
