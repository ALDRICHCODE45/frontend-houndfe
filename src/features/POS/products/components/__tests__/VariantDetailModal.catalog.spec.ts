// VariantDetailModal.catalog.spec.ts — WU6 strict-TDD pins for the persisted-
// variant catalog controls (REQ-16/REQ-17): INHERIT/ON/OFF publication mode,
// nullable stock override pair reusing OnlineStockOverrideFields, changed-flat-
// keys-only PATCH via toVariantPatchCatalogPayload, surgical variants-key
// invalidation. The non-persisted cases exercise THIS modal's editing path only;
// the actual create/inline payload builders live in ProductDetailView.vue and
// stay untouched (verified statically: view lines 781-791, 1648-1676; the
// persisted-variant modal caller at 3044-3055).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, onUnmounted, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import VariantDetailModal from '@/features/POS/products/components/VariantDetailModal.vue'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import type { ProductVariant } from '../../interfaces/product.types'

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({ currentTenantId: 'tenant-1' })),
}))

// Module-boundary mock: only the variant PATCH is stubbed; the real WU4
// mappers (toVariantPatchCatalogPayload / fromVariantRawCatalog) stay live.
const productApiMocks = vi.hoisted(() => ({ updateVariant: vi.fn() }))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: { ...actual.productApi, updateVariant: productApiMocks.updateVariant },
  }
})

const makeVariant = (overrides: Partial<ProductVariant> = {}): ProductVariant => ({
  id: 'v1',
  productId: 'p1',
  name: 'Rojo',
  option: null,
  value: null,
  sku: 'SKU-1',
  barcode: '',
  priceCents: 100,
  quantity: 5,
  minQuantity: 1,
  purchaseNetCostCents: null,
  purchaseNetCostDecimal: null,
  variantPrices: [],
  catalogPublishMode: 'INHERIT',
  onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
  ...overrides,
})

const PUBLISH_MODE_LABELS = {
  INHERIT: 'Usar publicación del producto',
  ON: 'Publicar esta variante',
  OFF: 'Ocultar esta variante',
} as const

// Real UModal teleports its body into a document.body portal (stubs do not
// apply through mountWithUApp), so queries go through the document.
const q = (selector: string) => new DOMWrapper(document.querySelector(selector)!)

let queryClient: QueryClient
let invalidateSpy: ReturnType<typeof vi.spyOn>

// Retain the real UApp host so cleanup disposes Vue effects, not just DOM.
const rootUnmounted = vi.fn()
let capturedRoot: VueWrapper | undefined
const mountModalRoot = async (
  variant: ProductVariant | null,
  overrides: Record<string, unknown> = {},
): Promise<VueWrapper> => {
  const RootCatcher = defineComponent({
    components: { UApp },
    setup() {
      onUnmounted(rootUnmounted)
      return () =>
        h(UApp, null, {
          default: () =>
            h(VariantDetailModal as Component, {
              open: true,
              productId: 'p1',
              productName: 'Test',
              productPurchaseNetCostCents: 0,
              useStock: false,
              canUpdate: true,
              variant,
              ...overrides,
            }),
        })
    },
  })
  const rootWrapper = mount(RootCatcher, {
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
  capturedRoot = rootWrapper
  await flushPromises()
  return rootWrapper.findComponent(VariantDetailModal as Component) as VueWrapper
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
  productApiMocks.updateVariant.mockReset()
  productApiMocks.updateVariant.mockResolvedValue({ id: 'v1' })
  mockToast.add.mockClear()
  rootUnmounted.mockClear()
  capturedRoot = undefined
})

const cleanupModal = () => {
  try {
    capturedRoot?.unmount()
  } finally {
    capturedRoot = undefined
    document.body.innerHTML = ''
    queryClient.clear()
    invalidateSpy.mockRestore()
  }
}

afterEach(cleanupModal)

const mountModal = async (
  variant: ProductVariant | null,
  overrides: Record<string, unknown> = {},
): Promise<VueWrapper> => {
  return mountModalRoot(variant, overrides)
}

const clickSave = async () => {
  const save = [...document.body.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Guardar'),
  )
  expect(save).toBeDefined()
  await new DOMWrapper(save!).trigger('click')
  await flushPromises()
}

const patchBody = (call = 0) => productApiMocks.updateVariant.mock.calls[call]![2]

// Nuxt UI select fields render a USelectMenu trigger button (not a native
// <select>), so options are chosen through the rendered popup: open the
// selector, click the option by its visible Spanish label, and await Vue
// updates. scrollIntoView is stubbed only for the Nuxt UI popup lifetime.
async function selectOptionByLabel(testid: string, label: string) {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })

  try {
    await q(`[data-testid="${testid}"]`).trigger('click')
    await nextTick()
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
    const option = options.reverse().find((element) => element.textContent?.trim() === label)
    expect(option, `expected a rendered option labeled "${label}"`).toBeDefined()
    await new DOMWrapper(option!).trigger('click')
    await nextTick()
  } finally {
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView,
      })
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  }
}

const selectStockOverrideMode = (label: string) => selectOptionByLabel('stock-override-mode', label)
const selectPublishMode = (label: string) => selectOptionByLabel('catalog-publish-mode', label)

describe('VariantDetailModal — root cleanup', () => {
  it('unmounts Vue effects as well as restoring the pre-mount dialog baseline', async () => {
    const dialogCount = () => document.querySelectorAll('[role="dialog"]').length
    const baseline = dialogCount()
    await mountModal(makeVariant())
    expect(dialogCount()).toBeGreaterThan(baseline)
    expect(rootUnmounted).not.toHaveBeenCalled()

    cleanupModal()

    // Clearing innerHTML alone removes the dialog but never runs Vue teardown.
    expect(dialogCount()).toBe(baseline)
    expect(rootUnmounted).toHaveBeenCalledTimes(1)
  })
})

describe('VariantDetailModal — persisted-variant catalog controls (REQ-16)', () => {
  it('renders the publication selector with the inherited option selected for persisted variants', async () => {
    await mountModal(makeVariant())
    const select = q('[data-testid="catalog-publish-mode"]')

    expect(select.exists()).toBe(true)
    expect(select.text()).toContain('Usar publicación del producto')
    expect(select.attributes('aria-haspopup')).toBe('listbox')
    expect(q('[data-testid="stock-override-mode"]').exists()).toBe(true)
  })

  it('offers the three contextual publication options through the rendered selector', async () => {
    await mountModal(makeVariant())
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })

    try {
      await q('[data-testid="catalog-publish-mode"]').trigger('click')
      await nextTick()
      const labels = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map(
        (option) => option.textContent?.trim(),
      )
      expect(labels).toEqual([
        'Usar publicación del producto',
        'Publicar esta variante',
        'Ocultar esta variante',
      ])
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        })
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    }
  })

  it('wires the publication label to the rendered selector', async () => {
    await mountModal(makeVariant())
    const trigger = q('[data-testid="catalog-publish-mode"]')
    const label = [...document.body.querySelectorAll('label')].find(
      (element) => element.textContent?.trim() === 'Publicación en catálogo',
    )

    expect(label).toBeDefined()
    expect(trigger.attributes('id')).toBe(label!.getAttribute('for'))
    // reka-ui hardcodes an English "Show popup" name on the trigger, so the
    // Spanish accessible name is pinned explicitly on the control.
    expect(trigger.attributes('aria-label')).toBe('Publicación en catálogo')
    expect(trigger.attributes('aria-haspopup')).toBe('listbox')
  })

  it('disables the publication selector when the variant cannot be updated', async () => {
    await mountModal(makeVariant(), { canUpdate: false })

    expect(q('[data-testid="catalog-publish-mode"]').attributes('disabled')).toBeDefined()
  })

  it('previews the variant-scope product inheritance when no override is set', async () => {
    await mountModal(makeVariant())
    const preview = q('[data-testid="stock-override-preview"]')

    expect(preview.text()).toContain('Usar configuración del producto')
    expect(preview.text()).toContain('El stock mostrado se toma de la configuración del producto.')
  })

  it('keeps the catalog controls absent for non-persisted (create/inline) variant objects', async () => {
    const {
      catalogPublishMode: _p,
      onlineStockPresentation: _s,
      onlineStockPresentationCustomQty: _q,
      ...bare
    } = makeVariant()
    await mountModal(bare as ProductVariant)
    expect(document.querySelector('[data-testid="catalog-publish-mode"]')).toBeNull()
    expect(document.querySelector('[data-testid="stock-override-mode"]')).toBeNull()
  })

  it.each([
    ['ON', 'INHERIT'],
    ['OFF', 'INHERIT'],
    ['INHERIT', 'ON'],
  ] as const)(
    'saves a %s mode change from pristine %s as the only PATCH key',
    async (mode, pristineMode) => {
      await mountModal(makeVariant({ catalogPublishMode: pristineMode }))
      await selectPublishMode(PUBLISH_MODE_LABELS[mode])
      await clickSave()
      expect(patchBody()).toEqual({ catalogPublishMode: mode })
    },
  )

  it('round-trips the stock override pair and emits no stock keys when only the mode changed', async () => {
    await mountModal(makeVariant())
    await selectStockOverrideMode('Mostrar cantidad fija')
    await q('[data-testid="stock-override-qty"]').setValue('5')
    await clickSave()
    expect(patchBody()).toEqual({
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 5,
    })
  })

  it('preserves customQuantity 0 literally with the "Mostrar 0" label', async () => {
    await mountModal(makeVariant())
    await selectStockOverrideMode('Mostrar cantidad fija')
    expect(document.body.textContent).toContain('Mostrar 0')
    await clickSave()
    expect(patchBody()).toEqual({
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
    })
  })

  it('clearing an existing stock override sends BOTH flat stock fields as null (keys not omitted)', async () => {
    await mountModal(
      makeVariant({ onlineStockPresentation: 'HIDDEN', onlineStockPresentationCustomQty: null }),
    )
    await selectStockOverrideMode('Usar configuración del producto')
    await clickSave()
    expect(patchBody()).toEqual({
      onlineStockPresentation: null,
      onlineStockPresentationCustomQty: null,
    })
  })

  it('emits no catalog keys when the catalog controls are unchanged', async () => {
    await mountModal(makeVariant())
    await q('input').setValue('SKU-NEW')
    await clickSave()
    expect(patchBody()).toEqual({ sku: 'SKU-NEW' })
  })

  it('non-persisted modal edits emit no catalog keys (actual create/inline builders are untouched, verified statically)', async () => {
    const {
      catalogPublishMode: _p,
      onlineStockPresentation: _s,
      onlineStockPresentationCustomQty: _q,
      ...bare
    } = makeVariant()
    await mountModal(bare as ProductVariant)
    await q('input').setValue('SKU-NEW')
    await clickSave()
    expect(patchBody()).toEqual({ sku: 'SKU-NEW' })
  })

  it('invalidates productQueryKeys.variants only after a successful catalog save', async () => {
    await mountModal(makeVariant())
    await selectPublishMode(PUBLISH_MODE_LABELS.OFF)
    await clickSave()
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: productQueryKeys.variants('tenant-1', 'p1'),
    })
  })

  // Real mounted autosave path: blur-driven persistChanges(includeCatalog=false)
  // must never mark an unsent catalog draft pristine (verifier blocker).
  it.each([['resolved'], ['rejected']] as const)(
    'cost autosave that %s keeps the unsent catalog draft pending until explicit Save',
    async (outcome) => {
      await mountModal(makeVariant())
      await selectPublishMode(PUBLISH_MODE_LABELS.OFF)
      if (outcome === 'rejected') {
        productApiMocks.updateVariant.mockRejectedValueOnce(new Error('boom'))
      }
      const cost = q('input[inputmode="decimal"]')
      await cost.setValue('12.5')
      await (cost.element as HTMLInputElement).dispatchEvent(new Event('blur'))
      await flushPromises()
      expect(patchBody(0)).toEqual({ purchaseNetCostCents: 1250 })
      await clickSave()
      // resolved: cost pristine advanced; rejected: cost draft stays pending too.
      expect(patchBody(1)).toEqual(
        outcome === 'resolved'
          ? { catalogPublishMode: 'OFF' }
          : { purchaseNetCostCents: 1250, catalogPublishMode: 'OFF' },
      )
    },
  )
})
