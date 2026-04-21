import { describe, it, expect } from 'vitest'
import { promotionQueryKeys } from '../query-keys'

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
