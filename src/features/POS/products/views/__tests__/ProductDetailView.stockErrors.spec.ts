/**
 * O1 S7 — ProductDetailView stock rules on edit:
 *  - the four backend codes show human copy next to the field/action involved
 *    (by `error` code, never the server message);
 *  - "Controlar inventario" is locked while there is stock, with a one-line reason;
 *  - the first variant of a product with stock asks for confirmation first.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'
import ProductLotsTable from '../../components/ProductLotsTable.vue'

const toast = vi.hoisted(() => vi.fn())
vi.stubGlobal('useToast', () => ({ add: toast }))
vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return { ...actual, useToast: () => ({ ...actual.useToast(), add: toast }) }
})
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
  getVariants: vi.fn(),
  getLots: vi.fn(),
  update: vi.fn(),
  removeLot: vi.fn(),
  createVariant: vi.fn(),
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

const SERVER_MESSAGE = 'Cannot do that: raw server wording'

const reject = (code: string, status = 409) => ({
  response: { status, data: { statusCode: status, error: code, message: SERVER_MESSAGE } },
})

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
  return root.findComponent(ProductDetailView as Component)
}

const byId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

async function saveRejected(view: Awaited<ReturnType<typeof mountView>>, code: string, status = 409) {
  api.update.mockRejectedValueOnce(reject(code, status))
  await view.get('input[name="name"]').setValue('Nombre nuevo')
  ;(view.get('#product-detail-form').element as HTMLFormElement).requestSubmit()
  await vi.waitFor(() => expect(api.update).toHaveBeenCalled())
  await flushPromises()
}

function switchByLabel(text: string): HTMLButtonElement {
  const label = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === text)!
  return document.getElementById(label.getAttribute('for')!) as HTMLButtonElement
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  for (const mock of Object.values(api)) mock.mockReset()
  api.getVariants.mockResolvedValue([])
  api.getLots.mockResolvedValue([])
  api.update.mockResolvedValue(product)
  api.createVariant.mockResolvedValue({ id: 'v-new' })
  toast.mockReset()
})

afterEach(() => {
  root?.unmount()
  root = undefined
  queryClient.clear()
  document.body.innerHTML = ''
})

describe('ProductDetailView — product save errors by code', () => {
  it.each([
    ['STOCK_TRACKING_HAS_STOCK', 'use-stock-error', 'Hay existencias. Ajusta el stock a 0 antes de desactivar «Usar stock».', 409],
    ['STOCK_QUANTITY_READ_ONLY', 'quantity-error', 'El stock no se edita aquí. Ajústalo desde Inventario.', 400],
    ['PRODUCT_TYPE_CHANGE_BLOCKED', 'type-error', 'El producto tiene existencias o lotes. Ajusta el stock a 0 antes de cambiar el tipo.', 422],
  ])('%s shows its copy next to the field and not the server message', async (code, testId, copy, status) => {
    const view = await mountView()
    await saveRejected(view, code, status)
    const field = byId(testId)!
    expect(field.textContent).toContain(copy)
    expect(field.getAttribute('role')).toBe('alert')
    expect(document.body.textContent).not.toContain(SERVER_MESSAGE)
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith({
      title: 'Error al actualizar producto',
      description: copy,
      color: 'error',
    })
  })

  it('clears the field copy on the next save attempt', async () => {
    const view = await mountView()
    await saveRejected(view, 'STOCK_TRACKING_HAS_STOCK')
    expect(byId('use-stock-error')).not.toBeNull()
    ;(view.get('#product-detail-form').element as HTMLFormElement).requestSubmit()
    await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2))
    await flushPromises()
    expect(byId('use-stock-error')).toBeNull()
  })

  it('shows LOT_HAS_STOCK next to the lots table when deleting a lot, and keeps the lot', async () => {
    api.getLots.mockResolvedValue([
      {
        id: 'lot-1',
        productId: 'prod-1',
        lotNumber: 'L-2027-01',
        expirationDate: '2027-01-15',
        quantity: 22,
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z',
      },
    ])
    api.removeLot.mockRejectedValue(reject('LOT_HAS_STOCK'))
    const view = await mountView({ quantity: 22, useLotsAndExpirations: true })
    await vi.waitFor(() => expect(view.text()).toContain('L-2027-01'))
    view.findComponent(ProductLotsTable).vm.$emit('delete', {
      id: 'lot-1',
      lotNumber: 'L-2027-01',
      expirationDate: '2027-01-15',
      quantity: 22,
    })
    await flushPromises()
    const confirm = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Eliminar')!
    confirm.click()
    await vi.waitFor(() => expect(api.removeLot).toHaveBeenCalledWith('prod-1', 'lot-1'))
    await flushPromises()
    const field = byId('lot-error')!
    expect(field.textContent).toContain(
      'El lote aún tiene existencias. Ajústalas a 0 antes de eliminarlo.',
    )
    expect(field.getAttribute('role')).toBe('alert')
    expect(document.body.textContent).not.toContain(SERVER_MESSAGE)
    // The lot and its stock are untouched.
    expect(view.text()).toContain('L-2027-01')
  })
})

describe('ProductDetailView — "Controlar inventario" lock', () => {
  it('is disabled with a one-line reason while there is stock', async () => {
    await mountView({ quantity: 12 })
    expect(switchByLabel('Controlar inventario').hasAttribute('disabled')).toBe(true)
    expect(byId('use-stock-locked-reason')!.textContent?.trim()).toBe(
      'Hay existencias: ajusta el stock a 0 para desactivarlo.',
    )
  })

  it('locks it too when only the variants hold stock', async () => {
    await mountView({ quantity: 0, variantStockTotal: 4, hasVariants: true })
    expect(switchByLabel('Controlar inventario').hasAttribute('disabled')).toBe(true)
  })

  it('is enabled, with no reason, at zero stock', async () => {
    await mountView({ quantity: 0 })
    expect(switchByLabel('Controlar inventario').hasAttribute('disabled')).toBe(false)
    expect(byId('use-stock-locked-reason')).toBeNull()
  })
})

describe('ProductDetailView — first variant on a product with stock', () => {
  async function submitNewVariant(view: Awaited<ReturnType<typeof mountView>>) {
    const add = view.findAll('button').find((b) => b.text().includes('Agregar variante'))!
    await add.trigger('click')
    await flushPromises()
    const form = document.getElementById('variant-modal-form') as HTMLFormElement
    const option = form.querySelector('select[name="option"]') as HTMLSelectElement
    option.value = 'Color'
    option.dispatchEvent(new Event('input', { bubbles: true }))
    option.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    const value = form.querySelector('input[name="value"]') as HTMLInputElement
    value.value = 'Rojo'
    value.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    form.requestSubmit()
    await flushPromises()
  }
  const confirmButton = () =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Crear variante')

  it('asks first, with the stock going to 0, and creates only after confirming', async () => {
    const view = await mountView({ quantity: 12, hasVariants: true })
    await submitNewVariant(view)
    expect(document.body.textContent).toContain('El stock actual pasa a 0')
    expect(api.createVariant).not.toHaveBeenCalled()
    confirmButton()!.click()
    await vi.waitFor(() => expect(api.createVariant).toHaveBeenCalledTimes(1))
    expect(api.createVariant.mock.calls[0]![0]).toBe('prod-1')
    expect(api.createVariant.mock.calls[0]![1]).toMatchObject({ option: 'Color', value: 'Rojo', quantity: 0 })
  })

  it('keeps the variant modal open and sends nothing when the user cancels', async () => {
    const view = await mountView({ quantity: 12, hasVariants: true })
    await submitNewVariant(view)
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) =>
      d.textContent?.includes('El stock actual pasa a 0'),
    )!
    const cancel = [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Cancelar')!
    cancel.click()
    await flushPromises()
    expect(api.createVariant).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(document.body.textContent).not.toContain('El stock actual pasa a 0'))
    expect(document.getElementById('variant-modal-form')).not.toBeNull()
  })

  it('does not ask when the product has no stock', async () => {
    const view = await mountView({ quantity: 0, hasVariants: true })
    await submitNewVariant(view)
    expect(document.body.textContent).not.toContain('El stock actual pasa a 0')
    await vi.waitFor(() => expect(api.createVariant).toHaveBeenCalledTimes(1))
  })

  it('does not ask when the product already has variants', async () => {
    api.getVariants.mockResolvedValue([
      {
        id: 'v1',
        productId: 'prod-1',
        name: 'Azul',
        option: 'Color',
        value: 'Azul',
        sku: '',
        barcode: '',
        priceCents: 1000,
        quantity: 5,
        minQuantity: 0,
        purchaseNetCostCents: null,
        purchaseNetCostDecimal: null,
        variantPrices: [],
        createdAt: '2026-04-23T00:00:00.000Z',
        updatedAt: '2026-04-23T00:00:00.000Z',
      },
    ])
    const view = await mountView({ quantity: 0, variantStockTotal: 5, hasVariants: true })
    await submitNewVariant(view)
    expect(document.body.textContent).not.toContain('El stock actual pasa a 0')
    await vi.waitFor(() => expect(api.createVariant).toHaveBeenCalledTimes(1))
  })
})
