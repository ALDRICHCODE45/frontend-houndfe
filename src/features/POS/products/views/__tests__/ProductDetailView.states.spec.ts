/**
 * ProductDetailView — S10 states of the page: loading (page skeleton), error
 * (EmptyState kind error with Reintentar that refetches) and data (status
 * badge in the header, no permanent help text).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductDetailView from '@/features/POS/products/views/ProductDetailView.vue'

const routerPush = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: { id: 'prod-1' } })),
  useRouter: vi.fn(() => ({ push: routerPush })),
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
  routerPush.mockReset()
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

  it('data: header shows the status badge and the title, with one primary (Identidad\'s save bar) and no help text', async () => {
    api.getById.mockResolvedValue(product)
    const wrapper = mountView()
    await flushPromises()

    const header = wrapper.get('.product-workspace-header')
    expect(header.get('h1').text()).toBe('Collar ajustable')
    expect(header.text()).toContain('Activo')
    expect(header.text()).not.toContain('Cancelar')
    // On Identidad the single primary is the save bar's; the header carries none.
    expect(header.findAll('button[type="submit"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="identity-save-bar"] .hf-primary-control')).toHaveLength(1)
    expect(wrapper.find('button[aria-label="Volver a productos"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Datos operativos y contenido editorial')
    expect(wrapper.text()).not.toContain('Precios, impuestos y existencias son datos operativos')
    expect(wrapper.find('[data-testid="product-detail-skeleton"]').exists()).toBe(false)
  })
})

describe('ProductDetailView — review round 1', () => {
  it('not found: an empty state with a way back, not the error design', async () => {
    api.getById.mockRejectedValue(Object.assign(new Error('Not found'), { response: { status: 404 } }))
    const wrapper = mountView()
    await flushPromises()

    const empty = wrapper.get('.hf-empty-state[data-kind="empty"]')
    expect(empty.get('.hf-empty-state__title').text()).toBe('No encontramos el producto')
    expect(wrapper.find('.hf-empty-state[data-kind="error"]').exists()).toBe(false)
    await wrapper.get('[data-testid="empty-state-action"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/pos/products')
  })

  it.each(['loading', 'error', 'not-found'] as const)('%s: no save action in the header or the bottom bar', async (state) => {
    if (state === 'loading') api.getById.mockReturnValue(new Promise(() => {}))
    else if (state === 'error') api.getById.mockRejectedValue(new Error('boom'))
    else api.getById.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 404 } }))
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('button[form="product-detail-form"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
    expect(wrapper.get('h1').text()).toBe('Producto')
  })

  it('mobile: the single primary rides in the sticky bottom bar (Presentaciones; Identidad has its save bar)', async () => {
    api.getById.mockResolvedValue(product)
    const wrapper = mountView()
    await flushPromises()
    expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
    await wrapper.get('[data-task="presentations"]').trigger('click')
    await flushPromises()

    const bar = wrapper.get('[data-testid="mobile-action-bar"]')
    expect(bar.classes()).toContain('md:hidden')
    const submit = bar.get('button[type="submit"]')
    expect(submit.attributes('form')).toBe('product-detail-form')
    expect(submit.text()).toBe('Guardar cambios')
    // The wrapper hides it: `.hf-ui .hf-primary-control { display: inline-flex }` beats a
    // `max-md:hidden` on the button itself, which showed two solid saves at 390.
    const header = wrapper.get('.product-workspace-header button[type="submit"]')
    expect(header.classes()).not.toContain('max-md:hidden')
    expect(header.element.closest('.max-md\\:hidden')).not.toBeNull()
  })

  it('shows the status as a badge in a meta line above the title, in sentence case', async () => {
    api.getById.mockResolvedValue({ ...product, status: 'out_of_stock' })
    const wrapper = mountView()
    await flushPromises()

    const meta = wrapper.get('.product-header-meta')
    expect(meta.get('.hf-status-badge').text()).toBe('Sin stock')
    expect(wrapper.text()).not.toContain('Sin Stock')
    const h1 = wrapper.get('.product-workspace-header h1')
    expect(meta.element.compareDocumentPosition(h1.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('lets the title wrap to two lines instead of cutting to a few letters', async () => {
    api.getById.mockResolvedValue(product)
    const wrapper = mountView()
    await flushPromises()
    const classes = wrapper.get('.product-workspace-header h1').classes()
    expect(classes).toContain('line-clamp-2')
    expect(classes).not.toContain('truncate')
  })

  it('uses sentence case labels and full-width barcode and SKU inputs', () => {
    const source = readFileSync(resolve(__dirname, '../ProductDetailView.vue'), 'utf8')
    expect(source).toContain("label: 'Vender en punto de venta'")
    expect(source).not.toMatch(/Vender en Punto de Venta|Precio de Compra|Listas de Precios|Precios por Cantidad|Agregar Lista de Precios/)
    expect(source).not.toContain('Código de barras / Barcode')
    expect(source).toMatch(/<UInput v-model="formState\.barcode" class="w-full"/)
    expect(source).toMatch(/<UInput v-model="formState\.sku" class="w-full"/)
  })
})
