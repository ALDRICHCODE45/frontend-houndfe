// Business minutes ↔ the units people read (min / h). The stored value is always minutes.
import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  initialUnit,
  isInvalidDuration,
  parseDuration,
  textForUnit,
} from '../settingsUnits'

describe('parseDuration', () => {
  it('reads whole minutes', () => {
    expect(parseDuration('45', 'min')).toBe(45)
    expect(parseDuration(' 7 ', 'min')).toBe(7)
  })

  it('reads hours (up to two decimals, comma or dot) as minutes', () => {
    expect(parseDuration('2', 'h')).toBe(120)
    expect(parseDuration('1.5', 'h')).toBe(90)
    expect(parseDuration('1,5', 'h')).toBe(90)
    expect(parseDuration('0.25', 'h')).toBe(15)
  })

  it('a blank text is null (no deadline)', () => {
    expect(parseDuration('', 'min')).toBeNull()
    expect(parseDuration('   ', 'h')).toBeNull()
  })

  it('anything that is not a number is NaN, never a silent zero', () => {
    expect(parseDuration('abc', 'min')).toBeNaN()
    expect(parseDuration('1.5', 'min')).toBeNaN()
    expect(parseDuration('-3', 'min')).toBeNaN()
    expect(parseDuration('1.234', 'h')).toBeNaN()
    expect(parseDuration('1e3', 'min')).toBeNaN()
  })
})

describe('isInvalidDuration', () => {
  it('flags NaN only', () => {
    expect(isInvalidDuration(Number.NaN)).toBe(true)
    expect(isInvalidDuration(null)).toBe(false)
    expect(isInvalidDuration(0)).toBe(false)
  })
})

describe('formatDuration', () => {
  it.each([
    [null, 'Sin plazo'],
    [1, '1 min'],
    [45, '45 min'],
    [60, '1 h'],
    [90, '1 h 30 min'],
    [240, '4 h'],
    [10080, '168 h'],
  ])('%s → %s', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })
})

describe('initialUnit and textForUnit', () => {
  it('shows whole hours in hours and everything else in minutes', () => {
    expect(initialUnit(240)).toBe('h')
    expect(initialUnit(60)).toBe('h')
    expect(initialUnit(90)).toBe('min')
    expect(initialUnit(30)).toBe('min')
    expect(initialUnit(null)).toBe('min')
  })

  it('writes the value back in the chosen unit and round-trips through parse', () => {
    expect(textForUnit(240, 'h')).toBe('4')
    expect(textForUnit(90, 'h')).toBe('1.5')
    expect(textForUnit(45, 'min')).toBe('45')
    expect(textForUnit(null, 'min')).toBe('')
    for (const minutes of [1, 15, 90, 240, 10080]) {
      expect(parseDuration(textForUnit(minutes, 'h'), 'h')).toBe(minutes)
      expect(parseDuration(textForUnit(minutes, 'min'), 'min')).toBe(minutes)
    }
  })
})
