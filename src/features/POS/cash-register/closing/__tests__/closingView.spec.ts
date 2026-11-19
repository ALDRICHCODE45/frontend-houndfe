import { describe, expect, it } from 'vitest'
import { closingDateRange, closingPersonName, sortedClosingHandovers } from '../closingView'
import { CLOSING } from './closingFixtures'

describe('sortedClosingHandovers', () => {
  it('sorts the unordered snapshot handovers by declaredAt, then id', () => {
    const sorted = sortedClosingHandovers(CLOSING.snapshot.handovers)
    expect(sorted.map((h) => h.kind)).toEqual(['WITHDRAWAL', 'FLOAT'])
    // The source array is never mutated.
    expect(CLOSING.snapshot.handovers[0]!.kind).toBe('FLOAT')
  })

  it('breaks declaredAt ties by handoverId', () => {
    const [a, b] = CLOSING.snapshot.handovers
    const same = [
      { ...a!, handoverId: 'b', declaredAt: '2026-11-05T22:00:00.000Z' },
      { ...b!, handoverId: 'a', declaredAt: '2026-11-05T22:00:00.000Z' },
    ]
    expect(sortedClosingHandovers(same).map((h) => h.handoverId)).toEqual(['a', 'b'])
  })
})

describe('closingPersonName', () => {
  it('names the people the snapshot knows', () => {
    const s = CLOSING.snapshot
    expect(closingPersonName(s, s.cashierUserId)).toBe('Ana Cajera')
    expect(closingPersonName(s, s.closedByUserId)).toBe('Luis Supervisor')
    expect(closingPersonName(s, 'someone-else')).toBe('Otra persona')
    expect(closingPersonName(s, null)).toBe('—')
  })
})

describe('closingDateRange', () => {
  it('turns local days into an ISO range with explicit timezone (to is exclusive)', () => {
    const range = closingDateRange('2026-11-01', '2026-11-03')
    expect(range.from).toBe(new Date(2026, 10, 1).toISOString())
    expect(range.to).toBe(new Date(2026, 10, 4).toISOString())
  })

  it('omits empty ends', () => {
    expect(closingDateRange('', '')).toEqual({})
    expect(Object.keys(closingDateRange('2026-11-01', ''))).toEqual(['from'])
  })
})
