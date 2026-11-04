/**
 * O1 S1 — quantity is read-only on edit. No edit PATCH carries `quantity`
 * (the backend answers 400 STOCK_QUANTITY_READ_ONLY if it does); creation
 * still sends it and records it as INITIAL.
 */

import { describe, expect, it } from 'vitest'
import { toCreatePayload, toUpdatePayload } from '../useProductForm'
import type { ProductAdvancedCatalogForm, ProductFormInput } from '../../interfaces/product.types'

function makeValues(overrides: Partial<ProductFormInput> = {}): ProductFormInput {
  return {
    name: 'Croquetas',
    type: 'PRODUCT',
    sku: 'CRO-1',
    barcode: '',
    categoryId: '',
    brandId: '',
    description: '',
    location: '',
    satKey: '',
    unit: 'KILOGRAMO',
    price: '199.00',
    quantity: 42,
    minQuantity: 3,
    useStock: true,
    useLotsAndExpirations: false,
    hasVariants: false,
    sellInPos: true,
    includeInOnlineCatalog: true,
    requiresPrescription: false,
    chargeProductTaxes: true,
    ivaRate: 'IVA_16',
    iepsRate: 'NO_APLICA',
    purchaseCostMode: 'NET',
    purchaseCost: '',
    hidePriceInOnlineCatalog: false,
    supportedCatalogPriceListIds: [],
    onlineStockPresentation: null,
    onlineStockPresentationCustomQty: null,
    serviceDetail: { capacity: null, notes: '' },
    ...overrides,
  }
}

const pristine: ProductAdvancedCatalogForm = {
  hidePriceInOnlineCatalog: false,
  supportedCatalogPriceListIds: [],
  supportsAllCatalogPriceLists: true,
  onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null,
}

describe('O1 · toUpdatePayload never sends quantity', () => {
  it.each([
    ['a PRODUCT with stock', makeValues()],
    ['a PRODUCT quantity 0', makeValues({ quantity: 0 })],
    ['a SERVICE', makeValues({ type: 'SERVICE' })],
    ['a PRODUCT with lots', makeValues({ useLotsAndExpirations: true })],
    ['a PRODUCT with variants', makeValues({ hasVariants: true })],
    ['stock tracking off', makeValues({ useStock: false })],
  ])('omits the quantity key for %s', (_label, values) => {
    expect(toUpdatePayload(values)).not.toHaveProperty('quantity')
    expect(toUpdatePayload(values, pristine)).not.toHaveProperty('quantity')
  })

  it('still sends the other stock fields (minQuantity, useStock)', () => {
    const payload = toUpdatePayload(makeValues())
    expect(payload.minQuantity).toBe(3)
    expect(payload.useStock).toBe(true)
  })

  it('keeps sending quantity when the product is created', () => {
    expect(toCreatePayload(makeValues()).quantity).toBe(42)
    expect(toCreatePayload(makeValues({ type: 'SERVICE' })).quantity).toBe(0)
  })
})
