import { describe, expect, it } from 'vitest'
import { formatDecimalMoney } from '../currency.utils'

describe('formatDecimalMoney', () => {
  it('formats a canonical decimal string as es-MX currency with at least two decimals', () => {
    expect(formatDecimalMoney('780.5')).toBe('$780.50')
    expect(formatDecimalMoney('3000')).toBe('$3,000.00')
    expect(formatDecimalMoney('1234567.1')).toBe('$1,234,567.10')
  })
  it('keeps up to four fraction digits the server sent instead of rounding them away', () => {
    expect(formatDecimalMoney('23.1')).toBe('$23.10')
    expect(formatDecimalMoney('23.125')).toBe('$23.125')
    expect(formatDecimalMoney('23.1234')).toBe('$23.1234')
    expect(formatDecimalMoney('23.12340')).toBe('$23.1234')
  })
  it('does not round values with more than four significant decimals', () => {
    expect(formatDecimalMoney('0.00005')).toBe('$0.00005')
  })
  it('keeps the precision of large amounts', () => {
    expect(formatDecimalMoney('9007199254740993.25')).toBe('$9,007,199,254,740,993.25')
  })
  it('formats negative amounts', () => {
    expect(formatDecimalMoney('-12.5')).toBe('-$12.50')
  })
  it('returns anything that is not a plain decimal unchanged', () => {
    for (const value of ['', 'abc', '12,5', '1e3', ' ', '12.', '.5', '12.3.4', 'NaN']) expect(formatDecimalMoney(value)).toBe(value)
  })
  it('uses the given currency and defaults to MXN', () => {
    expect(formatDecimalMoney('10', 'MXN')).toBe('$10.00')
    expect(formatDecimalMoney('10', 'USD')).toContain('10.00')
    expect(formatDecimalMoney('10', 'USD')).not.toBe(formatDecimalMoney('10'))
  })
  it('returns the input unchanged for an unknown currency code', () => {
    expect(formatDecimalMoney('10', 'not-a-code')).toBe('10')
  })
})
