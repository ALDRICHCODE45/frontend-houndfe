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

// NOTE: the slideover body/footer render through the document root, so the
// rendered controls are queried through the document. `baseStubs.UCheckbox`
// never matched the globally-registered `Checkbox` component, so the real
// UCheckbox controls (role="checkbox") render and can be asserted.
const slideoverStub = {
  name: 'USlideover',
  props: ['ui'],
  template:
    '<div data-testid="slideover-content" :data-ui-content="ui && ui.content"><slot name="body" /><slot name="footer" /></div>',
  inheritAttrs: false,
}

// Nuxt UI resolves the local component name without the `U` prefix, so both
// keys are declared (mirrors the sibling slideover specs).
const buttonStub = { name: 'UButton', template: '<button><slot /></button>' }

const baseStubs = {
  UInput: { name: 'UInput', template: '<input />' },
  UInputNumber: { name: 'UInputNumber', template: '<input type="number" />' },
  UForm: { name: 'UForm', template: '<form><slot /></form>' },
  UFormField: { name: 'UFormField', template: '<div><slot /></div>' },
  UCheckbox: { name: 'UCheckbox', template: '<input type="checkbox" />' },
  UTextarea: { name: 'UTextarea', template: '<textarea />' },
  CategorySelect: { name: 'CategorySelect', template: '<select />' },
  SatKeySelect: { name: 'SatKeySelect', template: '<select />' },
  UButton: buttonStub,
  Button: buttonStub,
  USlideover: slideoverStub,
  Slideover: slideoverStub,
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
      // The stub renders inline instead of portaling, so attach the tree to
      // the document to keep the rendered controls queryable by the helpers.
      attachTo: document.body,
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

  it('propagates the pilot overlay classes into the teleported slideover content root', () => {
    mountSlide(productDetailPRODUCT, 'edit')

    // The slideover content renders outside the component view tree, so the
    // theme boundary must ride the native Nuxt UI `:ui.content` slot contract
    // instead of a class placed only on the trigger/root element.
    const content = q('[data-testid="slideover-content"]')
    expect(content.attributes('data-ui-content')).toBe(
      'hf-theme hf-ui hf-form-overlay products-visual hf-shell-products-portal',
    )
  })

  it('forwards the products portal hook into the real installed slideover content and nested category dropdown', async () => {
    mountWithUApp(ProductUpsertSlideover, {
      props: { mode: 'edit', product: productDetailPRODUCT, open: true },
      attachTo: document.body,
      global: {
        stubs: {
          UInput: { name: 'UInput', template: '<input />' },
          UInputNumber: { name: 'UInputNumber', template: '<input type="number" />' },
          UForm: { name: 'UForm', template: '<form><slot /></form>' },
          UFormField: { name: 'UFormField', template: '<div><slot /></div>' },
          UCheckbox: { name: 'UCheckbox', template: '<input type="checkbox" />' },
          UTextarea: { name: 'UTextarea', template: '<textarea />' },
          UButton: buttonStub,
          Button: buttonStub,
          SatKeySelect: { name: 'SatKeySelect', template: '<select />' },
        },
      },
    })
    await nextTick()

    const content = document.body.querySelector<HTMLElement>(
      '[data-slot="content"].hf-shell-products-portal',
    )
    expect(content, 'the installed slideover content must carry the portal hook').not.toBeNull()
    expect(content!.classList.contains('hf-theme')).toBe(true)
    expect(content!.classList.contains('hf-ui')).toBe(true)
    expect(content!.classList.contains('products-visual')).toBe(true)

    // CategorySelect renders inline (it does not teleport), so its dropdown
    // inherits the Products portal theme from the slideover content instead
    // of needing a marker hook of its own.
    const categoryTrigger = content!.querySelector<HTMLElement>('button.products-select-trigger')
    expect(categoryTrigger).not.toBeNull()
    await new DOMWrapper(categoryTrigger!).trigger('click')
    await nextTick()
    expect(
      content!.querySelector('[class*="z-[80]"]'),
      'nested category dropdown must inherit the portal marker',
    ).not.toBeNull()
  })

  it('hooks the footer submit button with the shared primary control class and no gold/black overrides', () => {
    mountSlide(productDetailPRODUCT, 'edit')

    const submit = q('.hf-primary-control')
    expect(submit.attributes('type')).toBe('submit')
    expect(submit.attributes('form')).toBe('edit-product-form')
    expect(submit.attributes('color')).toBe('primary')
    // The legacy hardcoded gold background / black foreground are gone.
    expect(submit.attributes('class')).not.toContain('brand-action')
    expect(submit.attributes('class')).not.toContain('text-black')
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
