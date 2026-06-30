import { describe, expect, it } from 'vitest'
import { isProductViewMode } from '../useProductViewMode'

describe('isProductViewMode', () => {
  it('accepts the valid product view modes', () => {
    expect(isProductViewMode('table')).toBe(true)
    expect(isProductViewMode('card')).toBe(true)
  })

  it('rejects unknown or plural values', () => {
    expect(isProductViewMode('cards')).toBe(false)
    expect(isProductViewMode('grid')).toBe(false)
    expect(isProductViewMode('')).toBe(false)
  })
})
