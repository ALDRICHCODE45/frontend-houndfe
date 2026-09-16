/**
 * Integration tests for ProductDetailView variant image modal trigger
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises } from '@vue/test-utils'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductDetailView from '../ProductDetailView.vue'
import VariantImagePickerModal from '../../components/VariantImagePickerModal.vue'
import ProductCatalogSettingsSection from '../../components/ProductCatalogSettingsSection.vue'

// Mock router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { id: 'test-product-id' },
  })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}))

// Mock toast
const mockToast = {
  add: vi.fn(),
}
vi.stubGlobal('useToast', () => mockToast)

// Mock auth store — controllable grants + tenant id (WU5 gate matrix).
const authState = vi.hoisted(() => ({
  userCan: vi.fn((_action: string, _resource: string) => true),
  currentTenantId: 'tenant-1',
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@test.com' },
    userCan: authState.userCan,
    currentTenantId: authState.currentTenantId,
  })),
}))

// WU5: module-boundary mock for the tenant catalog-settings GET (REQ-15 gate).
// Default empty contexts keeps pre-existing tests valid when read is granted.
const settingsApi = vi.hoisted(() => ({
  get: vi.fn<() => Promise<{ priceContexts: Array<{ priceListId: string; name: string; isCatalogDefault: boolean }> }>>(
    () => Promise.resolve({ priceContexts: [] }),
  ),
}))
const productApiMocks = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('@/features/system/catalog-settings/api/catalogSettings.api', () => ({
  catalogSettingsApi: settingsApi,
}))

// Mock productApi — partial mock: keep the real WU4 payload mappers
// (toProductPatchAdvancedCatalogPayload etc.) while stubbing the HTTP calls.
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
    getById: vi.fn(() =>
      Promise.resolve({
        id: 'test-product-id',
        name: 'Test Product',
        type: 'PRODUCT',
        sku: 'TEST-SKU',
        barcode: '',
        categoryId: '',
        brandId: '',
        description: '',
        location: '',
        satKey: '',
        unit: 'UNIDAD',
        priceCents: 0,
        quantity: 0,
        minQuantity: 0,
        useStock: true,
        useLotsAndExpirations: false,
        hasVariants: true,
        sellInPos: true,
        includeInOnlineCatalog: true,
        requiresPrescription: false,
        chargeProductTaxes: true,
        ivaRate: 'IVA_16',
        iepsRate: 'NO_APLICA',
        purchaseCostMode: 'NET',
        purchaseNetCostCents: 0,
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z',
      })
    ),
    getCategories: vi.fn(() => Promise.resolve([])),
    getBrands: vi.fn(() => Promise.resolve([])),
    getGlobalPriceLists: vi.fn(() => Promise.resolve([])),
    getVariants: vi.fn(() =>
      Promise.resolve([
        {
          id: 'variant-1',
          productId: 'test-product-id',
          option: 'Tamaño',
          value: 'Grande',
          name: 'Grande',
          sku: 'VAR-1',
          barcode: '',
          quantity: 10,
          minQuantity: 5,
          purchaseNetCostCents: null,
          variantPrices: [],
        },
        {
          id: 'variant-2',
          productId: 'test-product-id',
          option: 'Tamaño',
          value: 'Pequeño',
          name: 'Pequeño',
          sku: 'VAR-2',
          barcode: '',
          quantity: 20,
          minQuantity: 10,
          purchaseNetCostCents: null,
          variantPrices: [],
        },
      ])
    ),
        getLots: vi.fn(() => Promise.resolve([])),
        update: productApiMocks.update,
      },
    }
  })

// NOTE: UTooltip provider context is now provided via mountWithUApp helper
describe('ProductDetailView - Variant Image Modal Integration', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    mockToast.add.mockClear()
    authState.userCan.mockImplementation((_action: string, _resource: string) => true)
    productApiMocks.update.mockReset()
    productApiMocks.update.mockResolvedValue({ id: 'test-product-id' })
  })

  const getGlobalConfig = () => ({
    // Pre-existing mount-harness cast (legacy; typing global.plugins tuples is not worth the churn here).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [[VueQueryPlugin, { queryClient }]] as any,
    stubs: {
      UButton: { template: '<button @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>' },
      UCard: { template: '<div><slot name="header" /><slot /></div>' },
          UForm: { template: '<form><slot /></form>' },
      UFormField: { template: '<div><slot /></div>' },
          UInput: { template: '<input />' },
      USelect: { template: '<select />' },
      URadioGroup: { template: '<div />' },
      USwitch: { template: '<input type="checkbox" />' },
      UTextarea: { template: '<textarea />' },
      UInputNumber: { template: '<input type="number" />' },
      USeparator: { template: '<hr />' },
      UBadge: { template: '<span><slot /></span>' },
      UIcon: { template: '<i />' },
      UModal: { template: '<div v-if="open"><slot name="header" /><slot name="body" /><slot /></div>', props: ['open'] },

      UProgress: { template: '<div />' },
      UCollapsible: { template: '<div><slot name="trigger" /><slot /></div>' },
      UCheckbox: { template: '<input type="checkbox" />' },
      ProductImageGallery: { template: '<div data-testid="product-image-gallery" />' },
      CategorySelect: { template: '<select />' },
      PriceListSection: { template: '<div />' },
      VariantDetailModal: { template: '<div />' },
      ConfirmModal: { template: '<div />' },
      VariantImagePickerModal: {
        template: '<div v-if="open" data-testid="variant-image-modal" />',
        props: ['open', 'productId', 'productName', 'variant', 'canUpdate', 'canDelete'],
      },
    },
  })

  it('renders variant rows with image icon buttons in edit mode', async () => {
    const wrapper = mountWithUApp(ProductDetailView, {
      global: getGlobalConfig(),
      attachTo: document.body,
    })

    // Wait for async data to load
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Find variant rows (they should exist in the edit mode table)
    const variantTable = wrapper.find('tbody')
    expect(variantTable.exists()).toBe(true)

    // Check that there are image icon buttons for variants
    const imageButtons = wrapper.findAll('[data-testid="variant-image-button"]')
    expect(imageButtons.length).toBeGreaterThan(0)
  })

  it('opens VariantImagePickerModal when image icon button is clicked', async () => {
    const wrapper = mountWithUApp(ProductDetailView, {
      global: getGlobalConfig(),
      attachTo: document.body,
    })

    // Wait for async data
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Initially, modal should be closed
    expect(wrapper.find('[data-testid="variant-image-modal"]').exists()).toBe(false)

    // Click the first variant image button
    const imageButton = wrapper.find('[data-testid="variant-image-button"]')
    expect(imageButton.exists()).toBe(true)
    
    await imageButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Modal should now be open
    expect(wrapper.find('[data-testid="variant-image-modal"]').exists()).toBe(true)
  })

  it('passes correct props to VariantImagePickerModal', async () => {
    const wrapper = mountWithUApp(ProductDetailView, {
      global: getGlobalConfig(),
      attachTo: document.body,
    })

    // Wait for data
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Click to open modal
    const imageButton = wrapper.find('[data-testid="variant-image-button"]')
    expect(imageButton.exists()).toBe(true)
    
    await imageButton.trigger('click')
    await wrapper.vm.$nextTick()

    // Find the modal component
    const modal = wrapper.findComponent(VariantImagePickerModal)
    expect(modal.exists()).toBe(true)

    // Verify props
    expect(modal.props('open')).toBe(true)
    expect(modal.props('productId')).toBe('test-product-id')
    expect(modal.props('productName')).toBe('Test Product')
    expect(modal.props('variant')).toBeDefined()
    expect(modal.props('variant').id).toBe('variant-1')
    expect(modal.props('canUpdate')).toBe(true)
    expect(modal.props('canDelete')).toBe(true)
  })

  it('page bg + completion bar + main submit use coco tokens (SDD-7)', async () => {
    const wrapper = mountWithUApp(ProductDetailView, {
      global: getGlobalConfig(),
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    // PRD-REQ-005 page bg — find the root container that carries the
    // bg-coco-neutral-50 class (any of the wrappers will match).
    const pageBg = wrapper.find('[class*="bg-coco-neutral-50"]')
    expect(pageBg.exists()).toBe(true)

    // PRD-REQ-004 completion-bar fill uses bg-coco-gold-500.
    expect(wrapper.html()).toContain('bg-coco-gold-500')

    // PRD-REQ-003 main submit uses the Cobrar class string.
    expect(wrapper.html()).toContain('bg-(--brand-action)')
    expect(wrapper.html()).toContain('!text-black')
  })


// ── WU5: advanced 'Catálogo online' section (REQ-14 / REQ-15 / REQ-18) ──────
describe('ProductDetailView - Advanced Catálogo online section (WU5)', () => {
  beforeEach(() => {
    settingsApi.get.mockClear()
  })

  /** Mount the routed view in edit mode and wait for the product query. */
  async function mountLoadedView() {
    const wrapper = mountWithUApp(ProductDetailView, {
      global: getGlobalConfig(),
      attachTo: document.body,
    })
    await wrapper.vm.$nextTick()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))
    return wrapper
  }

  it('issues NO catalog-settings GET when read:TenantCatalogSettings is missing (REQ-15)', async () => {
    authState.userCan.mockImplementation((action: string, subject: string) => {
      if (action === 'read' && subject === 'TenantCatalogSettings') return false
      return true
    })
    const wrapper = await mountLoadedView()
    // The frontend data-access gate never fires the settings query on its own.
    expect(settingsApi.get).not.toHaveBeenCalled()

    // REQ-15: the selector is rendered but disabled even without accepted
    // contexts, while hide-price/stock stay independently usable.
    const section = wrapper.findComponent(ProductCatalogSettingsSection)
    const selector = section.find('[data-testid="contexts-select"]')
    expect(selector.exists()).toBe(true)
    expect((selector.element as HTMLSelectElement).disabled).toBe(true)
    expect(section.find('[data-testid="contexts-gated-note"]').text()).toContain(
      'Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección',
    )
    expect((section.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(false)
  })

  it('does not render the advanced section without update:Product (REQ-14)', async () => {
    authState.userCan.mockImplementation((action: string, subject: string) => {
      if (action === 'update' && subject === 'Product') return false
      return true
    })
    const wrapper = await mountLoadedView()
    expect(wrapper.findComponent(ProductCatalogSettingsSection).exists()).toBe(false)
  })

      it('authorized pending settings query: distinct loading selector without context options (design: state affects only the selector)', async () => {
        settingsApi.get.mockImplementationOnce(() => new Promise(() => {}))
        const wrapper = await mountLoadedView()
        const section = wrapper.findComponent(ProductCatalogSettingsSection)
        expect(section.props('settingsLoading')).toBe(true)
        expect(section.find('[data-testid="settings-loading-note"]').text()).toContain('Cargando contextos públicos del tenant')
        expect(section.find('[data-testid="context-toggle"]').exists()).toBe(false)
        expect((section.find('[data-testid="contexts-select"]').element as HTMLSelectElement).disabled).toBe(true)
        expect((section.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(false)
      })

      it('authorized failed settings query renders the error state distinct from accepted-empty (design: state affects only the selector)', async () => {
        settingsApi.get.mockRejectedValueOnce(new Error('catalog settings unavailable'))
        const wrapper = await mountLoadedView()
        const section = wrapper.findComponent(ProductCatalogSettingsSection)
        expect(section.find('[data-testid="settings-error-note"]').text()).toContain('No se pudieron cargar los contextos públicos del tenant')
        expect(section.find('[data-testid="context-toggle"]').exists()).toBe(false)
        expect((section.find('[data-testid="contexts-select"]').element as HTMLSelectElement).disabled).toBe(true)
        expect((section.find('[data-testid="hide-price-switch"]').element as HTMLButtonElement).disabled).toBe(false)
      })

      it('authorized accepted-empty settings response states the tenant fact without context options (integration)', async () => {
        const wrapper = await mountLoadedView()
        const section = wrapper.findComponent(ProductCatalogSettingsSection)
        expect(section.find('[data-testid="contexts-empty-note"]').text()).toContain('El tenant no tiene contextos públicos configurados')
        expect(section.find('[data-testid="context-toggle"]').exists()).toBe(false)
        expect((section.find('[data-testid="contexts-select"]').element as HTMLSelectElement).disabled).toBe(true)
      })

      it('renders the advanced section and queries tenant settings with read granted (REQ-14/15)', async () => {
    settingsApi.get.mockResolvedValue({
      priceContexts: [{ priceListId: 'pl_pub', name: 'Pública', isCatalogDefault: true }],
    })
    const wrapper = await mountLoadedView()

    const section = wrapper.findComponent(ProductCatalogSettingsSection)
    expect(section.exists()).toBe(true)
    expect(settingsApi.get).toHaveBeenCalled()

    const row = section.find('[data-testid="context-toggle"]')
    expect(row.exists()).toBe(true)
    expect(section.text()).toContain('Pública')
  })

  it('catalog-only save: PATCH body carries only changed flat keys and invalidates ONLY detail (REQ-13/18)', async () => {
    const wrapper = await mountLoadedView()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const section = wrapper.findComponent(ProductCatalogSettingsSection)
    await section.find('[data-testid="hide-price-switch"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    // Changed-only diff vs the pristine advanced snapshot.
    const patchBody = productApiMocks.update.mock.calls[0]?.[1] as Record<string, unknown>
    expect(patchBody.hidePriceInOnlineCatalog).toBe(true)
    // Response-only + unchanged keys never travel.
    expect(patchBody).not.toHaveProperty('supportsAllCatalogPriceLists')
    expect(patchBody).not.toHaveProperty('supportedCatalogPriceListIds')
    expect(patchBody).not.toHaveProperty('onlineStockPresentation')
    expect(patchBody).not.toHaveProperty('onlineStockPresentationCustomQty')

    // Surgical invalidation: exactly the detail key, nothing broader.
    expect(invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey?: unknown }).queryKey)).toEqual([
      ['products', 'tenant-1', 'detail', 'test-product-id'],
    ])
  })

  it('mixed save retains the pre-existing invalidation set (REQ-18 triangulation)', async () => {
    const wrapper = await mountLoadedView()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    // Non-catalog change: the real UInput name field (stable placeholder selector).
    const nameInput = wrapper
      .findAll('input')
      .find((input) => input.attributes('placeholder') === 'Ej: Jabón de mano')!
    await nameInput.setValue('Nombre cambiado')
    const section = wrapper.findComponent(ProductCatalogSettingsSection)
    await section.find('[data-testid="hide-price-switch"]').trigger('click')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    const keys = invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey?: unknown }).queryKey)
    expect(keys).toEqual([
      ['products', 'tenant-1', 'paginated'],
      ['products', 'tenant-1', 'detail', 'test-product-id'],
      ['products', 'tenant-1', 'price-lists', 'test-product-id'],
      ['products', 'tenant-1', 'variants', 'test-product-id'],
    ])
  })
})
})
