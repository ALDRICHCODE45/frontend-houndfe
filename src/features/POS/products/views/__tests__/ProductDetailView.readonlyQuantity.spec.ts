/**
 * O1 S1 — ProductDetailView, edit mode: quantity is read-only for the product
 * and its saved variants, and NO edit PATCH (product, variant inline, variant
 * edit modal) carries `quantity`. Create mode still has the input and sends it.
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

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    currentTenantId: 'tenant-1',
    userCan: (_action: string, resource: string) => resource !== 'TenantCatalogSettings',
  }),
}))

const api = vi.hoisted(() => ({
  getById: vi.fn(),
  getVariants: vi.fn(),
  update: vi.fn(),
  updateVariant: vi.fn(),
}))

vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      getById: api.getById,
      getVariants: api.getVariants,
      update: api.update,
      updateVariant: api.updateVariant,
      getCategories: vi.fn(async () => []),
      getBrands: vi.fn(async () => []),
      getGlobalPriceLists: vi.fn(async () => []),
      getLots: vi.fn(async () => []),
      getPriceLists: vi.fn(async () => []),
    },
  }
})

const baseProduct = {
  id: 'prod-1',
  name: 'Croquetas',
  type: 'PRODUCT',
  sku: 'CRO-1',
  barcode: '',
  categoryId: '',
  brandId: '',
  description: '',
  location: '',
  satKey: '',
  unit: 'UNIDAD',
  priceCents: 1000,
  quantity: 50,
  minQuantity: 2,
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
  purchaseNetCostCents: 0,
  purchaseGrossCostCents: 0,
  status: 'active',
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
}

const variant = (id: string, value: string, quantity: number) => ({
  id,
  productId: 'prod-1',
  name: value,
  option: 'Talla',
  value,
  sku: `SKU-${id}`,
  barcode: '',
  priceCents: 1000,
  quantity,
  minQuantity: 1,
  purchaseNetCostCents: null,
  purchaseNetCostDecimal: null,
  variantPrices: [],
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
})

let queryClient: QueryClient
let root: VueWrapper | undefined

async function mountView(params: Record<string, string> = { id: 'prod-1' }) {
  route.mockReturnValue({ params })
  root = mount(
    defineComponent({
      render: () => h(UApp, null, { default: () => h(ProductDetailView as Component) }),
    }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('input[name="name"]')).not.toBeNull())
  return root.findComponent(ProductDetailView as Component)
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  api.getById.mockReset().mockResolvedValue(baseProduct)
  api.getVariants.mockReset().mockResolvedValue([])
  api.update.mockReset().mockResolvedValue(baseProduct)
  api.updateVariant.mockReset().mockResolvedValue({ id: 'v1' })
})

afterEach(() => {
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

describe('ProductDetailView — read-only quantity on edit', () => {
  it('shows the product stock as a figure with the hint, with no input', async () => {
    const view = await mountView()
    const stock = view.get('[data-testid="product-detail-stock-readonly"]')
    expect(stock.text()).toContain('50')
    expect(stock.text()).toContain('Se ajusta desde Inventario')
    // Only the minimum stock stays editable in that grid.
    expect(view.text()).toContain('Existencias mínimas')
  })

  it('saves the product with a PATCH that has no quantity', async () => {
    const view = await mountView()
    await view.get('input[name="name"]').setValue('Croquetas Premium')
    ;(view.get('#product-detail-form').element as HTMLFormElement).requestSubmit()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(1))
    const [id, payload] = api.update.mock.calls[0]!
    expect(id).toBe('prod-1')
    expect(payload).toMatchObject({ name: 'Croquetas Premium', minQuantity: 2 })
    expect(payload).not.toHaveProperty('quantity')
  })

  describe('with variants', () => {
    beforeEach(() => {
      api.getById.mockResolvedValue({ ...baseProduct, hasVariants: true, quantity: 24 })
      api.getVariants.mockResolvedValue([variant('v1', 'Chico', 15), variant('v2', 'Mediano', 9)])
    })

    it('lists each variant stock read-only, so there is no inline stock edit to blur', async () => {
      const view = await mountView()
      const cells = view.findAll('[data-testid="variant-stock-readonly"]')
      expect(cells.map((cell) => cell.text())).toEqual([
        expect.stringContaining('15'),
        expect.stringContaining('9'),
      ])
      expect(view.find('input[aria-label^="Existencias de"]').exists()).toBe(false)
      // A stray commit from the table (what the old blur emitted) sends nothing.
      view.findComponent(ProductVariantsTable).vm.$emit('commit-quantity', 'v1')
      await flushPromises()
      expect(api.updateVariant).not.toHaveBeenCalled()
    })

    it('edits a saved variant without quantity: read-only figure and a PATCH without the key', async () => {
      const view = await mountView()
      view.findComponent(ProductVariantsTable).vm.$emit('action', 'edit', 'v1')
      await flushPromises()
      const stock = document.querySelector('[data-testid="variant-edit-stock-readonly"]')!
      expect(stock.textContent).toContain('15')
      expect(stock.textContent).toContain('Se ajusta desde Inventario')
      ;(document.getElementById('variant-modal-form') as HTMLFormElement).requestSubmit()
      await vi.waitFor(() => expect(api.updateVariant).toHaveBeenCalledTimes(1))
      const [productId, variantId, payload] = api.updateVariant.mock.calls[0]!
      expect([productId, variantId]).toEqual(['prod-1', 'v1'])
      expect(payload).toMatchObject({ option: 'Talla', value: 'Chico', minQuantity: 1 })
      expect(payload).not.toHaveProperty('quantity')
    })
  })
})

describe('ProductDetailView — create mode keeps quantity editable', () => {
  it('has the Existencias input and no read-only figure', async () => {
    const view = await mountView({})
    expect(view.find('[data-testid="product-detail-stock-readonly"]').exists()).toBe(false)
    expect(view.text()).toContain('Existencias')
    expect(view.findAll('input[role="spinbutton"]').length).toBeGreaterThan(0)
  })
})
