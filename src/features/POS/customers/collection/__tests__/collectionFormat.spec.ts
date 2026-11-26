/**
 * «Cobrar todo» T1 (S4; handoff 30 §4): the due day is the first 10 characters of `dueDate`,
 * never converted through a time zone.
 */
import { describe, expect, it } from 'vitest'
import { formatCollectionDueDay } from '../collectionFormat'

describe('formatCollectionDueDay', () => {
  it('formats the first 10 characters as dd/mm/yyyy', () => {
    expect(formatCollectionDueDay('2026-11-10T00:00:00.000Z')).toBe('10/11/2026')
  })

  it('does not shift a late UTC instant to the next local day', () => {
    expect(formatCollectionDueDay('2026-11-01T23:59:59.000-06:00')).toBe('01/11/2026')
  })

  it('returns null without a due date or with an unreadable one', () => {
    expect(formatCollectionDueDay(null)).toBeNull()
    expect(formatCollectionDueDay('nope')).toBeNull()
  })
})
