/**
 * Shipping T4 (S3) — ProductDetailView: «Empaque para envío» lives in
 * Presentaciones next to Variantes, only for a saved product (never a service,
 * never while creating), and each saved variant opens its packaging from ⋮.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'
import ProductVariantsTable from '../../components/ProductVariantsTable.vue'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const route = vi.hoisted(() => vi.fn(() => ({ params: { id: 'prod-1' } as Record<string, string> })))
vi.mock('vue-router', () => ({
  useRoute: route,
  useRouter: () => ({ push: vi.fn() }),
}))

const grants = await vi.hoisted(async () => (await import('vue')).reactive({ update: true }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    currentTenantId: 'tenant-1',
    authPhase: 'authenticated',
    permissionsLoaded: true,
    userCan: (action: string, resource: string) => {
      if (resource === 'Product' && action === 'update') return grants.update
      return resource !== 'TenantCatalogSettings' && resource !== 'InventoryJournal'
    },
  }),
}))

// Both have their own specs; here they only need their inputs.
vi.mock('../../components/ProductPackagingSection.vue', () => ({
  default: defineComponent({
    name: 'ProductPackagingSection',
    props: { productId: { type: String, required: true }, canUpdate: Boolean },
    setup: (props) => () =>
      h('section', {
        'data-testid': 'packaging-section-stub',
        'data-product-id': props.productId,
        'data-can-update': String(props.canUpdate),
      }),
  }),
}))
vi.mock('../../components/VariantPackagingModal.vue', () => ({
  default: defineComponent({
    name: 'VariantPackagingModal',
    props: {
      open: Boolean,
      productId: String,
      variantId: String,
      variantLabel: String,
      canUpdate: Boolean,
    },
    setup: (props) => () =>
      props.open
        ? h('div', {
            'data-testid': 'variant-packaging-stub',
            'data-variant-id': props.variantId,
            'data-label': props.variantLabel,
            'data-can-update': String(props.canUpdate),
          })
        : null,
  }),
}))

const api = vi.hoisted(() => ({ getById: vi.fn(), getVariants: vi.fn() }))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      getById: api.getById,
      getVariants: api.getVariants,
      getCategories: vi.fn(async () => []),
      getBrands: vi.fn(async () => []),
      getGlobalPriceLists: vi.fn(async () => []),
      getLots: vi.fn(async () => []),
      getPriceLists: vi.fn(async () => []),
    },
  }
})

const product = {
  id: 'prod-1', name: 'Arnés', type: 'PRODUCT', sku: 'ARN-1', barcode: '', categoryId: '', brandId: '',
  description: '', location: '', satKey: '', unit: 'UNIDAD', priceCents: 1000, quantity: 50, minQuantity: 2,
  useStock: true, useLotsAndExpirations: false, hasVariants: true, sellInPos: true,
  includeInOnlineCatalog: true, requiresPrescription: false, chargeProductTaxes: true, ivaRate: 'IVA_16',
  iepsRate: 'NO_APLICA', purchaseCostMode: 'NET', purchaseNetCostCents: 0, purchaseGrossCostCents: 0,
  status: 'active', createdAt: '2026-04-23T00:00:00.000Z', updatedAt: '2026-04-23T00:00:00.000Z',
}
const variant = {
  id: 'var-grande', productId: 'prod-1', name: 'Grande', option: 'Tamaño', value: 'Grande', sku: '', barcode: '',
  priceCents: 1000, quantity: 3, minQuantity: 0, purchaseNetCostCents: null, purchaseNetCostDecimal: null,
  variantPrices: [], catalogPublishMode: 'INHERIT', onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null, createdAt: '2026-04-23T00:00:00.000Z', updatedAt: '2026-04-23T00:00:00.000Z',
}

let queryClient: QueryClient
let root: VueWrapper | undefined

async function mountView(params: Record<string, string> = { id: 'prod-1' }) {
  route.mockReturnValue({ params })
  root = mount(
    defineComponent({ render: () => h(UApp, null, { default: () => h(ProductDetailView as Component) }) }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('input[name="name"]')).not.toBeNull())
  return root.findComponent(ProductDetailView as Component)
}

beforeEach(() => {
  grants.update = true
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  api.getById.mockReset().mockResolvedValue(product)
  api.getVariants.mockReset().mockResolvedValue([variant])
})

afterEach(() => {
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

describe('ProductDetailView — packaging in Presentaciones', () => {
  it('shows the section for a saved product, inside Presentaciones', async () => {
    const view = await mountView()
    const section = view.get('[data-testid="packaging-section-stub"]')
    expect(section.attributes('data-product-id')).toBe('prod-1')
    expect(section.attributes('data-can-update')).toBe('true')
    expect(section.element.closest('[data-product-task="presentations"]')).not.toBeNull()
  })

  it('passes the update:Product grant down (read-only without it)', async () => {
    grants.update = false
    const view = await mountView()
    expect(view.get('[data-testid="packaging-section-stub"]').attributes('data-can-update')).toBe('false')
  })

  it('has no packaging for a service, neither section nor variant action', async () => {
    api.getById.mockResolvedValue({ ...product, type: 'SERVICE', useStock: false })
    const view = await mountView()
    expect(view.find('[data-testid="packaging-section-stub"]').exists()).toBe(false)
    expect(view.findComponent(ProductVariantsTable).props('packaging')).toBe(false)
  })

  it('has no packaging while creating', async () => {
    const view = await mountView({})
    expect(view.find('[data-testid="packaging-section-stub"]').exists()).toBe(false)
  })

  it('the ⋮ «Empaque» of a saved variant opens its packaging by name', async () => {
    const view = await mountView()
    const table = view.findComponent(ProductVariantsTable)
    expect(table.props('packaging')).toBe(true)
    table.vm.$emit('action', 'packaging', 'var-grande')
    await flushPromises()
    const modal = view.get('[data-testid="variant-packaging-stub"]')
    expect(modal.attributes('data-variant-id')).toBe('var-grande')
    expect(modal.attributes('data-label')).toBe('Tamaño: Grande')
    expect(modal.attributes('data-can-update')).toBe('true')
  })
})
