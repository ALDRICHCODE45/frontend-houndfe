import { afterEach, describe, expect, it, vi } from 'vitest'
import { localEndOfDayUTC, localStartOfDayUTC } from '../dateRangeBoundaries'

describe('dateRangeBoundaries', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes start of local day and converts it to UTC ISO', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-23T12:00:00.000Z'))

    expect(localStartOfDayUTC('2026-05-23')).toBe(new Date(2026, 4, 23, 0, 0, 0, 0).toISOString())
  })

  it('computes end of local day and converts it to UTC ISO', () => {
    expect(localEndOfDayUTC('2026-05-23')).toBe(new Date(2026, 4, 23, 23, 59, 59, 999).toISOString())
  })

  it('keeps 24h - 1ms boundary distance', () => {
    const start = new Date(localStartOfDayUTC('2026-05-23')).getTime()
    const end = new Date(localEndOfDayUTC('2026-05-23')).getTime()
    expect(end - start).toBe(86_399_999)
  })
})
