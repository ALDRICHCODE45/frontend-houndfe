// sellerReportPresentation.spec.ts — display contract for the seller report.
//
// Mutation-sensitive: formatting an instant in the browser/UTC zone instead of
// America/Mexico_City, parsing a calendar date through `Date`, re-implementing
// MXN formatting locally, mislabeling a payment status, or leaking a raw backend
// error code (`SELLER_NOT_FOUND`) into user copy fails at least one test.

import { describe, expect, it } from 'vitest'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { SellerReportFailure } from '../../interfaces/seller-report.types'
import {
  SELLER_REPORT_FAILURE_MESSAGES,
  SELLER_REPORT_PAYMENT_STATUS_LABELS,
  SELLER_REPORT_PAYMENT_STATUS_TONES,
  SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE,
  SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE,
  SELLER_REPORT_TIME_ZONE_LABEL,
  formatSellerReportCalendarDate,
  formatSellerReportCents,
  formatSellerReportCount,
  formatSellerReportInstant,
  sellerReportFailureMessage,
} from '../sellerReportPresentation'

function failure(overrides: Partial<SellerReportFailure> = {}): SellerReportFailure {
  return { kind: 'unknown', status: null, rowLimit: null, rowCount: null, ...overrides }
}

describe('formatSellerReportInstant — Mexico City zone', () => {
  it('renders a UTC instant in America/Mexico_City, not in the browser zone', () => {
    // 18:30 UTC is 12:30 in Mexico City (UTC-6): a UTC render would print 18:30.
    expect(formatSellerReportInstant('2025-03-05T18:30:00.000Z')).toBe('05/03/2025, 12:30')
  })

  it('shifts the calendar day when the instant crosses midnight in Mexico City', () => {
    // 05:30 UTC is 23:30 of the PREVIOUS local day.
    expect(formatSellerReportInstant('2025-04-01T05:30:00.000Z')).toBe('31/03/2025, 23:30')
  })

  it('is stable across repeated calls with the same instant', () => {
    const instant = '2025-03-05T18:30:00.000Z'
    expect(formatSellerReportInstant(instant)).toBe(formatSellerReportInstant(instant))
  })
})

describe('formatSellerReportCalendarDate — backend calendar day', () => {
  it('renders the backend day verbatim without a zone shift', () => {
    expect(formatSellerReportCalendarDate('2025-03-01')).toBe('01/03/2025')
    expect(formatSellerReportCalendarDate('2025-03-31')).toBe('31/03/2025')
  })

  it('returns the raw value when it is not a calendar date', () => {
    expect(formatSellerReportCalendarDate('not-a-date')).toBe('not-a-date')
  })
})

describe('money and count formatting', () => {
  it('formats integer cents as MXN through the shared formatter', () => {
    expect(formatSellerReportCents(116_000)).toBe(formatCentsMXN(116_000))
    expect(formatSellerReportCents(116_000)).toBe('$1,160.00')
    expect(formatSellerReportCents(0)).toBe('$0.00')
  })

  it('groups counts without inventing decimals', () => {
    expect(formatSellerReportCount(1000)).toBe('1,000')
    expect(formatSellerReportCount(0)).toBe('0')
  })
})

describe('payment status presentation', () => {
  it('labels every authoritative status in Spanish', () => {
    expect(SELLER_REPORT_PAYMENT_STATUS_LABELS).toEqual({
      PAID: 'Pagada',
      PARTIAL: 'Parcial',
      CREDIT: 'A crédito',
    })
  })

  it('maps every status to a distinct existing badge tone', () => {
    expect(SELLER_REPORT_PAYMENT_STATUS_TONES).toEqual({
      PAID: 'success',
      PARTIAL: 'warning',
      CREDIT: 'info',
    })
  })
})

describe('sellerReportFailureMessage', () => {
  it('explains a missing seller without exposing the backend code', () => {
    const message = sellerReportFailureMessage(failure({ kind: 'seller-not-found', status: 404 }))
    expect(message).toContain('vendedor')
    expect(message).not.toContain('SELLER_NOT_FOUND')
    expect(message).not.toContain('404')
  })

  it('explains the row cap with the reported limit and count', () => {
    const message = sellerReportFailureMessage(
      failure({ kind: 'row-limit-exceeded', status: 422, rowLimit: 1000, rowCount: 1500 }),
    )
    expect(message).toContain('1,000')
    expect(message).toContain('1,500')
    expect(message).not.toContain('SELLER_REPORT_ROW_LIMIT_EXCEEDED')
  })

  it('explains the row cap without a count when the body omitted it', () => {
    const message = sellerReportFailureMessage(
      failure({ kind: 'row-limit-exceeded', status: 422, rowLimit: 1000 }),
    )
    expect(message).toContain('1,000')
    expect(message).not.toContain('null')
    expect(message).not.toContain('undefined')
  })

  it('gives every failure kind its own copy and never leaks an error code', () => {
    const kinds = [
      'seller-not-found',
      'row-limit-exceeded',
      'forbidden',
      'unauthorized',
      'invalid-request',
      'unknown',
    ] as const

    const messages = kinds.map((kind) => sellerReportFailureMessage(failure({ kind })))
    messages.forEach((message) => {
      expect(message.length).toBeGreaterThan(20)
      expect(message).not.toMatch(/[A-Z_]{6,}/)
    })
    expect(new Set(messages).size).toBe(kinds.length)
    expect(Object.keys(SELLER_REPORT_FAILURE_MESSAGES).sort()).toEqual([...kinds].sort())
  })

  it('keeps print-specific copy distinct from the load copy', () => {
    expect(SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE).not.toBe(
      SELLER_REPORT_FAILURE_MESSAGES.unknown,
    )
    expect(SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE).not.toBe(
      SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE,
    )
    expect(SELLER_REPORT_PRINT_REFRESH_FAILURE_MESSAGE).toContain('actualiz')
    expect(SELLER_REPORT_PRINT_DIALOG_FAILURE_MESSAGE).toContain('impresión')
  })

  it('names the authoritative zone in Spanish', () => {
    expect(SELLER_REPORT_TIME_ZONE_LABEL).toBe('Hora del centro de México (America/Mexico_City)')
  })
})
