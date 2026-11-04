// O1 S1 — the variant modal shows the stock read-only and no PATCH it sends
// (blur autosave of another field, or Guardar) carries `quantity`.

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

describe('VariantDetailModal — read-only quantity', () => {
  it('shows the stock as a read-only figure with the hint, not as an input', async () => {
    await mountModal()
    const stock = q('[data-testid="variant-modal-stock-readonly"]')
    expect(stock.text()).toContain('15')
    expect(stock.text()).toContain('Se ajusta desde Inventario')
    expect(document.querySelector('input[aria-label="Cantidad"]')).toBeNull()
    // Only "Cantidad mínima" stays editable in the stock card.
    expect(bodyText()).toContain('Cantidad mínima')
  })

  it('never autosaves quantity: no PATCH on blur or Enter over the stock figure', async () => {
    await mountModal()
    const stock = q('[data-testid="variant-modal-stock-readonly"]')
    await stock.trigger('blur')
    await stock.trigger('keyup.enter')
    await flushPromises()
    expect(apiMocks.updateVariant).not.toHaveBeenCalled()
  })

  it('autosaves another field without quantity in the body', async () => {
    await mountModal()
    const sku = q('input[placeholder="SKU"]')
    await sku.setValue('SKU-NEW')
    await sku.trigger('blur')
    await flushPromises()
    expect(apiMocks.updateVariant).toHaveBeenCalledTimes(1)
    const body = apiMocks.updateVariant.mock.calls[0]![2]
    expect(body).toEqual({ sku: 'SKU-NEW' })
    expect(body).not.toHaveProperty('quantity')
  })

  it('Guardar sends the changed fields and never quantity', async () => {
    await mountModal()
    await q('input[placeholder="SKU"]').setValue('SKU-2')
    await click('Guardar')
    expect(apiMocks.updateVariant).toHaveBeenCalledTimes(1)
    const body = apiMocks.updateVariant.mock.calls[0]![2]
    expect(body).toMatchObject({ sku: 'SKU-2' })
    expect(body).not.toHaveProperty('quantity')
  })
})
