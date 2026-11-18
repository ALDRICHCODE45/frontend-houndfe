// T6a (S2–S3) — the variant modal is one surface with plain titled sections
// (General, Existencias, Catálogo online, Precios), never cards inside a modal.

import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import VariantDetailModal from '@/features/POS/products/components/VariantDetailModal.vue'
import type { ProductVariant } from '../../interfaces/product.types'

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({ currentTenantId: 'tenant-1' })),
}))

const variant: ProductVariant = {
  id: 'v1',
  productId: 'p1',
  name: 'Rojo',
  option: null,
  value: null,
  sku: 'SKU-1',
  barcode: '',
  priceCents: 100,
  quantity: 15,
  minQuantity: 1,
  purchaseNetCostCents: null,
  purchaseNetCostDecimal: null,
  variantPrices: [],
  catalogPublishMode: 'INHERIT',
  onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null,
  createdAt: '2026-04-23T00:00:00.000Z',
  updatedAt: '2026-04-23T00:00:00.000Z',
}

const source = readFileSync('src/features/POS/products/components/VariantDetailModal.vue', 'utf8')

let queryClient: QueryClient
let root: VueWrapper | undefined

async function mountModal() {
  root = mount(
    defineComponent({
      render: () =>
        h(UApp, null, {
          default: () =>
            h(VariantDetailModal as Component, {
              open: true,
              productId: 'p1',
              productName: 'Collar',
              productPurchaseNetCostCents: 0,
              useStock: true,
              canUpdate: true,
              variant,
            }),
        }),
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] }, attachTo: document.body },
  )
  await flushPromises()
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  root?.unmount()
  root = undefined
  document.body.innerHTML = ''
  queryClient.clear()
})

describe('VariantDetailModal — sections, not cards', () => {
  it('has no UCard in its template', () => {
    expect(source).not.toMatch(/<UCard\b/)
  })

  it('renders four labelled sections with 16px/600 headings', async () => {
    await mountModal()
    const sections = [...document.querySelectorAll<HTMLElement>('.product-modal-sections > section.product-modal-section')]
    const titles = sections.map((section) => {
      const heading = document.getElementById(section.getAttribute('aria-labelledby') ?? '')
      expect(heading?.classList.contains('product-modal-section__title')).toBe(true)
      return heading?.textContent?.trim()
    })
    expect(titles).toEqual(['General', 'Existencias', 'Catálogo online', 'Precios'])
  })
})

// T8 D6: at 390 the wrapped title ran under the absolute close button (top-4 end-4).
describe('VariantDetailModal — the title never sits under the close button', () => {
  it('reserves the close button lane on the header end at every width', async () => {
    await mountModal()
    const header = document.querySelector<HTMLElement>('[role="dialog"] [data-slot="header"]')
    expect(header).not.toBeNull()
    expect(header!.className).toMatch(/(^|\s)pe-14(\s|$)/)
    expect(header!.className).toMatch(/(^|\s)sm:pe-14(\s|$)/)
  })
})
