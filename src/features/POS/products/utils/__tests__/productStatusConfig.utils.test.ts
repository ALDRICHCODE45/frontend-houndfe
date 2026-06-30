import { describe, expect, it } from 'vitest'
import {
  getProductStockDisplay,
  getProductStockTone,
  getStockTone,
} from '../productStatusConfig.utils'
import type { Product } from '../../interfaces/product.types'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Alpha',
    sku: 'ALPHA',
    barcode: null,
    categoryId: 'cat-1',
    categoryName: 'Food',
    brandId: 'brand-1',
    brandName: 'Brand',
    priceCents: 1299,
    quantity: 5,
    minQuantity: 1,
    useStock: true,
    hasVariants: false,
    useLotsAndExpirations: false,
    sellInPos: true,
    includeInOnlineCatalog: true,
    requiresPrescription: false,
    chargeProductTaxes: true,
    variantStockTotal: null,
    variantCount: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } satisfies Product
}

describe('getStockTone', () => {
  it('returns error when stock is zero', () => {
    expect(getStockTone(0)).toBe('error')
  })

  it('returns warning at or below the minimum', () => {
    expect(getStockTone(5, 10)).toBe('warning')
    expect(getStockTone(10, 10)).toBe('warning')
  })

  it('returns success above the minimum', () => {
    expect(getStockTone(20, 10)).toBe('success')
  })
})

describe('getProductStockTone (shared source of truth)', () => {
  it('derives tone from quantity for simple products', () => {
    expect(getProductStockTone(makeProduct({ quantity: 0, minQuantity: 1 }))).toBe('error')
    expect(getProductStockTone(makeProduct({ quantity: 1, minQuantity: 5 }))).toBe('warning')
    expect(getProductStockTone(makeProduct({ quantity: 50, minQuantity: 5 }))).toBe('success')
  })

  it('derives tone from the variant total when variants have stock', () => {
    const product = makeProduct({ hasVariants: true, variantStockTotal: 0, variantCount: 3 })
    expect(getProductStockTone(product)).toBe('error')
  })

  it('falls back to info when variants exist without a known total', () => {
    const product = makeProduct({ hasVariants: true, variantStockTotal: null, variantCount: 3 })
    expect(getProductStockTone(product)).toBe('info')
  })
})

describe('getProductStockDisplay (card label) reuses the shared tone', () => {
  it('labels simple stock and matches getProductStockTone', () => {
    const product = makeProduct({ quantity: 7, minQuantity: 2 })
    const display = getProductStockDisplay(product)
    expect(display.label).toBe('7 unidades')
    expect(display.tone).toBe(getProductStockTone(product))
  })

  it('labels variant stock with the correct plural', () => {
    expect(
      getProductStockDisplay(
        makeProduct({ hasVariants: true, variantStockTotal: 12, variantCount: 1 }),
      ).label,
    ).toBe('12 unidades en 1 variante')

    expect(
      getProductStockDisplay(
        makeProduct({ hasVariants: true, variantStockTotal: 12, variantCount: 4 }),
      ).label,
    ).toBe('12 unidades en 4 variantes')
  })

  it('labels variants without a total as "En variantes"', () => {
    const product = makeProduct({ hasVariants: true, variantStockTotal: null, variantCount: 3 })
    const display = getProductStockDisplay(product)
    expect(display.label).toBe('En variantes')
    expect(display.tone).toBe('info')
  })
})
