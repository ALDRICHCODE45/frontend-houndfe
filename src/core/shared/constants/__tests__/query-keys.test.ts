import { describe, it, expect } from 'vitest'
import { promotionQueryKeys, saleQueryKeys } from '../query-keys'

describe('promotionQueryKeys', () => {
  it('paginated() returns a tuple starting with "promotions"', () => {
    const key = promotionQueryKeys.paginated()
    expect(key[0]).toBe('promotions')
    expect(key[1]).toBe('paginated')
  })

  it('paginated() returns a different key each call (same reference via as const)', () => {
    const key1 = promotionQueryKeys.paginated()
    const key2 = promotionQueryKeys.paginated()
    expect(key1).toEqual(key2)
  })

  it('detail(id) includes the id in the key', () => {
    const id = 'some-uuid'
    const key = promotionQueryKeys.detail(id)
    expect(key).toContain(id)
    expect(key).toContain('detail')
    expect(key[0]).toBe('promotions')
  })

  it('detail with different ids produce different keys', () => {
    const key1 = promotionQueryKeys.detail('uuid-1')
    const key2 = promotionQueryKeys.detail('uuid-2')
    expect(key1).not.toEqual(key2)
  })
})

describe('saleQueryKeys', () => {
  it('drafts() returns a tuple starting with "sales"', () => {
    const key = saleQueryKeys.drafts()
    expect(key[0]).toBe('sales')
    expect(key[1]).toBe('drafts')
  })

  it('drafts() returns same structure on multiple calls', () => {
    const key1 = saleQueryKeys.drafts()
    const key2 = saleQueryKeys.drafts()
    expect(key1).toEqual(key2)
  })

  describe('posCatalog', () => {
    it('should return tuple with sales and pos-catalog prefix', () => {
      const key = saleQueryKeys.posCatalog({})
      expect(key[0]).toBe('sales')
      expect(key[1]).toBe('pos-catalog')
    })

    it('should include all params with defaults when empty object provided', () => {
      const key = saleQueryKeys.posCatalog({})
      expect(key).toEqual(['sales', 'pos-catalog', '', 25, 0, null, null])
    })

    it('should include query string in key', () => {
      const key = saleQueryKeys.posCatalog({ q: 'aspirina' })
      expect(key[2]).toBe('aspirina')
    })

    it('should include custom limit and offset', () => {
      const key = saleQueryKeys.posCatalog({ limit: 50, offset: 25 })
      expect(key[3]).toBe(50)
      expect(key[4]).toBe(25)
    })

    it('should include categoryId and brandId when provided', () => {
      const key = saleQueryKeys.posCatalog({
        categoryId: 'cat-uuid',
        brandId: 'brand-uuid',
      })
      expect(key[5]).toBe('cat-uuid')
      expect(key[6]).toBe('brand-uuid')
    })

    it('should produce different keys for different queries', () => {
      const key1 = saleQueryKeys.posCatalog({ q: 'aspirina' })
      const key2 = saleQueryKeys.posCatalog({ q: 'paracetamol' })
      expect(key1).not.toEqual(key2)
    })

    it('should produce different keys for different pagination', () => {
      const key1 = saleQueryKeys.posCatalog({ offset: 0 })
      const key2 = saleQueryKeys.posCatalog({ offset: 25 })
      expect(key1).not.toEqual(key2)
    })
  })
})
