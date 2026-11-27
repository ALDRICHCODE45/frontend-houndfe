import { describe, expect, it } from 'vitest'
import { TABLE_PAGE_SIZE_OPTIONS, nearestPageSize } from '../table-page-size'

describe('TABLE_PAGE_SIZE_OPTIONS', () => {
  it('offers 5 to 50 in steps of 5', () => {
    expect([...TABLE_PAGE_SIZE_OPTIONS]).toEqual([5, 10, 15, 20, 25, 30, 35, 40, 45, 50])
  })
})

describe('nearestPageSize', () => {
  it('keeps a size that is already an option', () => {
    expect(nearestPageSize(35)).toBe(35)
  })

  it('rounds a size that is not an option to the nearest one (the lower on a tie)', () => {
    expect(nearestPageSize(12)).toBe(10)
    expect(nearestPageSize(13)).toBe(15)
    expect(nearestPageSize(100)).toBe(50)
    expect(nearestPageSize(1)).toBe(5)
    expect(nearestPageSize(7.5)).toBe(5)
  })

  it('uses the given options', () => {
    expect(nearestPageSize(70, [20, 50, 100])).toBe(50)
    expect(nearestPageSize(80, [20, 50, 100])).toBe(100)
  })
})
