import { describe, expect, it } from 'vitest'
import { productStockTotal } from '../productStockTotal'

const base = {
  type: 'PRODUCT' as const,
  useStock: true,
  hasVariants: false,
  useLotsAndExpirations: false,
  isCreateMode: false,
  formQuantity: 5,
  pendingVariants: [],
  variants: [],
  pendingLots: [],
  lots: [],
}

describe('productStockTotal', () => {
  it('is null for services and untracked products', () => {
    expect(productStockTotal({ ...base, type: 'SERVICE' })).toBeNull()
    expect(productStockTotal({ ...base, useStock: false })).toBeNull()
  })

  it('uses the saved product total for a lots product, lots plus the untracked portion', () => {
    expect(
      productStockTotal({
        ...base,
        useLotsAndExpirations: true,
        savedQuantity: 72,
        lots: [{ quantity: 20 }, { quantity: 40 }],
      }),
    ).toBe(72)
  })

  it('falls back to the lots sum only when the saved total is unknown', () => {
    expect(
      productStockTotal({ ...base, useLotsAndExpirations: true, lots: [{ quantity: 20 }, { quantity: 40 }] }),
    ).toBe(60)
  })

  it('sums pending lots and variants while creating', () => {
    expect(
      productStockTotal({ ...base, isCreateMode: true, useLotsAndExpirations: true, pendingLots: [{ quantity: 3 }, { quantity: 4 }] }),
    ).toBe(7)
    expect(
      productStockTotal({ ...base, isCreateMode: true, hasVariants: true, pendingVariants: [{ quantity: 2 }, { quantity: 9 }] }),
    ).toBe(11)
  })

  it('sums saved variants, then the variant total, then falls back to 0', () => {
    expect(productStockTotal({ ...base, hasVariants: true, variants: [{ quantity: 15 }, { quantity: 9 }] })).toBe(24)
    expect(productStockTotal({ ...base, hasVariants: true, variantStockTotal: 24 })).toBe(24)
    expect(productStockTotal({ ...base, hasVariants: true })).toBe(0)
  })

  it('uses the form quantity for a simple product', () => {
    expect(productStockTotal(base)).toBe(5)
  })
})
