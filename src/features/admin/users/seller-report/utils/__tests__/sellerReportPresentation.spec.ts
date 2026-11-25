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
  SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE,
  SELLER_REPORT_FAILURE_MESSAGES,
  SELLER_REPORT_PAYMENT_STATUS_LABELS,
  SELLER_REPORT_PAYMENT_STATUS_TONES,
  SELLER_REPORT_TIME_ZONE_LABEL,
  formatSellerReportCalendarDate,
  formatSellerReportCents,
  formatSellerReportCount,
  formatSellerReportInstant,
  formatSellerReportPeriod,
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
      PARTIAL: 'Impaga',
      CREDIT: 'Deuda',
    })
  })

  it('maps every status to a distinct existing badge tone', () => {
    expect(SELLER_REPORT_PAYMENT_STATUS_TONES).toEqual({
      PAID: 'success',
      PARTIAL: 'warning',
      CREDIT: 'error',
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
      'pdf-generation-failed',
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

  it('explains a PDF-generation failure without exposing the backend code', () => {
    const message = sellerReportFailureMessage(
      failure({ kind: 'pdf-generation-failed', status: 500 }),
    )
    expect(message).toContain('PDF')
    expect(message).not.toContain('PDF_GENERATION_FAILED')
    expect(message).not.toContain('500')
  })

  it('keeps the generic download copy distinct from every domain failure copy', () => {
    expect(SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE).not.toBe(SELLER_REPORT_FAILURE_MESSAGES.unknown)
    expect(SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE).not.toBe(
      SELLER_REPORT_FAILURE_MESSAGES['pdf-generation-failed'],
    )
    expect(SELLER_REPORT_DOWNLOAD_FAILURE_MESSAGE).toContain('PDF')
  })

  it('names the authoritative zone in Spanish', () => {
    expect(SELLER_REPORT_TIME_ZONE_LABEL).toBe('Hora del centro de México (America/Mexico_City)')
  })
})

describe('formatSellerReportPeriod — last included day (sales history redesign T2)', () => {
  it('shows the last included day while `to` stays the exclusive boundary', () => {
    expect(formatSellerReportPeriod('2026-11-01', '2026-12-01')).toBe('1 – 30 nov 2026')
  })

  it('collapses a single included day to one date', () => {
    expect(formatSellerReportPeriod('2026-11-24', '2026-11-25')).toBe('24 nov 2026')
  })

  it('names both months inside one year and both years across a year change', () => {
    expect(formatSellerReportPeriod('2026-10-01', '2026-12-01')).toBe('1 oct – 30 nov 2026')
    expect(formatSellerReportPeriod('2025-12-29', '2026-01-06')).toBe('29 dic 2025 – 5 ene 2026')
  })

  it('subtracts the day by calendar arithmetic across a leap February', () => {
    expect(formatSellerReportPeriod('2024-02-01', '2024-03-01')).toBe('1 – 29 feb 2024')
  })

  it('returns null for an empty, reversed or unparseable window instead of inventing one', () => {
    expect(formatSellerReportPeriod('2026-11-10', '2026-11-10')).toBeNull()
    expect(formatSellerReportPeriod('2026-11-10', '2026-11-05')).toBeNull()
    expect(formatSellerReportPeriod('2026-02-30', '2026-03-05')).toBeNull()
  })
})

// Sales history backend data T2 (S5-S8): display helpers for the handoff 28 additions.
import {
  SELLER_REPORT_NO_CUSTOMER_LABEL,
  formatSellerReportDay,
  formatSellerReportSaleCount,
  formatSellerReportShortDay,
  formatSellerReportUnits,
  sellerReportCustomerLabel,
  sellerReportPreviousPeriodComparison,
} from '../sellerReportPresentation'

describe('sellerReportCustomerLabel — S5', () => {
  it('shows the backend name, «Público en general» for null or blank, and nothing for an older backend', () => {
    expect(SELLER_REPORT_NO_CUSTOMER_LABEL).toBe('Público en general')
    expect(sellerReportCustomerLabel({ id: 'c-1', name: 'Ana Pérez' })).toBe('Ana Pérez')
    expect(sellerReportCustomerLabel(null)).toBe('Público en general')
    expect(sellerReportCustomerLabel({ id: 'c-1', name: '   ' })).toBe('Público en general')
    expect(sellerReportCustomerLabel(undefined)).toBeNull()
  })
})

describe('day, count and unit labels — S6/S7', () => {
  it('formats a calendar day from its digits, never through a Date', () => {
    expect(formatSellerReportShortDay('2026-11-03')).toBe('3 nov')
    expect(formatSellerReportDay('2026-11-03')).toBe('3 nov 2026')
    expect(formatSellerReportDay('2026-02-30')).toBe('2026-02-30')
  })

  it('pluralizes sales and units with es-MX grouping', () => {
    expect(formatSellerReportSaleCount(0)).toBe('0 ventas')
    expect(formatSellerReportSaleCount(1)).toBe('1 venta')
    expect(formatSellerReportSaleCount(1200)).toBe('1,200 ventas')
    expect(formatSellerReportUnits(1)).toBe('1 unidad')
    expect(formatSellerReportUnits(12)).toBe('12 unidades')
  })
})

describe('sellerReportPreviousPeriodComparison — S8', () => {
  const previous = { from: '2026-10-02', to: '2026-11-01', saleCount: 21, netSalesCents: 1_000_000 }

  it('shows a rounded signed ratio of the two backend figures', () => {
    expect(sellerReportPreviousPeriodComparison(1_120_000, previous).label).toBe(
      '+12% vs. período anterior',
    )
    expect(sellerReportPreviousPeriodComparison(920_000, previous).label).toBe(
      '−8% vs. período anterior',
    )
    expect(sellerReportPreviousPeriodComparison(1_120_000, previous).trend).toBe('up')
    expect(sellerReportPreviousPeriodComparison(920_000, previous).trend).toBe('down')
    expect(sellerReportPreviousPeriodComparison(0, previous).label).toBe(
      '−100% vs. período anterior',
    )
  })

  it('never claims a zero change for a small but real difference', () => {
    expect(sellerReportPreviousPeriodComparison(1_000_000, previous).label).toBe(
      'Igual que el período anterior',
    )
    expect(sellerReportPreviousPeriodComparison(1_000_000, previous).trend).toBe('flat')
    expect(sellerReportPreviousPeriodComparison(1_002_000, previous).label).toBe(
      '+<1% vs. período anterior',
    )
    expect(sellerReportPreviousPeriodComparison(998_000, previous).label).toBe(
      '−<1% vs. período anterior',
    )
  })

  it('guards the percentage when the previous period had no sales', () => {
    const empty = { ...previous, saleCount: 0, netSalesCents: 0 }

    expect(sellerReportPreviousPeriodComparison(500_000, empty).label).toBe(
      'Sin ventas en el período anterior',
    )
    expect(sellerReportPreviousPeriodComparison(500_000, empty).trend).toBe('none')
    expect(sellerReportPreviousPeriodComparison(500_000, empty).label).not.toContain('%')
  })

  it('names the previous range (last included day) and its backend figures in the title', () => {
    expect(sellerReportPreviousPeriodComparison(1_120_000, previous).title).toBe(
      'Período anterior: 2 – 31 oct 2026 · 21 ventas · $10,000.00',
    )
  })
})
