import { describe, it, expect } from 'vitest'
import { promotionQueryKeys, saleQueryKeys } from '../query-keys'

describe('promotionQueryKeys', () => {
  it('paginated() returns a tuple starting with "promotions"', () => {
    const key = promotionQueryKeys.paginated('tenant-1')
    expect(key[0]).toBe('promotions')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('paginated')
  })

  it('paginated() returns a different key each call (same reference via as const)', () => {
    const key1 = promotionQueryKeys.paginated('tenant-1')
    const key2 = promotionQueryKeys.paginated('tenant-1')
    expect(key1).toEqual(key2)
  })

  it('detail(id) includes the id in the key', () => {
    const id = 'some-uuid'
    const key = promotionQueryKeys.detail('tenant-1', id)
    expect(key).toContain(id)
    expect(key).toContain('detail')
    expect(key[0]).toBe('promotions')
    expect(key[1]).toBe('tenant-1')
  })

  it('detail with different ids produce different keys', () => {
    const key1 = promotionQueryKeys.detail('tenant-1', 'uuid-1')
    const key2 = promotionQueryKeys.detail('tenant-1', 'uuid-2')
    expect(key1).not.toEqual(key2)
  })

  it('includes tenant id so different tenants use isolated cache keys', () => {
    const key1 = promotionQueryKeys.paginated('tenant-1')
    const key2 = promotionQueryKeys.paginated('tenant-2')
    expect(key1).not.toEqual(key2)
  })
})

describe('saleQueryKeys', () => {
  it('drafts() returns a tuple starting with "sales"', () => {
    const key = saleQueryKeys.drafts('tenant-1')
    expect(key[0]).toBe('sales')
    expect(key[1]).toBe('tenant-1')
    expect(key[2]).toBe('drafts')
  })

  it('drafts() returns same structure on multiple calls', () => {
    const key1 = saleQueryKeys.drafts('tenant-1')
    const key2 = saleQueryKeys.drafts('tenant-1')
    expect(key1).toEqual(key2)
  })

  describe('posCatalog', () => {
    it('should return tuple with sales and pos-catalog prefix', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', {})
      expect(key[0]).toBe('sales')
      expect(key[1]).toBe('tenant-1')
      expect(key[2]).toBe('pos-catalog')
    })

    it('should include all params with defaults when empty object provided', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', {})
      expect(key).toEqual(['sales', 'tenant-1', 'pos-catalog', '', 25, 0, null, null])
    })

    it('should include query string in key', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', { q: 'aspirina' })
      expect(key[3]).toBe('aspirina')
    })

    it('should include custom limit and offset', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', { limit: 50, offset: 25 })
      expect(key[4]).toBe(50)
      expect(key[5]).toBe(25)
    })

    it('should include categoryId and brandId when provided', () => {
      const key = saleQueryKeys.posCatalog('tenant-1', {
        categoryId: 'cat-uuid',
        brandId: 'brand-uuid',
      })
      expect(key[6]).toBe('cat-uuid')
      expect(key[7]).toBe('brand-uuid')
    })

    it('should produce different keys for different queries', () => {
      const key1 = saleQueryKeys.posCatalog('tenant-1', { q: 'aspirina' })
      const key2 = saleQueryKeys.posCatalog('tenant-1', { q: 'paracetamol' })
      expect(key1).not.toEqual(key2)
    })

    it('should produce different keys for different pagination', () => {
      const key1 = saleQueryKeys.posCatalog('tenant-1', { offset: 0 })
      const key2 = saleQueryKeys.posCatalog('tenant-1', { offset: 25 })
      expect(key1).not.toEqual(key2)
    })

    it('should produce different keys for different tenants', () => {
      const key1 = saleQueryKeys.posCatalog('tenant-1', { q: 'aspirina' })
      const key2 = saleQueryKeys.posCatalog('tenant-2', { q: 'aspirina' })
      expect(key1).not.toEqual(key2)
    })
  })
})
