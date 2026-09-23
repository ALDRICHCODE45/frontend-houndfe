// mexicoCityCalendar.spec.ts — fixed-zone boundary, preset and range contract.
//
// Mutation-sensitive: changing the zone, parsing boundaries through UTC/browser
// instants, flipping preset day arithmetic, or loosening the 366-day/validity
// rules fails at least one of these tests.

import { describe, it, expect } from 'vitest'
import {
  MEXICO_CITY_RANGE_PRESET_IDS,
  MEXICO_CITY_TIME_ZONE,
  getMexicoCityRangePreset,
  isValidCalendarDateString,
  isValidMexicoCityDateRange,
  mexicoCityLast7DaysRange,
  mexicoCityPreviousMonthRange,
  mexicoCityThisMonthRange,
  mexicoCityToday,
  mexicoCityTodayRange,
} from '../mexicoCityCalendar'

/** 2025-03-15 12:00 in Mexico City (UTC-6): an unambiguous mid-month instant. */
const NOON_2025_03_15 = Date.UTC(2025, 2, 15, 18, 0, 0)
/** 2025-03-31 21:00 in Mexico City: last day of the month, still March locally. */
const LATE_2025_03_31 = Date.UTC(2025, 3, 1, 3, 0, 0)

describe('mexicoCityToday (ODD branch-sales-summary A2)', () => {
  it('pins the fixed zone and resolves a UTC instant whose Mexico City day differs', () => {
    expect(MEXICO_CITY_TIME_ZONE).toBe('America/Mexico_City')

    // 2025-01-01T04:00Z is still 2024-12-31T22:00 in Mexico City.
    expect(mexicoCityToday(Date.UTC(2025, 0, 1, 4, 0, 0)).toString()).toBe('2024-12-31')
    // 2025-01-01T07:00Z is 2025-01-01T01:00 locally.
    expect(mexicoCityToday(Date.UTC(2025, 0, 1, 7, 0, 0)).toString()).toBe('2025-01-01')
  })
})

describe('mexicoCity range presets', () => {
  it('returns today through tomorrow for the today preset', () => {
    expect(mexicoCityTodayRange(NOON_2025_03_15)).toEqual({
      from: '2025-03-15',
      to: '2025-03-16',
    })
  })

  it('spans exactly seven calendar days ending today for last7Days', () => {
    expect(mexicoCityLast7DaysRange(NOON_2025_03_15)).toEqual({
      from: '2025-03-09',
      to: '2025-03-16',
    })
  })

  it('runs month to date through tomorrow for thisMonth', () => {
    expect(mexicoCityThisMonthRange(NOON_2025_03_15)).toEqual({
      from: '2025-03-01',
      to: '2025-03-16',
    })
  })

  it('covers the full previous calendar month for previousMonth', () => {
    expect(mexicoCityPreviousMonthRange(NOON_2025_03_15)).toEqual({
      from: '2025-02-01',
      to: '2025-03-01',
    })
  })

  it('keeps the month presets correct for a late-evening local month boundary', () => {
    expect(mexicoCityThisMonthRange(LATE_2025_03_31)).toEqual({
      from: '2025-03-01',
      to: '2025-04-01',
    })
    expect(mexicoCityPreviousMonthRange(LATE_2025_03_31)).toEqual({
      from: '2025-02-01',
      to: '2025-03-01',
    })
    expect(mexicoCityLast7DaysRange(LATE_2025_03_31)).toEqual({
      from: '2025-03-25',
      to: '2025-04-01',
    })
  })

  it('resolves every registered preset id to the matching helper', () => {
    expect(MEXICO_CITY_RANGE_PRESET_IDS).toEqual([
      'today',
      'last7Days',
      'thisMonth',
      'previousMonth',
    ])
    expect(getMexicoCityRangePreset('today', NOON_2025_03_15)).toEqual(
      mexicoCityTodayRange(NOON_2025_03_15),
    )
    expect(getMexicoCityRangePreset('last7Days', NOON_2025_03_15)).toEqual(
      mexicoCityLast7DaysRange(NOON_2025_03_15),
    )
    expect(getMexicoCityRangePreset('thisMonth', NOON_2025_03_15)).toEqual(
      mexicoCityThisMonthRange(NOON_2025_03_15),
    )
    expect(getMexicoCityRangePreset('previousMonth', NOON_2025_03_15)).toEqual(
      mexicoCityPreviousMonthRange(NOON_2025_03_15),
    )
  })

  it('produces a range that passes its own validation', () => {
    for (const id of MEXICO_CITY_RANGE_PRESET_IDS) {
      const { from, to } = getMexicoCityRangePreset(id, NOON_2025_03_15)
      expect(isValidMexicoCityDateRange(from, to)).toBe(true)
    }
  })
})

describe('isValidCalendarDateString', () => {
  it('accepts exact real Gregorian dates, including leap days', () => {
    expect(isValidCalendarDateString('2025-03-15')).toBe(true)
    expect(isValidCalendarDateString('2024-02-29')).toBe(true)
  })

  it('rejects year 0000, impossible dates, timestamps, loose shapes and empties', () => {
    expect(isValidCalendarDateString('0000-01-01')).toBe(false)
    expect(isValidCalendarDateString('2025-02-30')).toBe(false)
    expect(isValidCalendarDateString('2026-02-29')).toBe(false)
    expect(isValidCalendarDateString('2025-13-01')).toBe(false)
    expect(isValidCalendarDateString('2025-00-10')).toBe(false)
    expect(isValidCalendarDateString('2025-03-15T00:00:00Z')).toBe(false)
    expect(isValidCalendarDateString('2025-3-15')).toBe(false)
    expect(isValidCalendarDateString('')).toBe(false)
    expect(isValidCalendarDateString(undefined)).toBe(false)
  })
})

describe('isValidMexicoCityDateRange', () => {
  it('accepts ordered ranges up to exactly 366 calendar days', () => {
    expect(isValidMexicoCityDateRange('2025-03-15', '2025-03-16')).toBe(true)
    // 2024 is a leap year, so these boundaries are exactly 366 days apart.
    expect(isValidMexicoCityDateRange('2024-01-01', '2025-01-01')).toBe(true)
  })

  it('rejects ranges longer than 366 calendar days', () => {
    expect(isValidMexicoCityDateRange('2024-01-01', '2025-01-02')).toBe(false)
  })

  it('rejects equal, inverted and malformed ranges', () => {
    expect(isValidMexicoCityDateRange('2025-03-15', '2025-03-15')).toBe(false)
    expect(isValidMexicoCityDateRange('2025-03-16', '2025-03-15')).toBe(false)
    expect(isValidMexicoCityDateRange('2025-02-30', '2025-03-15')).toBe(false)
    expect(isValidMexicoCityDateRange('0000-01-01', '2025-03-15')).toBe(false)
    expect(isValidMexicoCityDateRange('', '2025-03-15')).toBe(false)
  })
})
