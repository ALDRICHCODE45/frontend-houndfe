/**
 * ProductDetailView — S10 states of the page: loading (page skeleton), error
 * (EmptyState kind error with Reintentar that refetches) and data (status
 * badge in the header, no permanent help text).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductDetailView from '@/features/POS/products/views/ProductDetailView.vue'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { id: 'prod-1' } })),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))
vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1' },
    isAuthenticated: true,
    authPhase: 'authenticated',
    currentTenant: { id: 'tenant-1' },
    permissionsLoaded: true,
    permissionCodes: [],
    isSuperAdmin: false,
    userCan: vi.fn(() => true),
    currentTenantId: 'tenant-1',
  })),
}))
vi.mock('@/features/system/catalog-settings/api/catalogSettings.api', () => ({
  catalogSettingsApi: { get: vi.fn(() => Promise.resolve({ priceContexts: [] })) },
}))

const api = vi.hoisted(() => ({ getById: vi.fn() }))

vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      getById: api.getById,
      getCategories: vi.fn(() => Promise.resolve([])),
      getBrands: vi.fn(() => Promise.resolve([])),
      getGlobalPriceLists: vi.fn(() => Promise.resolve([])),
      getVariants: vi.fn(() => Promise.resolve([])),
      getLots: vi.fn(() => Promise.resolve([])),
    },
  }
})

const product = {
  id: 'prod-1',
  name: 'Collar ajustable',
  type: 'PRODUCT',
  sku: 'COL-001',
  barcode: '',
  categoryId: '',
  brandId: '',
  description: '',
  location: '',
  satKey: '',
  unit: 'UNIDAD',
  priceCents: 0,
  quantity: 4,
  minQuantity: 0,
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
  status: 'active',
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
}

function mountView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return mountWithUApp(ProductDetailView, {
    global: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plugins: [[VueQueryPlugin, { queryClient }]] as any,
      stubs: {
        ProductImageGallery: { template: '<div />' },
        PriceListSection: { template: '<div />' },
        VariantDetailModal: { template: '<div />' },
        VariantImagePickerModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
        UModal: { template: '<div />' },
      },
    },
    attachTo: document.body,
  })
}

beforeEach(() => {
  api.getById.mockReset()
  document.body.innerHTML = ''
})

describe('ProductDetailView four states (S10)', () => {
  it('loading: shows the page skeleton and neither the form nor the summary', async () => {
    api.getById.mockReturnValue(new Promise(() => {}))
    const wrapper = mountView()
    await flushPromises()

    const skeleton = wrapper.get('[data-testid="product-detail-skeleton"]')
    expect(skeleton.attributes('aria-busy')).toBe('true')
    expect(wrapper.find('#product-detail-form').exists()).toBe(false)
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('error: shows the error state with Reintentar, which refetches', async () => {
    api.getById.mockRejectedValue(new Error('boom'))
    const wrapper = mountView()
    await flushPromises()

    const error = wrapper.get('.hf-empty-state[data-kind="error"]')
    expect(error.attributes('role')).toBe('alert')
    expect(error.text()).toContain('No se pudo cargar el producto')
    expect(wrapper.find('[data-testid="product-detail-skeleton"]').exists()).toBe(false)

    api.getById.mockResolvedValue(product)
    const calls = api.getById.mock.calls.length
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    await flushPromises()
    expect(api.getById.mock.calls.length).toBeGreaterThan(calls)
    expect(wrapper.find('.hf-empty-state[data-kind="error"]').exists()).toBe(false)
  })

  it('data: header shows the status badge and the title, with one primary and no help text', async () => {
    api.getById.mockResolvedValue(product)
    const wrapper = mountView()
    await flushPromises()

    const header = wrapper.get('.product-workspace-header')
    expect(header.get('h1').text()).toBe('Collar ajustable')
    expect(header.text()).toContain('Activo')
    expect(header.text()).not.toContain('Cancelar')
    expect(header.findAll('button[type="submit"]')).toHaveLength(1)
    expect(wrapper.find('button[aria-label="Volver a productos"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Datos operativos y contenido editorial')
    expect(wrapper.text()).not.toContain('Precios, impuestos y existencias son datos operativos')
    expect(wrapper.find('[data-testid="product-detail-skeleton"]').exists()).toBe(false)
  })
})
