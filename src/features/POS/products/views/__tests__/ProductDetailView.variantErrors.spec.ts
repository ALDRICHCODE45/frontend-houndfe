import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { defineComponent, h } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import ProductDetailView from '../ProductDetailView.vue'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
  removeVariant: vi.fn(),
}))
vi.stubGlobal('useToast', () => ({ add: mocks.toast }))
vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return { ...actual, useToast: () => ({ ...actual.useToast(), add: mocks.toast }) }
})
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'product-1' } }),
  useRouter: () => ({ push: mocks.push }),
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-1',
    userCan: (_action: string, resource: string) => resource !== 'TenantCatalogSettings',
  }),
}))
vi.mock('../../api/product.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/product.api')>()),
  productApi: {
    getById: vi.fn(async () => ({
      id: 'product-1',
      name: 'Producto con variantes',
      type: 'PRODUCT',
      sku: '',
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
      hasVariants: true,
      sellInPos: true,
      includeInOnlineCatalog: true,
      requiresPrescription: false,
      chargeProductTaxes: true,
      ivaRate: 'IVA_16',
      iepsRate: 'NO_APLICA',
      purchaseCostMode: 'NET',
      purchaseNetCostCents: 0,
    })),
    getCategories: vi.fn(async () => []),
    getBrands: vi.fn(async () => []),
    getGlobalPriceLists: vi.fn(async () => []),
    getVariants: vi.fn(async () => []),
    getLots: vi.fn(async () => []),
    getPriceLists: vi.fn(async () => []),
    update: mocks.update,
    removeVariant: mocks.removeVariant,
  },
}))

let root: ReturnType<typeof mount> | undefined
let queryClient: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
})
afterEach(() => {
  root?.unmount()
  queryClient.clear()
  document.body.innerHTML = ''
})

async function submitRejectedUpdate(error: unknown) {
  mocks.update.mockRejectedValue(error)
  root = mount(
    defineComponent({ render: () => h(UApp, null, { default: () => h(ProductDetailView) }) }),
    {
      attachTo: document.body,
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    },
  )
  await flushPromises()
  const view = root.findComponent(ProductDetailView)
  await view.get('input[name="name"]').setValue('Nombre pendiente')
  const label = view.findAll('label').find((item) => item.text() === 'Tiene variantes')!
  const toggle = view.get(`[id="${label.attributes('for')}"]`)
  expect(toggle.attributes('aria-checked')).toBe('true')
  await toggle.trigger('click')
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  ;(view.get('#product-detail-form').element as HTMLFormElement).requestSubmit()
  await vi.waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1))
  await flushPromises()
  expect(mocks.update).toHaveBeenCalledWith(
    'product-1',
    expect.objectContaining({
      name: 'Nombre pendiente',
      hasVariants: false,
    }),
  )
  expect(view.get('input[name="name"]').element).toHaveProperty('value', 'Nombre pendiente')
  expect(toggle.attributes('aria-checked')).toBe('false')
  expect(invalidate).not.toHaveBeenCalled()
  expect(mocks.push).not.toHaveBeenCalled()
  expect(mocks.removeVariant).not.toHaveBeenCalled()
  expect(mocks.toast).toHaveBeenCalledTimes(1)
}

describe('ProductDetailView rejected variant updates', () => {
  it('explains PRODUCT_HAS_VARIANTS from the real 422 error without losing pending edits', async () => {
    await submitRejectedUpdate({
      response: {
        status: 422,
        data: {
          statusCode: 422,
          error: 'PRODUCT_HAS_VARIANTS',
          message: 'Cannot disable variants while the Product still has Variants',
          timestamp: '2026-10-27T17:30:00.000Z',
          productId: '00000000-0000-4000-8000-000000000001',
          variantCount: 2,
        },
      },
    })
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Error al actualizar producto',
      color: 'error',
      description:
        'No puedes desactivar las variantes mientras el producto tenga variantes. Elimínalas primero.',
    })
  })

  it.each([
    [
      { response: { data: { error: 'PRODUCT_TYPE_CHANGE_BLOCKED' } } },
      'No se puede cambiar el tipo de producto porque tiene ventas o movimientos asociados.',
    ],
    [
      { response: { data: { error: 'SAT_KEY_NOT_FOUND', message: 'Clave SAT inválida.' } } },
      'Clave SAT inválida.',
    ],
    [
      { response: { data: { error: 'UNKNOWN_CODE', message: 'Mensaje del servidor' } } },
      'Mensaje del servidor',
    ],
    [
      {
        response: {
          data: {
            error: 'UNKNOWN_CODE',
            message: 'Cannot disable variants while the Product still has Variants',
          },
        },
      },
      'Cannot disable variants while the Product still has Variants',
    ],
    [new Error('offline'), 'No pudimos completar la operación. Reintenta en unos segundos.'],
  ])('preserves legacy/default feedback for %j', async (error, description) => {
    await submitRejectedUpdate(error)
    expect(mocks.toast).toHaveBeenCalledWith({
      title: 'Error al actualizar producto',
      color: 'error',
      description,
    })
  })
})
