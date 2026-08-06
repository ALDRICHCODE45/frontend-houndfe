/**
 * REQ-QAF-006 / T-FE-01 — `QuotationListParams` widening.
 *
 * The backend contract extension accepts:
 *   - `status` as a single value (legacy) OR a CSV string OR an array of values.
 *   - `customerId` as a single value (legacy) OR a CSV string OR an array.
 *   - `expiresFrom` / `expiresTo` (ISO date strings) — new for the date range filter.
 *   - `minTotalCents` / `maxTotalCents` (non-negative integers) — new for the total range.
 *   - `search` already supported.
 *   - `sortBy` / `sortOrder` already supported.
 *
 * The type-level guarantee is the FE never accidentally widens a single string
 * when an array arrives — and the legacy single-value call sites keep working
 * without changes. The api layer (csvParamsSerializer) converts arrays to CSV
 * before they leave the browser.
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import type { QuotationListParams, QuotationStatus } from '../quotation.types'

describe('QuotationListParams — REQ-QAF-006 widening', () => {
  it('keeps the legacy single-value status shape compiling', () => {
    const legacy: QuotationListParams = {
      page: 1,
      limit: 10,
      status: 'DRAFT',
      customerId: 'cust-1',
      search: 'juan',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }
    expect(legacy.status).toBe('DRAFT')
    expect(legacy.customerId).toBe('cust-1')
  })

  it('accepts status as a single string OR an array OR a CSV string', () => {
    const single: QuotationListParams = { status: 'DRAFT' }
    const arr: QuotationListParams = { status: ['DRAFT', 'SENT'] }
    const csv: QuotationListParams = { status: 'DRAFT,SENT' }

    expect(single.status).toBe('DRAFT')
    expect(arr.status).toEqual(['DRAFT', 'SENT'])
    expect(csv.status).toBe('DRAFT,SENT')
  })

  it('accepts customerId as a single string OR an array OR a CSV string', () => {
    const single: QuotationListParams = { customerId: 'cust-1' }
    const arr: QuotationListParams = { customerId: ['cust-1', 'cust-2'] }
    const csv: QuotationListParams = { customerId: 'cust-1,cust-2' }

    expect(single.customerId).toBe('cust-1')
    expect(arr.customerId).toEqual(['cust-1', 'cust-2'])
    expect(csv.customerId).toBe('cust-1,cust-2')
  })

  it('exposes expiresFrom and expiresTo as ISO date strings', () => {
    const params: QuotationListParams = {
      expiresFrom: '2026-01-01',
      expiresTo: '2026-01-31',
    }
    expect(params.expiresFrom).toBe('2026-01-01')
    expect(params.expiresTo).toBe('2026-01-31')
  })

  it('exposes minTotalCents and maxTotalCents as non-negative integers', () => {
    const params: QuotationListParams = {
      minTotalCents: 0,
      maxTotalCents: 50000,
    }
    expect(params.minTotalCents).toBe(0)
    expect(params.maxTotalCents).toBe(50000)
  })

  it('keeps the union type of status narrow to the four backend values', () => {
    expectTypeOf<QuotationStatus>().toEqualTypeOf<'DRAFT' | 'SENT' | 'EXPIRED' | 'CANCELLED'>()
  })

  it('all five fields stay optional (no required after widening)', () => {
    const empty: QuotationListParams = {}
    expect(empty.page).toBeUndefined()
    expect(empty.status).toBeUndefined()
    expect(empty.customerId).toBeUndefined()
    expect(empty.search).toBeUndefined()
    expect(empty.expiresFrom).toBeUndefined()
    expect(empty.expiresTo).toBeUndefined()
    expect(empty.minTotalCents).toBeUndefined()
    expect(empty.maxTotalCents).toBeUndefined()
  })
})
