import { describe, it, expect } from 'vitest'
import { formatCentsMXN, sumLineCents, lineCents } from '../currency.utils'

describe('currency.utils', () => {
  describe('formatCentsMXN', () => {
    it('should format cents to MXN currency string', () => {
      const result = formatCentsMXN(4998)
      expect(result).toBe('$49.98')
    })

    it('should format zero cents correctly', () => {
      const result = formatCentsMXN(0)
      expect(result).toBe('$0.00')
    })

    it('should format large amounts correctly', () => {
      const result = formatCentsMXN(123456)
      expect(result).toBe('$1,234.56')
    })

    it('should handle single cent', () => {
      const result = formatCentsMXN(1)
      expect(result).toBe('$0.01')
    })

    it('should round down fractional cents during division', () => {
      // 999 cents = $9.99 (no rounding should occur in display)
      const result = formatCentsMXN(999)
      expect(result).toBe('$9.99')
    })
  })

  describe('sumLineCents', () => {
    it('should sum line totals for multiple items in integer cents', () => {
      const items = [
        { unitPriceCents: 5000, quantity: 2 },
        { unitPriceCents: 3000, quantity: 1 },
      ]

      const result = sumLineCents(items)

      // (5000 * 2) + (3000 * 1) = 10000 + 3000 = 13000 cents
      expect(result).toBe(13000)
    })

    it('should return zero for empty items array', () => {
      const result = sumLineCents([])
      expect(result).toBe(0)
    })

    it('should handle single item', () => {
      const items = [{ unitPriceCents: 7500, quantity: 3 }]

      const result = sumLineCents(items)

      // 7500 * 3 = 22500 cents
      expect(result).toBe(22500)
    })

    it('should maintain integer precision with large quantities', () => {
      const items = [
        { unitPriceCents: 10050, quantity: 10 },
        { unitPriceCents: 2099, quantity: 5 },
      ]

      const result = sumLineCents(items)

      // (10050 * 10) + (2099 * 5) = 100500 + 10495 = 110995 cents
      expect(result).toBe(110995)
    })

    it('should work with ReadonlyArray type', () => {
      const items: ReadonlyArray<{ unitPriceCents: number; quantity: number }> = [
        { unitPriceCents: 1000, quantity: 2 },
      ]

      const result = sumLineCents(items)

      expect(result).toBe(2000)
    })
  })

  describe('lineCents', () => {
    it('should calculate line total for single item', () => {
      const result = lineCents(5000, 3)

      // 5000 * 3 = 15000 cents
      expect(result).toBe(15000)
    })

    it('should return zero when quantity is zero', () => {
      const result = lineCents(5000, 0)
      expect(result).toBe(0)
    })

    it('should calculate correctly for quantity of 1', () => {
      const result = lineCents(2500, 1)
      expect(result).toBe(2500)
    })

    it('should handle large quantities maintaining integer precision', () => {
      const result = lineCents(999, 100)

      // 999 * 100 = 99900 cents
      expect(result).toBe(99900)
    })
  })
})
