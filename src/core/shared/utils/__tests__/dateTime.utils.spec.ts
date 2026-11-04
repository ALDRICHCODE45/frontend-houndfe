import { describe, expect, it } from 'vitest'
import { formatShortDateTime } from '../dateTime.utils'

const now = new Date('2026-11-03T21:00:00Z')
const utc = { timeZone: 'UTC', now }

describe('formatShortDateTime', () => {
  it('formats day, short month and 24h time in es-MX', () => {
    expect(formatShortDateTime('2026-11-03T20:43:00Z', utc)).toBe('3 nov, 20:43')
  })

  it('adds the year only when it differs from the current one', () => {
    expect(formatShortDateTime('2025-11-03T20:43:00Z', utc)).toBe('3 nov 2025, 20:43')
    expect(formatShortDateTime('2027-01-09T08:05:00Z', utc)).toBe('9 ene 2027, 08:05')
  })

  it('accepts a Date instance and pads midnight hours', () => {
    expect(formatShortDateTime(new Date('2026-02-14T00:05:00Z'), utc)).toBe('14 feb, 00:05')
  })

  it('never leaks a trailing dot or the raw ISO string', () => {
    for (let month = 0; month < 12; month++) {
      const text = formatShortDateTime(new Date(Date.UTC(2026, month, 3, 20, 43)), utc)
      expect(text).toMatch(/^3 [a-z]{3}, 20:43$/)
    }
  })

  it('compares the year in the display time zone, not in UTC', () => {
    // 2027-01-01T05:30Z is still 31 dic 2026 in Mexico City.
    const value = '2027-01-01T05:30:00Z'
    const june2026 = new Date('2026-06-01T12:00:00Z')
    expect(formatShortDateTime(value, { timeZone: 'America/Mexico_City', now: june2026 })).toBe('31 dic, 23:30')
    expect(formatShortDateTime(value, { timeZone: 'UTC', now: june2026 })).toBe('1 ene 2027, 05:30')
  })

  it.each([null, undefined, '', 'not-a-date'])('returns an em dash for %j', value => {
    expect(formatShortDateTime(value, utc)).toBe('—')
  })
})
