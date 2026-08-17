/**
 * WU-A RED tests — shared matrix helpers in `useProductForm.ts`. Pure-function
 * snapshot (no Vue/Pinia/QueryClient mount).
 *
 * R-201 lineage: these tests lock the helpers so the form surface and the
 * 3 variant render points cannot drift apart.
 */

import { describe, expect, it } from 'vitest'
import {
  inventoryFieldsVisible,
  isService,
  locationLabelFor,
  SERVICE_UNIT_OPTIONS,
  serviceDetailPopulated,
  unitOptionsFor,
  productToFormInput,
} from '../useProductForm'
import type { ProductDetail } from '../../interfaces/product.types'

describe('WU-A · isService / unitOptionsFor / locationLabelFor / inventoryFieldsVisible', () => {
  it('isService is true only for SERVICE', () => {
    expect(isService('SERVICE')).toBe(true)
    expect(isService('PRODUCT')).toBe(false)
  })

  it('unitOptionsFor returns exactly 8 PRODUCT values', () => {
    const options = unitOptionsFor('PRODUCT')
    expect(options).toHaveLength(8)
    const values = options.map((o) => o.value).sort()
    expect(values).toEqual([
      'BOLSA',
      'CAJA',
      'CENTIMETRO',
      'GRAMO',
      'KILOGRAMO',
      'LITRO',
      'METRO',
      'UNIDAD',
    ])
  })

  it('unitOptionsFor returns exactly 6 SERVICE values', () => {
    const options = unitOptionsFor('SERVICE')
    expect(options).toHaveLength(6)
    const values = options.map((o) => o.value).sort()
    expect(values).toEqual(['CONSULTA', 'CURSO', 'DIA', 'HORA', 'PAQUETE', 'SESION'])
    expect(SERVICE_UNIT_OPTIONS).toHaveLength(6)
  })

  it('locationLabelFor switches between SERVICE and PRODUCT', () => {
    expect(locationLabelFor('SERVICE')).toBe('Zona de servicio')
    expect(locationLabelFor('PRODUCT')).toBe('Ubicación en almacén')
  })

  it('inventoryFieldsVisible gates 3 variant render points', () => {
    expect(inventoryFieldsVisible('PRODUCT')).toBe(true)
    expect(inventoryFieldsVisible('SERVICE')).toBe(false)
  })
})

describe('WU-A · serviceDetailPopulated', () => {
  it('returns false when both capacity and notes are empty', () => {
    expect(serviceDetailPopulated({ capacity: null, notes: null })).toBe(false)
    expect(serviceDetailPopulated({ capacity: null, notes: '' })).toBe(false)
    expect(serviceDetailPopulated({ capacity: null, notes: '   ' })).toBe(false)
  })

  it('returns true when capacity is set (even without notes)', () => {
    expect(serviceDetailPopulated({ capacity: 3, notes: null })).toBe(true)
    expect(serviceDetailPopulated({ capacity: 1, notes: '' })).toBe(true)
  })

  it('returns true when notes are non-empty after trim', () => {
    expect(serviceDetailPopulated({ capacity: null, notes: 'lead walk' })).toBe(true)
    expect(serviceDetailPopulated({ capacity: null, notes: '  lead walk  ' })).toBe(true)
  })
})

describe('WU-A · productToFormInput maps serviceDetail', () => {
  it('maps serviceDetail from ProductDetail (capacity integer + notes trimmed)', () => {
    const detail: ProductDetail = {
      id: 'svc-1',
      name: 'Walk',
      sku: null,
      barcode: null,
      categoryId: 'cat-1',
      categoryName: 'Pet',
      brandId: null,
      brandName: 'Sin marca',
      priceCents: 19900,
      quantity: 0,
      minQuantity: 0,
      useStock: false,
      hasVariants: true,
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
      description: null,
      location: null,
      satKey: null,
      type: 'SERVICE',
      unit: 'HORA',
      ivaRate: 'IVA_16',
      iepsRate: 'NO_APLICA',
      purchaseCostMode: 'NET',
      purchaseNetCostCents: 0,
      purchaseGrossCostCents: 0,
      serviceDetail: { capacity: 5, notes: '  Servicio de paseo  ' },
    }

    const formInput = productToFormInput(detail)
    expect(formInput.serviceDetail).toEqual({ capacity: 5, notes: 'Servicio de paseo' })
  })

  it('maps serviceDetail null for PRODUCT', () => {
    const detail: ProductDetail = {
      id: 'prod-1',
      name: 'Collar',
      sku: 'COL-001',
      barcode: null,
      categoryId: 'cat-1',
      categoryName: 'Pet',
      brandId: null,
      brandName: 'Sin marca',
      priceCents: 9900,
      quantity: 10,
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
      description: null,
      location: null,
      satKey: null,
      type: 'PRODUCT',
      unit: 'UNIDAD',
      ivaRate: 'IVA_16',
      iepsRate: 'NO_APLICA',
      purchaseCostMode: 'NET',
      purchaseNetCostCents: 0,
      purchaseGrossCostCents: 0,
      serviceDetail: null,
    }
    const formInput = productToFormInput(detail)
    expect(formInput.serviceDetail).toEqual({ capacity: null, notes: '' })
  })
})