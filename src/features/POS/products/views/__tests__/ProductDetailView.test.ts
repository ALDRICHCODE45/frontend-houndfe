/**
 * Integration tests for ProductDetailView variant image modal trigger
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { h, reactive } from 'vue'
import EditorialWorkspace from '../../components/editorial/EditorialWorkspace.vue'
import { envelope, vocabularyEnvelope } from '../../__tests__/editorial-contract-fixtures'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductDetailView from '@/features/POS/products/views/ProductDetailView.vue'
import VariantImagePickerModal from '@/features/POS/products/components/VariantImagePickerModal.vue'
import ProductCatalogSettingsSection from '@/features/POS/products/components/ProductCatalogSettingsSection.vue'
import ProductVariantsTable from '@/features/POS/products/components/ProductVariantsTable.vue'

const routeState = vi.hoisted(() => ({ params: { id: 'test-product-id' } as Record<string, string> }))

// Mock router
vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: routeState.params,
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

const editorialSession = reactive({
  isAuthenticated: true, authPhase: 'authenticated', userId: 'user-1',
  tenantId: 'tenant-1' as string | null, permissionsLoaded: true,
  permissionCodes: [] as string[], isSuperAdmin: false,
})
const editorialReads = vi.hoisted(() => ({
  getVocabulary: vi.fn(), getState: vi.fn(), getContext: vi.fn(),
}))
// Keep the real module (EditorialContractApiError included) and stub the reads.
vi.mock('../../api/editorial-contract.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/editorial-contract.api')>()),
  editorialContractApi: editorialReads,
}))

// Mock auth store — controllable grants + tenant id (WU5 gate matrix).
const authState = vi.hoisted(() => ({
  userCan: vi.fn((_action: string, _resource: string) => true),
  currentTenantId: 'tenant-1',
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    get user() { return { id: editorialSession.userId, email: 'test@test.com' } },
    get isAuthenticated() { return editorialSession.isAuthenticated },
    get authPhase() { return editorialSession.authPhase },
    get currentTenant() { return editorialSession.tenantId ? { id: editorialSession.tenantId } : null },
    get permissionsLoaded() { return editorialSession.permissionsLoaded },
    get permissionCodes() { return editorialSession.permissionCodes },
    get isSuperAdmin() { return editorialSession.isSuperAdmin },
    userCan: authState.userCan,
    currentTenantId: authState.currentTenantId,
  })),
}))

// WU5: module-boundary mock for the tenant catalog-settings GET (REQ-15 gate).
// Default empty contexts keeps pre-existing tests valid when read is granted.
const settingsApi = vi.hoisted(() => ({
  get: vi.fn<
    () => Promise<{
      priceContexts: Array<{ priceListId: string; name: string; isCatalogDefault: boolean }>
    }>
  >(() => Promise.resolve({ priceContexts: [] })),
}))
const productApiMocks = vi.hoisted(() => ({ update: vi.fn(), upsertVariantPrice: vi.fn() }))

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
        }),
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
        ]),
      ),
      getLots: vi.fn(() => Promise.resolve([])),
      update: productApiMocks.update,
      upsertVariantPrice: productApiMocks.upsertVariantPrice,
    },
  }
})

let queryClient: QueryClient

// Every test starts clean whatever ran before it. Hooks run in reverse: the auto-unmount registered
// below runs first, then this resets the DOM, the cache, one-shot mock values (mockReset restores
// each vi.fn's own default) and spies.
afterEach(async () => {
  const { productApi } = await import('../../api/product.api')
  vi.mocked(productApi.getVariants).mockReset()
  settingsApi.get.mockReset()
  queryClient.clear()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
enableAutoUnmount(afterEach)

// NOTE: UTooltip provider context is now provided via mountWithUApp helper
describe('ProductDetailView - Variant Image Modal Integration', () => {

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    Object.assign(editorialSession, { isAuthenticated: true, authPhase: 'authenticated',
      userId: 'user-1', tenantId: 'tenant-1', permissionsLoaded: true,
      permissionCodes: [], isSuperAdmin: false })
    editorialReads.getVocabulary.mockReset().mockResolvedValue(vocabularyEnvelope())
    editorialReads.getState.mockReset().mockResolvedValue(envelope())
    editorialReads.getContext.mockReset().mockResolvedValue({ variants: [], priceLists: [] })
    routeState.params = { id: 'test-product-id' }
    mockToast.add.mockClear()
    authState.userCan.mockImplementation((_action: string, _resource: string) => true)
    productApiMocks.update.mockReset()
    productApiMocks.update.mockResolvedValue({ id: 'test-product-id' })
    productApiMocks.upsertVariantPrice.mockReset().mockResolvedValue({})
  })


  // The ⋮ menu itself is covered with real components in ProductVariantsTable.spec.ts;
  // here the view's wiring is what matters, so the table emits the chosen action.
  async function chooseFirstVariantPhotos(wrapper: ReturnType<typeof mountWithUApp>) {
    const table = wrapper.getComponent(ProductVariantsTable)
    const firstRow = (table.props('rows') as { id: string }[])[0]!
    table.vm.$emit('action', 'photos', firstRow.id)
    await wrapper.vm.$nextTick()
  }

  const getGlobalConfig = () => ({
    // Pre-existing mount-harness cast (legacy; typing global.plugins tuples is not worth the churn here).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [[VueQueryPlugin, { queryClient }]] as any,
    stubs: {
      // Renders `label` like the real UButton, so a query reads the same whichever one resolves.
      UButton: {
        template:
          '<button @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']">{{ $attrs.label }}<slot /></button>',
      },
      UCard: { template: '<div><slot name="header" /><slot /></div>' },
      UForm: { template: '<form><slot /></form>' },
      UFormField: { template: '<div><slot /></div>' },
      UInput: { template: '<input />' },
      USelect: { template: '<select />' },
      USelectMenu: {
        template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        props: ['modelValue', 'items', 'placeholder', 'disabled'],
      },
      URadioGroup: { template: '<div />' },
      USwitch: { template: '<input type="checkbox" />' },
      UTextarea: { template: '<textarea />' },
      UInputNumber: { template: '<input type="number" />' },
      USeparator: { template: '<hr />' },
      UBadge: { template: '<span><slot /></span>' },
      UIcon: { template: '<i />' },
      UModal: {
        template: '<div v-if="open"><slot name="header" /><slot name="body" /><slot /></div>',
        props: ['open'],
      },

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

    // The variants table gets one row per variant, each with its ⋮ menu
    const variantsTable = wrapper.findComponent(ProductVariantsTable)
    expect(variantsTable.exists()).toBe(true)
    expect(variantsTable.props('rows').length).toBeGreaterThan(0)
    expect(variantsTable.props('pending')).toBe(false)
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

    // Choose "Elegir fotos" in the first variant's ⋮ menu
    await chooseFirstVariantPhotos(wrapper)

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

    // Open the modal from the first variant's ⋮ menu
    await chooseFirstVariantPhotos(wrapper)

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

  it('uses HF presentation and an always-rendered operational summary (S2/S5/S6)', async () => {
    const wrapper = mountWithUApp(ProductDetailView, {
      global: getGlobalConfig(),
      attachTo: document.body,
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.find('.product-workspace.hf-theme.hf-ui').exists()).toBe(true)
    expect(wrapper.get('h1').classes()).toContain('hf-page-title')
    // Identidad saves from its bar; the header primary serves the other tasks.
    expect(wrapper.findAll('[data-testid="identity-save-bar"] .hf-primary-control')).toHaveLength(1)
    await wrapper.get('[data-task="presentations"]').trigger('click')
    const submit = wrapper.get('button[form="product-detail-form"]')
    expect(submit.classes()).toContain('hf-primary-control')
    expect(submit.attributes('type')).toBe('submit')
    expect(wrapper.html()).not.toContain('!text-black')
    expect(wrapper.html()).not.toContain('brand-action')
    const summary = wrapper.get('aside[aria-label="Resumen operativo del producto"]')
    expect(summary.classes().join(' ')).not.toMatch(/hidden|xl:block/)
    for (const text of ['Test Product', 'Producto', 'POS', 'Online', 'Precio de venta', 'Costo', 'Margen', 'Stock', '30', '$0.00', 'Datos operativos', '1/4']) {
      expect(summary.text()).toContain(text)
    }
    expect(summary.text()).not.toContain('No indica elegibilidad editorial')
    expect(summary.text()).not.toContain('Lista para publicar')
    expect(wrapper.find('.product-workspace-grid > aside').exists()).toBe(true)
  })

  describe('flexible product tasks (S1/S5/S6)', () => {
    async function mountTasks(readonly = false) {
      if (readonly) {
        authState.userCan.mockImplementation((action, subject) =>
          !(action === 'update' && subject === 'Product'))
      }
      const wrapper = mount(UApp, {
        slots: { default: () => h(ProductDetailView) },
        global: getGlobalConfig(),
        attachTo: document.body,
      })
      await flushPromises()
      return wrapper
    }

    it('derives the summary from pending form values without changing saved price semantics', async () => {
      const wrapper = await mountTasks()
      const summary = wrapper.get('aside[aria-label="Resumen operativo del producto"]')
      await wrapper.get('input[name="name"]').setValue('Nombre operativo pendiente')
      await wrapper.get('[data-task="presentations"]').trigger('click')
      await wrapper.get('input[name="purchaseCost"]').setValue('12.50')
      expect(summary.text()).toContain('Nombre operativo pendiente')
      expect(summary.get('[data-summary="cost"]').text()).toBe('$12.50')
      expect(summary.get('[data-summary="price"]').text()).toBe('$0.00')
      expect(summary.get('[data-summary="stock"]').text()).toBe('30')
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })

    it('shows service identity without inventing inventory in the summary', async () => {
      const wrapper = await mountTasks()
      const service = wrapper.findAll('.hf-segmented [role="radio"]').find((segment) => segment.text() === 'Servicio')!
      await service.trigger('click')
      const summary = wrapper.get('aside[aria-label="Resumen operativo del producto"]')
      expect(summary.text()).toContain('Servicio')
      expect(summary.get('[data-summary="stock"]').text()).toBe('—')
      expect(summary.get('[data-summary="price"]').text()).toBe('$0.00')
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })

    it('keeps raw operational controls mounted across freely selected tasks', async () => {
      const wrapper = await mountTasks()
      const identity = wrapper.get('[data-product-task="identity"]')
      const presentations = wrapper.get('[data-product-task="presentations"]')
      const input = identity.get('input').element as HTMLInputElement
      await identity.get('input').setValue('Nombre pendiente sin normalizar  ')
      expect(identity.isVisible()).toBe(true)
      expect(presentations.isVisible()).toBe(false)
      await wrapper.get('[data-task="presentations"]').trigger('click')
      expect(identity.isVisible()).toBe(false)
      expect(presentations.isVisible()).toBe(true)
      // Existing variants, prices, inventory and image controls are not replaced.
      expect(wrapper.getComponent(ProductVariantsTable).props('rows')).toHaveLength(2)
      await wrapper.get('[data-task="content"]').trigger('click')
      expect(presentations.isVisible()).toBe(false)
      expect(wrapper.get('[data-testid="editorial-unavailable"]').text()).toContain('No tienes permiso')
      expect(wrapper.find('form form').exists()).toBe(false)
      expect(wrapper.find('[data-testid="editorial-unavailable"]').element.closest('form')).toBeNull()
      await wrapper.get('[data-task="identity"]').trigger('click')
      expect(identity.get('input').element).toBe(input)
      expect(input.value).toBe('Nombre pendiente sin normalizar  ')
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })

    it.each([
      ['purchaseCost', 'presentations'],
      ['serviceDetail.capacity', 'presentations'],
      ['name', 'identity'],
      ['categoryId', 'identity'],
    ])('reveals the task containing invalid %s without replacing controls', async (name, task) => {
      const wrapper = await mountTasks()
      const input = wrapper.get('[data-product-task="identity"] input').element
      await wrapper.get('[data-task="content"]').trigger('click')
      wrapper.getComponent({ name: 'Form' }).vm.$emit('error', { errors: [{ name }] })
      await wrapper.vm.$nextTick()
      expect(wrapper.get(`[data-product-task="${task}"]`).isVisible()).toBe(true)
      expect(wrapper.get(`[data-task="${task}"]`).attributes('aria-current')).toBe('page')
      expect(wrapper.get('[data-product-task="identity"] input').element).toBe(input)
    })

    it('explains that new products need creation before editorial work', async () => {
      routeState.params = {}
      const wrapper = await mountTasks()
      const summary = wrapper.get('aside[aria-label="Resumen operativo del producto"]')
      expect(summary.text()).toContain('Imágenes disponibles después de crear')
      expect(summary.text()).toContain('0/3')
      expect(summary.get('[data-summary="price"]').text()).toBe('$0.00')
      await wrapper.get('[data-task="content"]').trigger('click')
      expect(wrapper.get('[data-testid="editorial-unavailable"]').text()).toContain('Crea el producto primero')
      expect(wrapper.find('[data-task="review"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="product-image-gallery"]').exists()).toBe(false)
      expect(editorialReads.getVocabulary).not.toHaveBeenCalled()
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })

    it.each([
      ['an editor', ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']],
      ['a user without editorial permission', []],
    ])('hides the product header and mobile save on Contenido for %s, and brings them back on the other tasks', async (_who, permissionCodes) => {
      editorialSession.permissionCodes = permissionCodes
      const wrapper = await mountTasks()
      // Identidad saves from its own bar, not from the header.
      expect(wrapper.find('[data-testid="identity-save-bar"]').exists()).toBe(true)
      expect(wrapper.find('button[form="product-detail-form"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
      await wrapper.get('[data-task="content"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="identity-save-bar"]').exists()).toBe(false)
      expect(wrapper.find('button[form="product-detail-form"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(false)
      await wrapper.get('[data-task="presentations"]').trigger('click')
      expect(wrapper.get('button[form="product-detail-form"]').text()).toBe('Guardar cambios')
      expect(wrapper.find('[data-testid="mobile-action-bar"]').exists()).toBe(true)
    })

    it('lazily mounts one real editor outside UForm and retains its pending input', async () => {
      editorialSession.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
      const wrapper = await mountTasks()
      expect(editorialReads.getVocabulary).not.toHaveBeenCalled()
      expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(false)
      await wrapper.get('[data-task="content"]').trigger('click')
      await flushPromises()
      const workspace = wrapper.getComponent(EditorialWorkspace)
      expect(workspace.props('embedded')).toBe(true)
      expect(workspace.element.closest('#product-detail-form')).toBeNull()
      const input = workspace.get('input')
      await input.setValue('Título pendiente  ')
      for (const task of ['identity', 'presentations', 'content']) {
        await wrapper.get(`[data-task="${task}"]`).trigger('click')
        expect(wrapper.findAllComponents(EditorialWorkspace)).toHaveLength(1)
        expect(wrapper.getComponent(EditorialWorkspace).element === workspace.element).toBe(true)
        expect(workspace.isVisible()).toBe(task === 'content')
      }
      expect(workspace.get('input').element).toBe(input.element)
      expect((input.element as HTMLInputElement).value).toBe('Título pendiente  ')
      expect(editorialReads.getVocabulary).toHaveBeenCalledTimes(1)
      expect(editorialReads.getState).toHaveBeenCalledTimes(1)
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })

    it.each([
      [{ permissionCodes: [] }, 'No tienes permiso'],
      [{ permissionCodes: ['publish:ProductEditorialDraft'] }, 'No tienes permiso'],
      [{ permissionCodes: ['manage:all'], tenantId: null }, 'tenant'],
      [{ permissionsLoaded: false }, 'Espera'],
      [{ isAuthenticated: false }, 'sesión'],
      [{ authPhase: 'authenticating' }, 'sesión'],
      [{ userId: '' }, 'sesión'],
      [{ tenantId: null }, 'tenant'],
    ])('does not mount or read for an unavailable session: %j', async (changes, reason) => {
      editorialSession.permissionCodes = ['read:ProductEditorialDraft']
      Object.assign(editorialSession, changes)
      const wrapper = await mountTasks()
      await wrapper.get('[data-task="content"]').trigger('click')
      expect(wrapper.get('[data-testid="editorial-unavailable"]').text()).toContain(reason)
      expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(false)
      expect(editorialReads.getVocabulary).not.toHaveBeenCalled()
    })

    it.each([
      { permissionCodes: ['read:ProductEditorialDraft'] },
      { permissionCodes: ['manage:all'] },
      { permissionCodes: [], isSuperAdmin: true, tenantId: null },
    ])('uses existing editorial grants independently of operational update: %j', async grants => {
      Object.assign(editorialSession, grants)
      const wrapper = await mountTasks(true)
      await wrapper.get('[data-task="content"]').trigger('click')
      await flushPromises()
      expect(wrapper.findComponent(EditorialWorkspace).exists()).toBe(true)
      expect(editorialReads.getState).toHaveBeenCalledTimes(1)
      expect(wrapper.get('#product-detail-form fieldset').attributes('disabled')).toBeDefined()
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })

    it.each([{ userId: 'user-2' }, { tenantId: 'tenant-2' }, { permissionCodes: [] }])(
      'retires prior sensitive controls when session context changes: %j', async changes => {
        editorialSession.permissionCodes = ['read:ProductEditorialDraft', 'update:ProductEditorialDraft']
        const wrapper = await mountTasks()
        await wrapper.get('[data-task="content"]').trigger('click')
        await flushPromises()
        const oldInput = wrapper.getComponent(EditorialWorkspace).get('input').element
        Object.assign(editorialSession, changes)
        await flushPromises()
        expect(wrapper.findAll('input').some(input => input.element === oldInput)).toBe(false)
      },
    )

    it('allows read-only navigation without enabling operational editing', async () => {
      const wrapper = await mountTasks(true)
      expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
      await wrapper.get('[data-task="presentations"]').trigger('click')
      expect(wrapper.get('[data-product-task="presentations"]').isVisible()).toBe(true)
      expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-task="presentations"]').element.closest('fieldset')).toBeNull()
      expect(productApiMocks.update).not.toHaveBeenCalled()
    })
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

      // REQ-15: USelectMenu rendered but disabled; hide-price/stock stay independently usable.
      const section = wrapper.findComponent(ProductCatalogSettingsSection)
      const selector = section.find('[data-testid="contexts-select"]')
      expect(selector.exists()).toBe(true)
      expect(selector.attributes('disabled')).toBeDefined()
      expect(section.find('[data-testid="contexts-gated-note"]').text()).toContain(
        'Configura los contextos públicos de la sucursal en Sistema > Catálogo online para habilitar esta selección',
      )
      expect(
        section.find('[data-testid="hide-price-switch"]').attributes('disabled'),
      ).toBeUndefined()
    })

    it('does not render the advanced section without update:Product (REQ-14)', async () => {
      authState.userCan.mockImplementation((action: string, subject: string) => {
        if (action === 'update' && subject === 'Product') return false
        return true
      })
      const wrapper = await mountLoadedView()
      expect(wrapper.findComponent(ProductCatalogSettingsSection).exists()).toBe(false)
    })

    it('authorized pending settings query: distinct loading USelectMenu disabled, no rows; hide-price usable', async () => {
      settingsApi.get.mockImplementationOnce(() => new Promise(() => {}))
      const wrapper = await mountLoadedView()
      const section = wrapper.findComponent(ProductCatalogSettingsSection)
      expect(section.props('settingsLoading')).toBe(true)
      expect(section.find('[data-testid="settings-loading-note"]').text()).toContain(
        'Cargando contextos públicos de la sucursal',
      )
      expect(section.find('[data-testid="context-toggle"]').exists()).toBe(false)
      expect(section.find('[data-testid="contexts-select"]').attributes('disabled')).toBeDefined()
      expect(
        section.find('[data-testid="hide-price-switch"]').attributes('disabled'),
      ).toBeUndefined()
    })

    it('authorized failed settings query: distinct error USelectMenu disabled, no rows; hide-price usable', async () => {
      settingsApi.get.mockRejectedValueOnce(new Error('catalog settings unavailable'))
      const wrapper = await mountLoadedView()
      const section = wrapper.findComponent(ProductCatalogSettingsSection)
      expect(section.find('[data-testid="settings-error-note"]').text()).toContain(
        'No se pudieron cargar los contextos públicos de la sucursal',
      )
      expect(section.find('[data-testid="context-toggle"]').exists()).toBe(false)
      expect(section.find('[data-testid="contexts-select"]').attributes('disabled')).toBeDefined()
      expect(
        section.find('[data-testid="hide-price-switch"]').attributes('disabled'),
      ).toBeUndefined()
    })

    it('authorized accepted-empty settings: USelectMenu disabled, no rows, accepted-empty note', async () => {
      const wrapper = await mountLoadedView()
      const section = wrapper.findComponent(ProductCatalogSettingsSection)
      expect(section.find('[data-testid="contexts-empty-note"]').text()).toContain(
        'La sucursal no tiene contextos públicos configurados',
      )
      expect(section.find('[data-testid="context-toggle"]').exists()).toBe(false)
      expect(section.find('[data-testid="contexts-select"]').attributes('disabled')).toBeDefined()
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

    it('places the product catalog card between Inventario and Variantes in the rendered card stack', async () => {
      const wrapper = await mountLoadedView()
      const inventoryHeading = wrapper
        .findAll('h2')
        .find((heading) => heading.text() === 'Inventario')
      const catalogHeading = wrapper
        .findAll('h2')
        .find((heading) => heading.text() === 'Catálogo online')
      const variantsHeading = wrapper
        .findAll('h2')
        .find((heading) => heading.text() === 'Variantes')

      expect(inventoryHeading).toBeDefined()
      expect(catalogHeading).toBeDefined()
      expect(variantsHeading).toBeDefined()

      const inventoryCard = inventoryHeading!.element.closest('[data-slot="root"]')
      const catalogCard = catalogHeading!.element.closest('[data-slot="root"]')
      const variantsCard = variantsHeading!.element.closest('[data-slot="root"]')

      expect(inventoryCard).toBeTruthy()
      expect(catalogCard).toBeTruthy()
      expect(variantsCard).toBeTruthy()
      const cardStack = inventoryCard!.parentElement
      expect(cardStack).toBeTruthy()
      expect(catalogCard!.parentElement).toBe(cardStack)
      expect(variantsCard!.parentElement).toBe(cardStack)
      expect(catalogCard!.previousElementSibling).toBe(inventoryCard)
      expect(catalogCard!.nextElementSibling).toBe(variantsCard)
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
      expect(
        invalidateSpy.mock.calls.map((call) => (call[0] as { queryKey?: unknown }).queryKey),
      ).toEqual([['products', 'tenant-1', 'detail', 'test-product-id']])
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

      const keys = invalidateSpy.mock.calls.map(
        (call) => (call[0] as { queryKey?: unknown }).queryKey,
      )
      expect(keys).toEqual([
        ['products', 'tenant-1', 'paginated'],
        ['products', 'tenant-1', 'detail', 'test-product-id'],
        ['products', 'tenant-1', 'price-lists', 'test-product-id'],
        ['products', 'tenant-1', 'variants', 'test-product-id'],
      ])
    })
  })

  // T22: the table commits only parsed cents (InlinePriceInput); the view sends them as-is.
  it('saves the committed variant public price with the exact cents', async () => {
    const { productApi } = await import('../../api/product.api')
    vi.mocked(productApi.getVariants).mockResolvedValueOnce([
      {
        id: 'variant-1', productId: 'test-product-id', name: 'Grande', option: 'Tamaño',
        value: 'Grande', sku: 'VAR-1', barcode: '', priceCents: 10000, quantity: 10,
        minQuantity: 5, purchaseNetCostCents: null, purchaseNetCostDecimal: null,
        variantPrices: [{ id: 'vp1', variantId: 'variant-1', priceListId: 'pl-publico',
          priceListName: 'PUBLICO', priceCents: 10000, tierPrices: [] }],
        createdAt: '2026-04-23T00:00:00.000Z', updatedAt: '2026-04-23T00:00:00.000Z',
      },
    ])
    const wrapper = mount(UApp, {
      slots: { default: () => h(ProductDetailView) },
      global: getGlobalConfig(),
      attachTo: document.body,
    })
    await flushPromises()
    const table = wrapper.getComponent(ProductVariantsTable)
    expect((table.props('rows') as { priceCents: number }[])[0]!.priceCents).toBe(10000)
    table.vm.$emit('commit-price', 'variant-1', 123450)
    await flushPromises()
    expect(productApiMocks.upsertVariantPrice).toHaveBeenCalledWith(
      'test-product-id', 'variant-1', 'pl-publico', { priceCents: 123450 },
    )
  })
})
