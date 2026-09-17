/**
 * WU-C RED tests — type-aware create/update payloads. SERVICE branch lands
 * here; PRODUCT branch unchanged from WU-A. `toUpdatePayload` builds the base
 * SERVICE/PRODUCT payload directly (no create-only advanced fields) and
 * applies changed-only diff via toProductPatchAdvancedCatalogPayload.
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

  // REQ-13: without pristineAdvanced, update emits no advanced keys but preserves
  // SERVICE hygiene/core fields exactly.
  it('toUpdatePayload without pristineAdvanced preserves SERVICE hygiene and omits advanced keys', () => {
    const values = makeFormValues({ type: 'SERVICE' })
    const payload = toUpdatePayload(values) as unknown as Record<string, unknown>

    expect(payload).not.toHaveProperty('sku')
    expect(payload).not.toHaveProperty('barcode')
    expect(payload).not.toHaveProperty('brandId')
    expect(payload).not.toHaveProperty('purchaseCost')
    expect(payload).not.toHaveProperty('supportsAllCatalogPriceLists')
    expect(payload).not.toHaveProperty('hidePriceInOnlineCatalog')
    expect(payload).not.toHaveProperty('supportedCatalogPriceListIds')
    expect(payload).not.toHaveProperty('onlineStockPresentation')
    expect(payload).not.toHaveProperty('onlineStockPresentationCustomQty')
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

/**
 * REQ-13 acceptance: product create/update advanced catalog fields must round-trip.
 * These tests exercise `toCreatePayload` directly with real PRODUCT/SERVICE form values.
 * Expected RED: current buildBasePayload and buildServicePayload omit all four advanced
 * catalog keys (hidePriceInOnlineCatalog, supportedCatalogPriceListIds,
 * onlineStockPresentation, onlineStockPresentationCustomQty).
 */
describe('REQ-13 · toCreatePayload advanced catalog fields — PRODUCT matrix', () => {
  const makeProductForm = (overrides: Partial<ProductFormInput> = {}): ProductFormInput =>
    makeFormValues({ type: 'PRODUCT', hasVariants: false, useStock: true, ...overrides })

  it('REQUIRES hidePriceInOnlineCatalog in PRODUCT create payload', () => {
    const values = makeProductForm({ hidePriceInOnlineCatalog: true })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('hidePriceInOnlineCatalog')
    expect(payload.hidePriceInOnlineCatalog).toBe(true)
  })

  it('REQUIRES supportedCatalogPriceListIds (non-empty) in PRODUCT create payload', () => {
    const values = makeProductForm({ supportedCatalogPriceListIds: ['pl-1', 'pl-2'] })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('supportedCatalogPriceListIds')
    expect(payload.supportedCatalogPriceListIds).toEqual(['pl-1', 'pl-2'])
  })

  it('REQUIRES supportedCatalogPriceListIds ([]) in PRODUCT create payload', () => {
    const values = makeProductForm({ supportedCatalogPriceListIds: [] })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('supportedCatalogPriceListIds')
    expect(payload.supportedCatalogPriceListIds).toEqual([])
  })

  it('REQUIRES onlineStockPresentation in PRODUCT create payload', () => {
    const values = makeProductForm({ onlineStockPresentation: 'SYSTEM_STATUS' })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('onlineStockPresentation')
    expect(payload.onlineStockPresentation).toBe('SYSTEM_STATUS')
  })

  it('REQUIRES onlineStockPresentationCustomQty literal 0 in PRODUCT create payload', () => {
    const values = makeProductForm({
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
    })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('onlineStockPresentationCustomQty')
    // Must preserve literal 0, not coerce to null
    expect(payload.onlineStockPresentationCustomQty).toBe(0)
  })

  it('NEVER sends supportsAllCatalogPriceLists in PRODUCT create payload', () => {
    const values = makeProductForm({
      supportedCatalogPriceListIds: [],
    })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('supportsAllCatalogPriceLists')
  })
})

describe('REQ-13 · toCreatePayload advanced catalog fields — SERVICE matrix', () => {
  const makeServiceForm = (overrides: Partial<ProductFormInput> = {}): ProductFormInput =>
    makeFormValues({ type: 'SERVICE', hasVariants: true, ...overrides })

  it('REQUIRES hidePriceInOnlineCatalog in SERVICE create payload', () => {
    const values = makeServiceForm({ hidePriceInOnlineCatalog: true })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('hidePriceInOnlineCatalog')
    expect(payload.hidePriceInOnlineCatalog).toBe(true)
  })

  it('REQUIRES supportedCatalogPriceListIds (non-empty) in SERVICE create payload', () => {
    const values = makeServiceForm({ supportedCatalogPriceListIds: ['pl-1'] })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('supportedCatalogPriceListIds')
    expect(payload.supportedCatalogPriceListIds).toEqual(['pl-1'])
  })

  it('REQUIRES supportedCatalogPriceListIds ([]) in SERVICE create payload', () => {
    const values = makeServiceForm({ supportedCatalogPriceListIds: [] })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('supportedCatalogPriceListIds')
    expect(payload.supportedCatalogPriceListIds).toEqual([])
  })

  it('REQUIRES onlineStockPresentation in SERVICE create payload', () => {
    const values = makeServiceForm({ onlineStockPresentation: 'ABSTRACT_STATUS' })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('onlineStockPresentation')
    expect(payload.onlineStockPresentation).toBe('ABSTRACT_STATUS')
  })

  it('REQUIRES onlineStockPresentationCustomQty literal 0 in SERVICE create payload', () => {
    const values = makeServiceForm({
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
    })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).toHaveProperty('onlineStockPresentationCustomQty')
    expect(payload.onlineStockPresentationCustomQty).toBe(0)
  })

  it('NEVER sends supportsAllCatalogPriceLists in SERVICE create payload', () => {
    const values = makeServiceForm({ supportedCatalogPriceListIds: [] })
    const payload = toCreatePayload(values) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('supportsAllCatalogPriceLists')
  })
})

/**
 * Derived-field omission checks: these pass independently of the REQ-13 RED above.
 * They verify that the derived `supportsAllCatalogPriceLists` key is never emitted
 * in create payloads, regardless of the advanced-field round-trip status.
 */
describe('Derived-field omission · create payloads never emit supportsAllCatalogPriceLists', () => {
  it('PRODUCT toCreatePayload omits supportsAllCatalogPriceLists', () => {
    const payload = toCreatePayload(
      makeFormValues({ type: 'PRODUCT', hasVariants: false, supportedCatalogPriceListIds: [] }),
    ) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('supportsAllCatalogPriceLists')
  })

  it('SERVICE toCreatePayload omits supportsAllCatalogPriceLists', () => {
    const payload = toCreatePayload(
      makeFormValues({ type: 'SERVICE', hasVariants: true, supportedCatalogPriceListIds: ['pl-1'] }),
    ) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('supportsAllCatalogPriceLists')
  })
})
