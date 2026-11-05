// T22 — the variant cost autosaves only an amount that reads with the one
// money rule (parseMoneyInput), with the exact cents in the PATCH.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import VariantDetailModal from '@/features/POS/products/components/VariantDetailModal.vue'
import type { ProductVariant } from '../../interfaces/product.types'

const mockToast = { add: vi.fn() }
vi.stubGlobal('useToast', () => mockToast)

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({ currentTenantId: 'tenant-1' })),
}))

const apiMocks = vi.hoisted(() => ({ updateVariant: vi.fn() }))
vi.mock('../../api/product.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/product.api')>()
  return { ...actual, productApi: { ...actual.productApi, updateVariant: apiMocks.updateVariant } }
})

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

const q = (selector: string) => new DOMWrapper(document.querySelector(selector)!)
const bodyText = () => document.body.textContent ?? ''
const click = async (label: string) => {
  const button = [...document.body.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  )
  await new DOMWrapper(button!).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  apiMocks.updateVariant.mockReset()
  apiMocks.updateVariant.mockResolvedValue({ id: 'v1' })
  mockToast.add.mockClear()
})

afterEach(() => {
  root?.unmount()
  root = undefined
  document.body.innerHTML = ''
  queryClient.clear()
})

describe('VariantDetailModal — cost', () => {
  const cost = () => q('input[inputmode="decimal"]')

  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
  ])('saves %j as %i cents on blur', async (text, cents) => {
    await mountModal()
    await cost().setValue(text)
    await cost().trigger('blur')
    await flushPromises()
    expect(apiMocks.updateVariant).toHaveBeenCalledWith('p1', 'v1', { purchaseNetCostCents: cents })
  })

  it('sends nothing for text that does not read as an amount and shows why', async () => {
    await mountModal()
    await cost().setValue('12abc')
    await cost().trigger('blur')
    await flushPromises()
    expect(apiMocks.updateVariant).not.toHaveBeenCalled()
    expect(bodyText()).toContain('Escribe solo el monto en números, por ejemplo 70.55.')
  })

  it('does not save Guardar while the cost does not read', async () => {
    await mountModal()
    await cost().setValue('1,23,4')
    await click('Guardar')
    expect(apiMocks.updateVariant).not.toHaveBeenCalled()
  })
})
