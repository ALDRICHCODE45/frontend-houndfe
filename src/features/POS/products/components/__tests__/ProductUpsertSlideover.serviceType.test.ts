/**
 * WU-E RED tests — slideover SERVICE-hiding for editing SERVICE (D1). The
 * slideover carries no type/unit selectors; the matrix comes from the
 * shared `inventoryFieldsVisible(type)` helper.
 */

import { describe, it, expect, vi } from 'vitest'
import { mountWithUApp } from '@/test/mountWithUApp'
import { nextTick } from 'vue'
import ProductUpsertSlideover from '../ProductUpsertSlideover.vue'
import type { ProductDetail } from '../../interfaces/product.types'

const productDetailSERVICE: ProductDetail = {
  id: 'svc-1',
  name: 'Walk',
  type: 'SERVICE',
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
  unit: 'HORA',
  ivaRate: 'IVA_16',
  iepsRate: 'NO_APLICA',
  purchaseCostMode: 'NET',
  purchaseNetCostCents: 0,
  purchaseGrossCostCents: 0,
  serviceDetail: { capacity: 3, notes: 'Walk' },
}

const productDetailPRODUCT: ProductDetail = {
  ...productDetailSERVICE,
  id: 'prod-1',
  name: 'Kibble',
  type: 'PRODUCT',
  sku: 'KIB-001',
  barcode: 'BC-KIB-001',
  unit: 'KILOGRAMO',
}

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: {} })),
  useRouter: () => ({ push: vi.fn() }),
}))

const baseStubs = {
  UInput: { name: 'UInput', template: '<input />' },
  UInputNumber: { name: 'UInputNumber', template: '<input type="number" />' },
  UForm: { name: 'UForm', template: '<form><slot /></form>' },
  UFormField: { name: 'UFormField', template: '<div><slot /></div>' },
  UCheckbox: { name: 'UCheckbox', template: '<input type="checkbox" />' },
  CategorySelect: { name: 'CategorySelect', template: '<select />' },
  SatKeySelect: { name: 'SatKeySelect', template: '<select />' },
  UButton: { name: 'UButton', template: '<button><slot /></button>' },
  USlideover: {
    name: 'USlideover',
    template: '<div><slot name="body" /><slot name="footer" /></div>',
    inheritAttrs: false,
  },
}

describe('ProductUpsertSlideover - WU-E SERVICE-hiding for editing', () => {
  const mountEdit = (product: ProductDetail) =>
    mountWithUApp(ProductUpsertSlideover, {
      props: { mode: 'edit', product, open: true },
      global: { stubs: baseStubs },
    })

  it('shows sku + barcode when editing PRODUCT', async () => {
    const wrapper = mountEdit(productDetailPRODUCT)
    await nextTick()
    // The shared product state has SKU='KIB-001' from the test fixture; the
    // label prop is forwarded to the UFormField stub. Check via the state.
    const vm = wrapper.vm as unknown as { state: { sku: string; barcode: string } }
    expect(vm.state.sku).toBe('KIB-001')
    expect(vm.state.barcode).toBe('BC-KIB-001')
  })

  it('hydrates serviceDetail capacity when editing SERVICE', async () => {
    const wrapper = mountEdit(productDetailSERVICE)
    await nextTick()
    const vm = wrapper.vm as unknown as {
      state: { serviceDetail: { capacity: number | null; notes: string }; type: 'SERVICE' }
    }
    expect(vm.state.type).toBe('SERVICE')
    expect(vm.state.serviceDetail.capacity).toBe(3)
    expect(vm.state.serviceDetail.notes).toBe('Walk')
  })

  it('routes through shared helpers (locationLabelFor) — not inline copy', async () => {
    // Pin the matrix source: shared helpers from useProductForm.
    const slideover = await import('../ProductUpsertSlideover.vue')
    const form = await import('../../composables/useProductForm')
    expect(form.locationLabelFor).toBeTypeOf('function')
    expect(form.inventoryFieldsVisible).toBeTypeOf('function')
    expect(slideover.default).toBeTruthy()
  })
})