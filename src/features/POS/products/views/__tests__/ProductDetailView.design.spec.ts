/**
 * T6a (S2–S3) — the product detail sits on the design system:
 *  - no UCard stack, USwitch row or URadioGroup in the view's own template
 *    (section cards, whole-row switches, a segmented control instead);
 *  - Presentaciones groups its own fields in HfSectionCard sections;
 *  - every on/off row the view owns is a whole-row `role="switch"` (HfSwitchRow);
 *  - the pending-variant modal uses plain titled sections, never cards in a modal.
 * Presentation only: values, events and test ids are covered by the other specs.
 */

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'prod-1' } }),
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
  getVariants: vi.fn(async () => []),
  getLots: vi.fn(async () => []),
}))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return {
    ...actual,
    productApi: {
      ...actual.productApi,
      ...api,
      getCategories: vi.fn(async () => []),
      getBrands: vi.fn(async () => []),
      getGlobalPriceLists: vi.fn(async () => []),
      getPriceLists: vi.fn(async () => []),
    },
  }
})

const product = {
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
  quantity: 0,
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

const source = readFileSync('src/features/POS/products/views/ProductDetailView.vue', 'utf8')
const template = source.slice(source.indexOf('<template>'), source.lastIndexOf('</template>'))

let queryClient: QueryClient
let root: VueWrapper | undefined

async function mountView(overrides: Record<string, unknown> = {}) {
  api.getById.mockResolvedValue({ ...product, ...overrides })
  root = mount(
    defineComponent({
      render: () => h(UApp, null, { default: () => h(ProductDetailView as Component) }),
    }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  await flushPromises()
  await vi.waitFor(() => expect(document.querySelector('input[name="name"]')).not.toBeNull())
}

const presentations = () => document.querySelector<HTMLElement>('[data-product-task="presentations"]')!

/** Switches the view renders itself (the catalog settings section owns its own). */
function ownSwitches(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('#product-detail-form [role="switch"]')].filter(
    (el) => !el.closest('[data-testid="product-catalog-settings"]'),
  )
}

const switchLabel = (el: HTMLElement) =>
  document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent?.trim()

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
})

afterEach(() => {
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

describe('ProductDetailView — design system structure', () => {
  it('has no UCard, USwitch or URadioGroup left in its own template', () => {
    expect(template).not.toMatch(/<UCard\b/)
    expect(template).not.toMatch(/<USwitch\b/)
    expect(template).not.toMatch(/<URadioGroup\b/)
  })

  it('groups the Presentaciones fields in section cards with 16px/600 headings', async () => {
    await mountView()
    const titles = [...presentations().querySelectorAll(':scope > .hf-section-card .hf-section-card__title')].map(
      (heading) => heading.textContent?.trim(),
    )
    // The sibling components (catálogo, empaque, precios) are section cards too since T6e.
    expect(titles).toEqual(expect.arrayContaining(['Costo e impuestos', 'Inventario', 'Variantes']))
    expect(titles).toEqual(expect.arrayContaining(['Catálogo online', 'Empaque para envío', 'Precios de venta']))
  })

  it('renders every on/off row it owns as a whole-row switch with its label inside', async () => {
    await mountView()
    const switches = ownSwitches()
    expect(switches.map(switchLabel)).toEqual([
      'Vender en punto de venta',
      'Incluir en catálogo en línea',
      'Requerir receta médica',
      'Cobrar impuestos',
      'Controlar inventario',
      'Usar lotes y vencimientos',
      'Tiene variantes',
    ])
    for (const el of switches) {
      expect(el.tagName).toBe('BUTTON')
      expect(el.classList.contains('hf-switch-row__button')).toBe(true)
      expect(el.querySelector('.hf-switch-row__label')).not.toBeNull()
    }
  })

  it('chooses the purchase price basis with a segmented control', async () => {
    await mountView()
    const group = presentations().querySelector('[role="radiogroup"]')!
    const options = [...group.querySelectorAll('[role="radio"]')].map((radio) => radio.textContent?.trim())
    expect(options).toEqual(['Neto · sin impuestos', 'Bruto · con impuestos'])
    expect(group.querySelector('[aria-checked="true"]')?.textContent?.trim()).toBe('Neto · sin impuestos')
  })

  it.each([
    ['product-variants', 'Agregar variante', {}],
    ['product-lots', 'Agregar lote', { useLotsAndExpirations: true }],
  ] as const)('puts %s in a section card with «%s» beside the title', async (id, action, overrides) => {
    await mountView(overrides)
    const section = document.getElementById(id)!
    expect(section.classList.contains('hf-section-card')).toBe(true)
    expect(section.querySelector('.hf-section-card__head')?.textContent).toContain(action)
  })
})

describe('ProductDetailView — pending variant modal sections', () => {
  it('uses titled sections instead of cards inside the modal', () => {
    const modal = template.slice(template.indexOf('v-model:open="isPendingVariantDetailModalOpen"'))
    const body = modal.slice(0, modal.indexOf('</UModal>'))
    expect(body).toContain('class="product-modal-sections"')
    expect(body.match(/<section[^>]*class="product-modal-section"/g)).toHaveLength(3)
  })
})
