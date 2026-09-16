/**
 * WU-C RED tests — type-aware create/update payloads. SERVICE branch lands
 * here; PRODUCT branch unchanged from WU-A. `toUpdatePayload` delegates to
 * `toCreatePayload`, so updating a SERVICE follows the same hygiene.
 */

import { describe, expect, it } from 'vitest'
import {
  productFormSchema,
  toCreatePayload,
  toUpdatePayload,
} from '../useProductForm'
import type { ProductAdvancedCatalogForm } from '../../interfaces/product.types'
import type { ProductFormInput } from '../../interfaces/product.types'

function makeFormValues(overrides: Partial<ProductFormInput> = {}): ProductFormInput {
  return {
    name: 'Walk',
    type: 'SERVICE',
    sku: 'WALK-001',
    barcode: 'BC-WALK-001',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    description: 'A friendly walk',
    location: 'Patio',
    satKey: '',
    unit: 'HORA',
    price: '199.00',
    quantity: 5,
    minQuantity: 2,
    useStock: true,
    useLotsAndExpirations: true,
    hasVariants: true,
    sellInPos: true,
    includeInOnlineCatalog: true,
    requiresPrescription: false,
    chargeProductTaxes: true,
    ivaRate: 'IVA_16',
    iepsRate: 'NO_APLICA',
    purchaseCostMode: 'NET',
    purchaseCost: '50.00',
    hidePriceInOnlineCatalog: false,
    supportedCatalogPriceListIds: [],
    onlineStockPresentation: null,
    onlineStockPresentationCustomQty: null,
    serviceDetail: { capacity: null, notes: '' },
    ...overrides,
  }
}

describe('WU-C · toCreatePayload SERVICE branch', () => {
  it('omits sku, barcode, brandId and purchaseCost for SERVICE', () => {
    const values = makeFormValues({ type: 'SERVICE' })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>

    expect(payload).not.toHaveProperty('sku')
    expect(payload).not.toHaveProperty('barcode')
    expect(payload).not.toHaveProperty('brandId')
    expect(payload).not.toHaveProperty('purchaseCost')
    expect(payload).not.toHaveProperty('lots')
  })

  it('forces useStock=false, useLotsAndExpirations=false, quantity=0, minQuantity=0 for SERVICE', () => {
    const values = makeFormValues({
      type: 'SERVICE',
      useStock: true,
      useLotsAndExpirations: true,
      quantity: 99,
      minQuantity: 5,
    })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>

    expect(payload.useStock).toBe(false)
    expect(payload.useLotsAndExpirations).toBe(false)
    expect(payload.quantity).toBe(0)
    expect(payload.minQuantity).toBe(0)
  })

  it('includes serviceDetail only when populated for SERVICE', () => {
    const empty = toCreatePayload(
      makeFormValues({ type: 'SERVICE', serviceDetail: { capacity: null, notes: '' } }),
    ) as unknown as Record<string, unknown>
    expect(empty).not.toHaveProperty('serviceDetail')

    const populated = toCreatePayload(
      makeFormValues({ type: 'SERVICE', serviceDetail: { capacity: 5, notes: 'Walk' } }),
    ) as unknown as Record<string, unknown>
    expect(populated.serviceDetail).toEqual({ capacity: 5, notes: 'Walk' })
  })

  it('trims whitespace-only serviceDetail.notes to null', () => {
    const payload = toCreatePayload(
      makeFormValues({ type: 'SERVICE', serviceDetail: { capacity: null, notes: '   ' } }),
    ) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('serviceDetail')
  })

  it('keeps PRODUCT payload unchanged for stock/lots/quantity/minQuantity', () => {
    const values = makeFormValues({
      type: 'PRODUCT',
      useStock: true,
      useLotsAndExpirations: false,
      hasVariants: false,
      quantity: 12,
      minQuantity: 3,
    })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>

    expect(payload.useStock).toBe(true)
    expect(payload.useLotsAndExpirations).toBe(false)
    expect(payload.quantity).toBe(12)
    expect(payload.minQuantity).toBe(3)
  })

  it('toUpdatePayload delegates to toCreatePayload (same shape for SERVICE)', () => {
    const values = makeFormValues({ type: 'SERVICE' })
    const updatePayload = toUpdatePayload(values) as unknown as Record<string, unknown>
    const createPayload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(updatePayload).toEqual(createPayload)
  })
})
describe('WU4 · toUpdatePayload advanced catalog diff', () => {
  const pristine: ProductAdvancedCatalogForm = {
    hidePriceInOnlineCatalog: false, supportedCatalogPriceListIds: [], supportsAllCatalogPriceLists: true,
    onlineStockPresentation: null, onlineStockPresentationCustomQty: null,
  }
  const advancedKeysOf = (payload: unknown) => Object.keys(payload as Record<string, unknown>).filter((key) => /^(hidePriceInOnlineCatalog|supportedCatalogPriceListIds|onlineStockPresentation)/.test(key))

  it('emits changed keys only, never supportsAll, independent of field order; no pristine snapshot emits none', () => {
    // Reordered declaration: the emitted key set must stay identical and inside the whitelist.
    const reordered = {
      onlineStockPresentationCustomQty: 0, onlineStockPresentation: 'CUSTOM_QUANTITY',
      supportsAllCatalogPriceLists: true, supportedCatalogPriceListIds: [], hidePriceInOnlineCatalog: true,
    } satisfies ProductAdvancedCatalogForm
    const payload = toUpdatePayload({ ...makeFormValues({ type: 'PRODUCT' }), ...reordered }, pristine)
    expect(advancedKeysOf(payload).sort()).toEqual(['hidePriceInOnlineCatalog', 'onlineStockPresentation', 'onlineStockPresentationCustomQty'])
    expect(payload).toMatchObject({ hidePriceInOnlineCatalog: true, onlineStockPresentationCustomQty: 0 })
    expect(payload).not.toHaveProperty('supportsAllCatalogPriceLists')
    expect(payload).not.toHaveProperty('supportedCatalogPriceListIds')
    expect(advancedKeysOf(toUpdatePayload(makeFormValues({ type: 'PRODUCT', hidePriceInOnlineCatalog: true })))).toEqual([])
  })

  it('preserves custom 0, nulls non-custom quantity, and clears with both stock nulls', () => {
    const customZero = toUpdatePayload(
      makeFormValues({ type: 'PRODUCT', onlineStockPresentation: 'CUSTOM_QUANTITY', onlineStockPresentationCustomQty: 0 }), pristine)
    expect(customZero.onlineStockPresentation).toBe('CUSTOM_QUANTITY')
    expect(customZero.onlineStockPresentationCustomQty).toBe(0)
    const cleared = toUpdatePayload(
      makeFormValues({ type: 'PRODUCT', onlineStockPresentation: null, onlineStockPresentationCustomQty: null }),
      { ...pristine, onlineStockPresentation: 'CUSTOM_QUANTITY', onlineStockPresentationCustomQty: 5 })
    expect(cleared).toHaveProperty('onlineStockPresentation', null)
    expect(cleared).toHaveProperty('onlineStockPresentationCustomQty', null)
    const nonCustom = toUpdatePayload(
      makeFormValues({ type: 'PRODUCT', onlineStockPresentation: 'HIDDEN', onlineStockPresentationCustomQty: null }), pristine)
    expect(nonCustom).toMatchObject({ onlineStockPresentation: 'HIDDEN' })
    expect(nonCustom).not.toHaveProperty('onlineStockPresentationCustomQty')
  })

  it('blocks a null allowlist with Spanish validation while [] stays valid', () => {
    const rejected = productFormSchema.safeParse(
      makeFormValues({ type: 'PRODUCT', supportedCatalogPriceListIds: null as unknown as string[] }))
    expect(rejected.success).toBe(false)
    expect(rejected.error?.issues[0]?.message).toBe('Las listas de precios del catálogo no pueden ser nulas')
    expect(productFormSchema.safeParse(makeFormValues({ type: 'PRODUCT', supportedCatalogPriceListIds: [] })).success).toBe(true)
  })
})
