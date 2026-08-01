import { describe, it, expect } from 'vitest'
import { formatCentsMXN, lineCents, sumLineCents } from '../currency.utils'

describe('quotations currency re-exports', () => {
  describe('formatCentsMXN', () => {
    it('formats integer cents as MXN currency string', () => {
      expect(formatCentsMXN(4998)).toBe('$49.98')
    })

    it('formats zero cents correctly', () => {
      expect(formatCentsMXN(0)).toBe('$0.00')
    })
  })

  describe('lineCents', () => {
    it('multiplies unit price cents by quantity', () => {
      expect(lineCents(5000, 3)).toBe(15000)
    })
  })

  describe('sumLineCents', () => {
    it('returns zero for empty array', () => {
      expect(sumLineCents([])).toBe(0)
    })

    it('sums line totals for multiple items', () => {
      const items = [
        { unitPriceCents: 5000, quantity: 2 },
        { unitPriceCents: 3000, quantity: 1 },
      ]
      expect(sumLineCents(items)).toBe(13000)
    })
  })
})