import { describe, expect, it } from 'vitest'
import { formatPromotionDate } from '../promotionDate.utils'

describe('formatPromotionDate', () => {
  const year = new Date().getFullYear()

  it('is short and drops the current year', () => {
    expect(formatPromotionDate(`${year}-09-01T00:00:00.000Z`)).toBe('1 sep')
  })

  it('keeps the year when it differs from the current one', () => {
    expect(formatPromotionDate(`${year + 1}-03-05T00:00:00.000Z`)).toBe(`5 mar ${year + 1}`)
  })

  it('reads the date part so a UTC midnight never shows the previous day', () => {
    expect(formatPromotionDate(`${year}-04-01T00:00:00.000Z`)).toBe('1 abr')
  })

  it('shows a dash when the date is absent or unreadable', () => {
    expect(formatPromotionDate(null)).toBe('—')
    expect(formatPromotionDate('nope')).toBe('—')
  })
})
