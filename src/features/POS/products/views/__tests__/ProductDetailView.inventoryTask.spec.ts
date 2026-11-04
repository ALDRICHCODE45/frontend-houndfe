/**
 * O1 T6 (S8) — ProductDetailView: the fifth task, "Inventario". It exists only
 * for a saved product and only with `read:InventoryJournal`; it mounts the
 * stock panel (adjust action and kardex live inside it) the first time it opens.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const route = vi.hoisted(() => vi.fn(() => ({ params: { id: 'prod-1' } as Record<string, string> })))
vi.mock('vue-router', () => ({
  useRoute: route,
  useRouter: () => ({ push: vi.fn() }),
}))

const grants = await vi.hoisted(async () => (await import('vue')).reactive({ read: true }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1' },
    currentTenantId: 'tenant-1',
    authPhase: 'authenticated',
    permissionsLoaded: true,
    userCan: (action: string, resource: string) => {
      if (resource === 'InventoryJournal') return grants.read && action === 'read'
      return resource !== 'TenantCatalogSettings'
    },
  }),
}))

// The panel has its own specs; here it only has to be mounted with the product id.
vi.mock('@/features/POS/inventory/components/InventoryStockPanel.vue', () => ({
  default: defineComponent({
    name: 'InventoryStockPanel',
    props: { productId: { type: String, required: true } },
    setup: (props) => () => h('section', { 'data-testid': 'stock-panel-stub', 'data-product-id': props.productId }),
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
  id: 'prod-1', name: 'Croquetas', type: 'PRODUCT', sku: 'CRO-1', barcode: '', categoryId: '', brandId: '',
  description: '', location: '', satKey: '', unit: 'UNIDAD', priceCents: 1000, quantity: 50, minQuantity: 2,
  useStock: true, useLotsAndExpirations: false, hasVariants: false, sellInPos: true,
  includeInOnlineCatalog: true, requiresPrescription: false, chargeProductTaxes: true, ivaRate: 'IVA_16',
  iepsRate: 'NO_APLICA', purchaseCostMode: 'NET', purchaseNetCostCents: 0, purchaseGrossCostCents: 0,
  status: 'active', createdAt: '2026-04-23T00:00:00.000Z', updatedAt: '2026-04-23T00:00:00.000Z',
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
  grants.read = true
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  api.getById.mockReset().mockResolvedValue(product)
  api.getVariants.mockReset().mockResolvedValue([])
})

afterEach(() => {
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

const taskLabels = (view: Awaited<ReturnType<typeof mountView>>) =>
  view.findAll('.product-task-button').map((button) => button.text())

describe('ProductDetailView — Inventario task', () => {
  it('shows the fourth task for a saved product when the user can read the journal', async () => {
    const view = await mountView()
    expect(taskLabels(view)).toEqual(['Identidad', 'Presentaciones', 'Contenido', 'Inventario'])
  })

  it('shows no task without read:InventoryJournal', async () => {
    grants.read = false
    const view = await mountView()
    expect(taskLabels(view)).toEqual(['Identidad', 'Presentaciones', 'Contenido'])
    expect(view.find('[data-task="inventory"]').exists()).toBe(false)
    expect(view.find('[data-testid="stock-panel-stub"]').exists()).toBe(false)
  })

  it('shows no task while creating a product', async () => {
    const view = await mountView({})
    expect(taskLabels(view)).toEqual(['Identidad', 'Presentaciones', 'Contenido'])
    expect(view.find('[data-testid="stock-panel-stub"]').exists()).toBe(false)
  })

  it('mounts the stock panel with the product id only once the task opens', async () => {
    const view = await mountView()
    expect(view.find('[data-testid="stock-panel-stub"]').exists()).toBe(false)

    await view.get('[data-task="inventory"]').trigger('click')
    const panel = view.get('[data-testid="stock-panel-stub"]')
    expect(panel.attributes('data-product-id')).toBe('prod-1')
    expect(view.get('[data-task="inventory"]').attributes('aria-current')).toBe('page')
    expect(panel.isVisible()).toBe(true)

    // Leaving the task keeps the panel (and its kardex) alive but hidden.
    await view.get('[data-task="identity"]').trigger('click')
    expect(view.get('[data-testid="stock-panel-stub"]').isVisible()).toBe(false)
  })

  it('falls back to Identidad when the grant is lost while the task is open', async () => {
    const view = await mountView()
    await view.get('[data-task="inventory"]').trigger('click')
    grants.read = false
    await flushPromises()
    expect(view.find('[data-task="inventory"]').exists()).toBe(false)
    expect(view.find('[data-testid="stock-panel-stub"]').exists()).toBe(false)
    expect(view.get('[data-task="identity"]').attributes('aria-current')).toBe('page')
  })
})
