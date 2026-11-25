import { describe, expect, it } from 'vitest'
import { CustomerSalesMonthlyResponseSchema, SaleListSummarySchema } from '../sale.types'

// Sales history backend data T1 (handoff 28 §2.2, §4): the summary additions are optional (an older
// backend still parses), integers when present; the monthly body is validated strictly.
describe('sale.types — handoff 28', () => {
  const base = { salesCount: 14, totalSoldCents: 1_834_500, outstandingDebtCents: 98_000 }

  it('parses the summary with and without the new members', () => {
    expect(SaleListSummarySchema.safeParse(base).success).toBe(true)
    expect(
      SaleListSummarySchema.safeParse({
        ...base,
        averageTicketCents: 131_036,
        overdueDebtCents: 61_000,
        oldestOverdueDueDate: '2026-11-10',
      }).success,
    ).toBe(true)
    expect(SaleListSummarySchema.safeParse({ ...base, oldestOverdueDueDate: null }).success).toBe(
      true,
    )
  })

  it('rejects a non-integer average ticket or overdue debt', () => {
    expect(SaleListSummarySchema.safeParse({ ...base, averageTicketCents: 1.5 }).success).toBe(
      false,
    )
    expect(SaleListSummarySchema.safeParse({ ...base, overdueDebtCents: '1' }).success).toBe(false)
  })

  it('validates the monthly response', () => {
    const ok = {
      customerId: 'c',
      timeZone: 'America/Mexico_City',
      months: [{ month: '2026-11', saleCount: 3, totalCents: 125_000 }],
    }
    expect(CustomerSalesMonthlyResponseSchema.safeParse(ok).success).toBe(true)
    expect(
      CustomerSalesMonthlyResponseSchema.safeParse({
        ...ok,
        months: [{ month: '2026-11-01', saleCount: 3, totalCents: 1 }],
      }).success,
    ).toBe(false)
    expect(CustomerSalesMonthlyResponseSchema.safeParse({ ...ok, months: null }).success).toBe(
      false,
    )
  })
})
