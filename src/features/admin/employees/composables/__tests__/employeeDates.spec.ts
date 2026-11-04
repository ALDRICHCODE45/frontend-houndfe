/**
 * Employee date display (Money and dates rules): short, no zero-padded day,
 * the year only when it is not the current one, and a one-day range reads once.
 */
import { describe, expect, it } from 'vitest'
import { formatHireDate, formatTimeOffDate, formatTimeOffDateRange } from '../useEmployeeColumns'

const NOW = new Date('2026-11-04T12:00:00Z')

describe('formatTimeOffDate', () => {
  it('drops the year when it is the current one and does not pad the day', () => {
    expect(formatTimeOffDate('2026-06-05', NOW)).toBe('5 jun')
  })

  it('keeps the year when it is not the current one', () => {
    expect(formatTimeOffDate('2025-06-05', NOW)).toBe('5 jun 2025')
  })

  it('returns a dash for empty input and echoes an invalid value', () => {
    expect(formatTimeOffDate('', NOW)).toBe('—')
    expect(formatTimeOffDate('no-date', NOW)).toBe('no-date')
  })
})

describe('formatTimeOffDateRange', () => {
  it('shows a same-day range once', () => {
    expect(formatTimeOffDateRange('2026-06-05', '2026-06-05', NOW)).toBe('5 jun')
    expect(formatTimeOffDateRange('2026-06-05T00:00:00.000Z', '2026-06-05T23:00:00.000Z', NOW)).toBe('5 jun')
  })

  it('shows both ends for a longer range', () => {
    expect(formatTimeOffDateRange('2026-08-10', '2026-08-14', NOW)).toBe('10 ago – 14 ago')
  })
})

describe('formatHireDate', () => {
  it('always shows the year but does not pad the day', () => {
    expect(formatHireDate('2020-03-05')).toMatch(/^5 mar\.? 2020$/)
  })
})
