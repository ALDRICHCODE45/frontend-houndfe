/**
 * WU-C RED tests — type-aware create/update payloads. SERVICE branch lands
 * here; PRODUCT branch unchanged from WU-A. `toUpdatePayload` delegates to
 * `toCreatePayload`, so updating a SERVICE follows the same hygiene.
 */

import { describe, expect, it } from 'vitest'
import { toCreatePayload, toUpdatePayload } from '../useProductForm'
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