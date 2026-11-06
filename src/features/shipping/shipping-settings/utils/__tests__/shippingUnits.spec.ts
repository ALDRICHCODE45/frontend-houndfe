import { describe, expect, it } from 'vitest'
import { cmFromText, formatCm, formatKg, gramsFromKgText } from '../shippingUnits'

describe('shippingUnits — sizes in cm with one decimal (S4)', () => {
  it('reads 0.1..300 with at most one decimal, accepting a decimal comma', () => {
    expect(cmFromText('30')).toBe(30)
    expect(cmFromText(' 20,5 ')).toBe(20.5)
    expect(cmFromText('0.1')).toBe(0.1)
    expect(cmFromText('300')).toBe(300)
  })

  it('rejects empty, zero, more than one decimal and out of range', () => {
    for (const text of ['', '0', '10.25', '-1', '300.1', 'abc', '1.']) {
      expect(cmFromText(text)).toBeNull()
    }
  })

  it('formats a size without trailing zeros', () => {
    expect(formatCm(30)).toBe('30')
    expect(formatCm(20.5)).toBe('20.5')
  })
})

describe('shippingUnits — weights typed in kg, sent as grams (S4)', () => {
  it('converts kg to whole grams between 1 and 70000', () => {
    expect(gramsFromKgText('1.25')).toBe(1250)
    expect(gramsFromKgText('0,18')).toBe(180)
    expect(gramsFromKgText('5')).toBe(5000)
    expect(gramsFromKgText('0.001')).toBe(1)
    expect(gramsFromKgText('70')).toBe(70000)
  })

  it('rejects zero, a fraction of a gram and more than 70 kg', () => {
    for (const text of ['', '0', '0.0004', '1.2345', '70.001', 'kg']) {
      expect(gramsFromKgText(text)).toBeNull()
    }
  })

  it('shows grams as kg without trailing zeros', () => {
    expect(formatKg(180)).toBe('0.18')
    expect(formatKg(5000)).toBe('5')
    expect(formatKg(1250)).toBe('1.25')
  })
})
