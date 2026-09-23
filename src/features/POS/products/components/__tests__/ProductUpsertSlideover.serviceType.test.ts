/**
 * WU-E behavioral tests — slideover SERVICE-hiding for editing SERVICE (D1).
 * Asserts the computed that drives the v-if gates (`showInventoryFields`) and
 * the dynamic location label, so the hide/show decision is pinned per type
 * (SERVICE edit hides; PRODUCT edit and create show).
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
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

// NOTE: the USlideover body is portaled into <body> by Nuxt UI, so the
// rendered controls are queried through the document. `baseStubs.UCheckbox`
// never matched the globally-registered `Checkbox` component, so the real
// UCheckbox controls (role="checkbox") render and can be asserted.
const baseStubs = {
  UInput: { name: 'UInput', template: '<input />' },
  UInputNumber: { name: 'UInputNumber', template: '<input type="number" />' },
  UForm: { name: 'UForm', template: '<form><slot /></form>' },
  UFormField: { name: 'UFormField', template: '<div><slot /></div>' },
  UCheckbox: { name: 'UCheckbox', template: '<input type="checkbox" />' },
  UTextarea: { name: 'UTextarea', template: '<textarea />' },
  CategorySelect: { name: 'CategorySelect', template: '<select />' },
  SatKeySelect: { name: 'SatKeySelect', template: '<select />' },
  UButton: { name: 'UButton', template: '<button><slot /></button>' },
  USlideover: {
    name: 'USlideover',
    template: '<div><slot name="body" /><slot name="footer" /></div>',
    inheritAttrs: false,
  },
}

// Nuxt UI teleports the real USlideover body into <body>, so the rendered
// controls are queried through the document (the vm assertions stay on the
// component wrapper). Clearing <body> keeps each test's portal fresh.
const q = (selector: string) => new DOMWrapper(document.querySelector(selector)!)

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('ProductUpsertSlideover - WU-E SERVICE-hiding (behavioral)', () => {
  const mountSlide = (product: ProductDetail | null, mode: 'create' | 'edit') =>
    mountWithUApp(ProductUpsertSlideover, {
      props: { mode, product, open: true },
      global: { stubs: baseStubs },
    })

  it('hides inventory/identifier fields when editing SERVICE', async () => {
    const wrapper = mountSlide(productDetailSERVICE, 'edit')
    await nextTick()
    const vm = wrapper.vm as unknown as { showInventoryFields: boolean; locationLabel: string }
    // The v-if gate for sku/barcode/stock/minStock/useStock/brand must be false.
    expect(vm.showInventoryFields).toBe(false)
    expect(vm.locationLabel).toBe('Zona de servicio')
  })

  it('shows inventory/identifier fields when editing PRODUCT', async () => {
    const wrapper = mountSlide(productDetailPRODUCT, 'edit')
    await nextTick()
    const vm = wrapper.vm as unknown as { showInventoryFields: boolean }
    expect(vm.showInventoryFields).toBe(true)
  })

  it('shows fields in create mode (create stays PRODUCT-only)', async () => {
    const wrapper = mountSlide(null, 'create')
    await nextTick()
    const vm = wrapper.vm as unknown as { showInventoryFields: boolean }
    expect(vm.showInventoryFields).toBe(true)
  })

  it('uses dynamic location label per type', async () => {
    const svc = mountSlide(productDetailSERVICE, 'edit')
    await nextTick()
    expect((svc.vm as unknown as { locationLabel: string }).locationLabel).toBe('Zona de servicio')

    const prod = mountSlide(productDetailPRODUCT, 'edit')
    await nextTick()
    expect((prod.vm as unknown as { locationLabel: string }).locationLabel).toBe(
      'Ubicación en almacén',
    )
  })

  it('hydrates serviceDetail when editing SERVICE', async () => {
    const wrapper = mountSlide(productDetailSERVICE, 'edit')
    await nextTick()
    const vm = wrapper.vm as unknown as {
      state: { serviceDetail: { capacity: number | null; notes: string }; type: string }
    }
    expect(vm.state.type).toBe('SERVICE')
    expect(vm.state.serviceDetail.capacity).toBe(3)
    expect(vm.state.serviceDetail.notes).toBe('Walk')
  })

  // U9: only the catalog-specific opt-in becomes a switch; the other product
  // options stay checkboxes so the form semantics and payload are untouched.
  it('renders the catalog opt-in as a labeled switch and keeps the other options as checkboxes', async () => {
    const wrapper = mountSlide(productDetailPRODUCT, 'edit')
    await nextTick()

    const toggle = q('[data-testid="include-in-online-catalog-switch"]')
    const switchRoot = toggle.element.closest('[data-slot="root"]')!
    const label = switchRoot.querySelector('label')!

    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('true')
    expect(label.textContent).toContain('Catálogo online')
    expect(switchRoot.textContent).toContain('El producto se muestra en el catálogo público')
    // The visible label is wired to the rendered switch button.
    expect(label.getAttribute('for')).toBe(toggle.attributes('id'))
    // Usar stock, Vender en POS and Cobrar impuestos remain checkboxes.
    expect(wrapper.findAllComponents({ name: 'Switch' })).toHaveLength(1)
    expect(wrapper.findAllComponents({ name: 'Checkbox' })).toHaveLength(3)
    expect(document.querySelectorAll('[role="checkbox"]')).toHaveLength(3)
  })

  it('toggles the catalog opt-in through the rendered switch', async () => {
    const wrapper = mountSlide(productDetailPRODUCT, 'edit')
    await nextTick()

    await q('[data-testid="include-in-online-catalog-switch"]').trigger('click')
    await nextTick()

    const vm = wrapper.vm as unknown as { state: { includeInOnlineCatalog: boolean } }
    expect(vm.state.includeInOnlineCatalog).toBe(false)
  })
})
