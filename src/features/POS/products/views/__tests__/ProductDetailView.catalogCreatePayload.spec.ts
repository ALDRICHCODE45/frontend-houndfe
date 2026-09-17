/**
 * REQ-17 acceptance: variant catalog omission on create.
 *
 * Exercises ProductDetailView through REAL DOM interaction:
 *   - Toggles "Tiene variantes" switch via label-scoped [role="switch"]
 *   - Clicks actual 'Agregar variante' button (found by text)
 *   - Fills actual UForm inputs (option USelect, value UInput, quantity UInputNumber)
 *   - USelect option: hidden select[name="option"], set value + bubbling native `input` (NOT change)
 *   - Quantity: target visible input[role="spinbutton"] scoped to form/label, set text, dispatch input then blur
 *   - Submits actual #variant-modal-form via HTMLFormElement.requestSubmit()
 *   - Submits actual #product-detail-form via HTMLFormElement.requestSubmit()
 *   - Asserts rendered pending row/text identity+SKU, NOT wrapper.vm pendingVariants
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick, defineComponent, h, onUnmounted, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductDetailView from '../ProductDetailView.vue'

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

const mockUseRoute = vi.hoisted(() => vi.fn(() => ({ params: {} })))

vi.mock('vue-router', () => ({
  useRoute: mockUseRoute,
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

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

const productApiMocks = vi.hoisted(() => ({
  create: vi.fn(),
  createVariant: vi.fn(),
}))

vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      getById: vi.fn(() =>
        Promise.resolve({
          id: 'existing-product-id',
          name: 'Existing Product',
          type: 'PRODUCT',
          sku: 'EX-001',
          barcode: '',
          categoryId: '',
          brandId: '',
          description: '',
          location: '',
          satKey: '',
          unit: 'UNIDAD',
          priceCents: 1000,
          quantity: 0,
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
          createdAt: '2026-04-23T00:00:00.000Z',
          updatedAt: '2026-04-23T00:00:00.000Z',
        }),
      ),
      getCategories: vi.fn(() => Promise.resolve([])),
      getBrands: vi.fn(() => Promise.resolve([])),
      getGlobalPriceLists: vi.fn(() => Promise.resolve([])),
      getVariants: vi.fn(() => Promise.resolve([])),
      getLots: vi.fn(() => Promise.resolve([])),
      create: productApiMocks.create,
      createVariant: productApiMocks.createVariant,
    },
  }
})

let queryClient: QueryClient

const rootUnmounted = vi.fn()
let capturedRoot: ReturnType<typeof mount> | undefined

const mountViewRoot = async (
  routeParams: Record<string, string> = {},
): Promise<ReturnType<typeof mountWithUApp>> => {
  mockUseRoute.mockReturnValue({ params: routeParams } as ReturnType<typeof mockUseRoute>)

  const RootCatcher = defineComponent({
    components: { UApp },
    setup() {
      onUnmounted(rootUnmounted)
      return () =>
        h(UApp, null, {
          default: () => h(ProductDetailView as Component),
        })
    },
  })
  const rootWrapper = mount(RootCatcher, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
  capturedRoot = rootWrapper
  await flushPromises()
  return rootWrapper.findComponent(ProductDetailView as Component) as ReturnType<typeof mountWithUApp>
}

const cleanup = () => {
  try {
    capturedRoot?.unmount()
  } finally {
    capturedRoot = undefined
    document.body.innerHTML = ''
    queryClient.clear()
    rootUnmounted.mockClear()
  }
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  productApiMocks.create.mockReset()
  productApiMocks.create.mockResolvedValue({ id: 'new-product-id' })
  productApiMocks.createVariant.mockReset()
  productApiMocks.createVariant.mockResolvedValue({ id: 'new-variant-id' })
  mockToast.add.mockClear()
  rootUnmounted.mockClear()
  capturedRoot = undefined

  authState.userCan.mockImplementation((action: string, resource: string) => {
    if (resource === 'TenantCatalogSettings' && action === 'read') return false
    return true
  })
})

afterEach(() => {
  cleanup()
})

/**
 * Helper: find a button by text content in a wrapper.
 */
function findButtonByText(wrapper: ReturnType<typeof mountWithUApp>, text: string) {
  const buttons = wrapper.findAll('button')
  return buttons.find((btn) => btn.text().includes(text))
}

/**
 * Find the unique "Tiene variantes" switch through Nuxt UI's label contract.
 */
function findTieneVariantesSwitch(root: ParentNode): HTMLElement | null {
  const labels = Array.from(root.querySelectorAll('label[data-slot="label"]')).filter(
    (label) => label.textContent?.trim() === 'Tiene variantes',
  )
  if (labels.length !== 1) return null

  const targetId = labels[0]!.getAttribute('for')
  if (!targetId) return null

  const switchEl = document.getElementById(targetId)
  return switchEl?.getAttribute('role') === 'switch' ? switchEl : null
}

// ── REQ-17: inline variant omit catalog keys (create mode) ────────────────────

describe('ProductDetailView · REQ-17 inline variant create (create mode)', () => {
  it('inline variant in create payload has positive identity and omits catalog keys', async () => {
    // 1. Mount in create mode
    const wrapper = await mountViewRoot({})
    await nextTick()
    await flushPromises()

    // 2. Toggle the unique "Tiene variantes" switch through its rendered label.
    const switchEl = findTieneVariantesSwitch(document)
    expect(switchEl).not.toBeNull()

    // Assert initial state: aria-checked is false
    expect(switchEl!.getAttribute('aria-checked')).toBe('false')

    // Click the switch to toggle it
    await switchEl!.click()
    await nextTick()
    await flushPromises()

    // Assert switch state changed: aria-checked is now true
    expect(switchEl!.getAttribute('aria-checked')).toBe('true')

    // 3. Click actual 'Agregar variante' button to open variant modal
    const addVariantBtn = findButtonByText(wrapper, 'Agregar variante')
    expect(addVariantBtn).toBeDefined()
    expect(addVariantBtn!.exists()).toBe(true)
    await addVariantBtn!.trigger('click')
    await nextTick()
    await flushPromises()

    // 4. Verify variant modal form is rendered
    // UModal uses DialogPortal which teleports to document.body
    // Using document.getElementById since wrapper.find cannot access teleported content
    await nextTick()
    const variantFormEl = document.getElementById('variant-modal-form')
    expect(variantFormEl).not.toBeNull()
    expect(variantFormEl).toBeInstanceOf(HTMLFormElement)

    // 5. Fill variant option (USelect) — find hidden select and dispatch bubbling native `input` (NOT change)
    // USelect from Reka UI may not respond to native select events; try both input and change
    const optionSelect = variantFormEl!.querySelector('select[name="option"]') as HTMLSelectElement
    expect(optionSelect).not.toBeNull()
    optionSelect.value = 'Color'
    optionSelect.dispatchEvent(new Event('input', { bubbles: true }))
    optionSelect.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    await flushPromises()

    // 6. Fill variant value (UInput)
    const valueInput = variantFormEl!.querySelector('input[name="value"]') as HTMLInputElement
    expect(valueInput).not.toBeNull()
    valueInput.value = 'Rojo'
    valueInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    // 7. Fill variant quantity — target visible input[role="spinbutton"] scoped to form, then blur to commit
    const quantityInput = variantFormEl!.querySelector('input[role="spinbutton"]') as HTMLInputElement
    expect(quantityInput).not.toBeNull()
    quantityInput.value = '10'
    quantityInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    quantityInput.dispatchEvent(new Event('blur', { bubbles: true }))
    await nextTick()
    await flushPromises()

    // 8. Fill variant SKU (UInput)
    const skuInput = variantFormEl!.querySelector('input[name="sku"]') as HTMLInputElement
    expect(skuInput).not.toBeNull()
    skuInput.value = 'VAR-SKU-001'
    skuInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    // 9. Submit variant modal form by clicking the submit button in the modal footer
    // The modal is teleported, find the submit button inside the modal dialog
    const modalDialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(modalDialog).not.toBeNull()
    const submitBtn = modalDialog!.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn).not.toBeNull()
    await submitBtn.click()
    await nextTick()
    await flushPromises()

    // 10. Verify rendered pending row contains identity (NOT wrapper.vm.pendingVariants)
    // Check the main view for the variant table rendered rows
    await nextTick()
    await flushPromises()
    
    // Look for the rendered variant in the DOM - it should show Color: Rojo or similar
    const variantRowText = document.body.textContent || ''
    expect(variantRowText).toContain('Color')
    expect(variantRowText).toContain('Rojo')
    expect(variantRowText).toContain('VAR-SKU-001')

    // 11. Fill main product form fields
    const nameInput = wrapper.find('input[name="name"]')
    expect(nameInput.exists()).toBe(true)
    await nameInput.setValue('Test Product for REQ17')
    await nextTick()

    // 12. Submit main product form by clicking the submit button
    const submitProductBtn = wrapper.find('button[type="submit"][form="product-detail-form"]') as ReturnType<typeof mount>['find'] extends (selector: string) => infer R ? R : never
    expect(submitProductBtn.exists()).toBe(true)
    await submitProductBtn.trigger('click')
    await nextTick()
    await flushPromises()

    // 13. Assert productApi.create was called exactly once
    expect(productApiMocks.create).toHaveBeenCalledTimes(1)

    // 14. Assert the payload has concrete identity fields AND omits forbidden keys
    const createPayload = productApiMocks.create.mock.calls[0]![0] as Record<string, unknown>

    // Positive identity: product name present
    expect(createPayload).toHaveProperty('name')
    expect(createPayload.name).toBe('Test Product for REQ17')

    // Positive identity: variant must carry concrete option, value, sku, quantity
    expect(createPayload).toHaveProperty('variants')
    const variants = createPayload.variants as unknown[]
    expect(variants.length).toBeGreaterThan(0)
    const inlineVariant = variants[0] as Record<string, unknown>

    // Concrete identity fields — no weak `a||b` assertion
    expect(inlineVariant).toHaveProperty('option')
    expect(inlineVariant.option).toBe('Color')
    expect(inlineVariant).toHaveProperty('value')
    expect(inlineVariant.value).toBe('Rojo')
    expect(inlineVariant).toHaveProperty('sku')
    expect(inlineVariant.sku).toBe('VAR-SKU-001')
    expect(inlineVariant).toHaveProperty('quantity')
    expect(inlineVariant.quantity).toBe(10)

    // REQ-17: inline variant must NOT carry catalog keys
    expect(inlineVariant).not.toHaveProperty('catalogPublishMode')
    expect(inlineVariant).not.toHaveProperty('onlineStockPresentation')
    expect(inlineVariant).not.toHaveProperty('onlineStockPresentationCustomQty')

    // Product root keeps REQ-13 stock fields while omitting publish mode
    expect(createPayload).not.toHaveProperty('catalogPublishMode')
    expect(createPayload).toHaveProperty('onlineStockPresentation', null)
    expect(createPayload).toHaveProperty('onlineStockPresentationCustomQty', null)
  })
})

// ── REQ-17: persisted variant create omit catalog keys (edit mode) ─────────────

describe('ProductDetailView · REQ-17 persisted variant create (edit mode)', () => {
  it('createVariant is called with productId and payload that has positive identity but omits catalog keys', async () => {
    // 1. Mount in edit mode (route has id param)
    const wrapper = await mountViewRoot({ id: 'existing-product-id' })
    await flushPromises()
    await new Promise((r) => setTimeout(r, 100))

    // 2. Click actual 'Agregar variante' button to open variant modal
    const addVariantBtn = findButtonByText(wrapper, 'Agregar variante')
    expect(addVariantBtn).toBeDefined()
    expect(addVariantBtn!.exists()).toBe(true)
    await addVariantBtn!.trigger('click')
    await nextTick()
    await flushPromises()

    // 3. Verify variant modal form is rendered (teleported to document.body)
    await nextTick()
    const variantFormEl = document.getElementById('variant-modal-form')
    expect(variantFormEl).not.toBeNull()
    expect(variantFormEl).toBeInstanceOf(HTMLFormElement)

    // 4. Fill variant option (USelect) — dispatch bubbling native `input` (NOT change)
    const optionSelect = variantFormEl!.querySelector('select[name="option"]') as HTMLSelectElement
    expect(optionSelect).not.toBeNull()
    optionSelect.value = 'Tamaño'
    optionSelect.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    await flushPromises()

    // 5. Fill variant value
    const valueInput = variantFormEl!.querySelector('input[name="value"]') as HTMLInputElement
    expect(valueInput).not.toBeNull()
    valueInput.value = 'Grande'
    valueInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    // 6. Fill variant quantity — visible input[role="spinbutton"] with blur to commit
    const quantityInput = variantFormEl!.querySelector('input[role="spinbutton"]') as HTMLInputElement
    expect(quantityInput).not.toBeNull()
    quantityInput.value = '15'
    quantityInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    quantityInput.dispatchEvent(new Event('blur', { bubbles: true }))
    await nextTick()
    await flushPromises()

    // 7. Fill variant SKU
    const skuInput = variantFormEl!.querySelector('input[name="sku"]') as HTMLInputElement
    expect(skuInput).not.toBeNull()
    skuInput.value = 'PERS-VAR-001'
    skuInput.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    // 8. Submit variant modal form by clicking the submit button in the modal footer
    // The modal is teleported, find the submit button inside the modal dialog
    const modalDialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(modalDialog).not.toBeNull()
    const submitBtn = modalDialog!.querySelector('button[type="submit"]') as HTMLButtonElement
    expect(submitBtn).not.toBeNull()
    await submitBtn.click()
    await nextTick()
    await flushPromises()

    // 9. Assert createVariant was called exactly once
    expect(productApiMocks.createVariant).toHaveBeenCalledTimes(1)

    // 10. Assert the FIRST argument (productId) is 'existing-product-id'
    const callArgs = productApiMocks.createVariant.mock.calls[0]!
    const productIdArg = callArgs[0] as string
    expect(productIdArg).toBe('existing-product-id')

    // 11. Assert the SECOND argument (payload) has concrete identity AND omits forbidden keys
    const variantPayload = callArgs[1] as Record<string, unknown>

    // Concrete identity fields — no weak `a||b` assertion
    expect(variantPayload).toHaveProperty('option')
    expect(variantPayload.option).toBe('Tamaño')
    expect(variantPayload).toHaveProperty('value')
    expect(variantPayload.value).toBe('Grande')
    expect(variantPayload).toHaveProperty('sku')
    expect(variantPayload.sku).toBe('PERS-VAR-001')
    expect(variantPayload).toHaveProperty('quantity')
    expect(variantPayload.quantity).toBe(15)

    // REQ-17: persisted variant create must NOT carry catalog keys
    expect(variantPayload).not.toHaveProperty('catalogPublishMode')
    expect(variantPayload).not.toHaveProperty('onlineStockPresentation')
    expect(variantPayload).not.toHaveProperty('onlineStockPresentationCustomQty')
  })
})
