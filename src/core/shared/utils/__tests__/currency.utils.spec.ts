import { describe, expect, it } from 'vitest'
import { decimalMoneyTitle, formatDecimalMoney, formatDecimalMoneyExact } from '../currency.utils'

describe('formatDecimalMoney', () => {
  it('formats a canonical decimal string as es-MX currency with exactly two decimals', () => {
    expect(formatDecimalMoney('780.5')).toBe('$780.50')
    expect(formatDecimalMoney('3000')).toBe('$3,000.00')
    expect(formatDecimalMoney('1234567.1')).toBe('$1,234,567.10')
  })
  it('rounds extra precision half-up for display only', () => {
    expect(formatDecimalMoney('23.1')).toBe('$23.10')
    expect(formatDecimalMoney('128.125')).toBe('$128.13')
    expect(formatDecimalMoney('23.1234')).toBe('$23.12')
    expect(formatDecimalMoney('23.12340')).toBe('$23.12')
    expect(formatDecimalMoney('0.00005')).toBe('$0.00')
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

describe('formatDecimalMoneyExact', () => {
  it('keeps every digit the server sent, at least two decimals', () => {
    expect(formatDecimalMoneyExact('780.5')).toBe('$780.50')
    expect(formatDecimalMoneyExact('128.125')).toBe('$128.125')
    expect(formatDecimalMoneyExact('23.12340')).toBe('$23.1234')
    expect(formatDecimalMoneyExact('0.00005')).toBe('$0.00005')
  })
  it('returns anything that is not a plain decimal unchanged', () => {
    expect(formatDecimalMoneyExact('abc')).toBe('abc')
    expect(formatDecimalMoneyExact('10', 'not-a-code')).toBe('10')
  })
})

describe('decimalMoneyTitle', () => {
  it('gives the exact value only where the displayed amount was rounded', () => {
    expect(decimalMoneyTitle('128.125')).toBe('$128.125')
    expect(decimalMoneyTitle('23.1234', 'MXN')).toBe('$23.1234')
  })
  it('is undefined when nothing was rounded or the value is not a decimal', () => {
    expect(decimalMoneyTitle('780.5')).toBeUndefined()
    expect(decimalMoneyTitle('23.100')).toBeUndefined()
    expect(decimalMoneyTitle('abc')).toBeUndefined()
  })
})
