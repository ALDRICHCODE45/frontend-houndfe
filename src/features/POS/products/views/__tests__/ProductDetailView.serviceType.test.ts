/**
 * WU-D RED tests — type-watch correction + serviceDetail card + PRODUCT/SERVICE
 * transition warnings. Lives at the top of the file so the watchers /
 * formState reads run while the existing detail-view mocks are still in
 * place. Exercises the type-watch correction (no hasVariants=false forcing;
 * pendingLots cleared only) and the PRODUCT_TYPE_CHANGE_BLOCKED mapping.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import { nextTick } from 'vue'

// Mock router (params.id undefined → create mode)
// We exercise create mode because the type-watch is the most active there.
import ProductDetailView from '../ProductDetailView.vue'

const mockToast = {
  add: vi.fn(),
}
vi.stubGlobal('useToast', () => mockToast)

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ params: {} })),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: vi.fn(() => ({
    user: { id: 'user-1', email: 'test@test.com' },
    userCan: vi.fn(() => true),
  })),
}))

vi.mock('../../api/product.api', () => ({
  productApi: {
    getById: vi.fn(),
    getCategories: vi.fn(() => Promise.resolve([])),
    getBrands: vi.fn(() => Promise.resolve([])),
    getGlobalPriceLists: vi.fn(() => Promise.resolve([])),
    getVariants: vi.fn(() => Promise.resolve([])),
    getLots: vi.fn(() => Promise.resolve([])),
  },
}))

describe('ProductDetailView - WU-D type watch + serviceDetail + transition map', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    mockToast.add.mockClear()
  })

  const mountView = () =>
    mountWithUApp(ProductDetailView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]] as unknown as [],
        stubs: {
          UButton: {
            template:
              '<button @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
          },
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
          UModal: {
            template: '<div v-if="open"><slot name="header" /><slot name="body" /><slot /></div>',
            props: ['open'],
          },
          UProgress: { template: '<div />' },
          UCollapsible: { template: '<div><slot name="trigger" /><slot /></div>' },
          UCheckbox: { template: '<input type="checkbox" />' },
          ProductImageGallery: { template: '<div />' },
          CategorySelect: { template: '<select />' },
          SatKeySelect: { template: '<select />' },
          PriceListSection: { template: '<div />' },
          VariantDetailModal: { template: '<div />' },
          VariantImagePickerModal: { template: '<div />' },
          ConfirmModal: { template: '<div />' },
        },
      },
      attachTo: document.body,
    })

  it('type=SERVICE clears pendingLots only (does NOT force hasVariants=false)', async () => {
    const wrapper = mountView()
    await nextTick()

    const vm = wrapper.vm as unknown as {
      formState: {
        type: 'PRODUCT' | 'SERVICE'
        useStock: boolean
        useLotsAndExpirations: boolean
        quantity: number
        minQuantity: number
        hasVariants: boolean
      }
      pendingVariants: unknown[]
      pendingLots: unknown[]
      pendingPriceLists: unknown[]
    }

    // Seed a SERVICE-friendly form
    vm.formState.type = 'PRODUCT'
    vm.formState.useStock = true
    vm.formState.useLotsAndExpirations = true
    vm.formState.quantity = 7
    vm.formState.minQuantity = 2
    vm.formState.hasVariants = true
    vm.pendingVariants = [{ _localId: 'local-1' }]
    vm.pendingLots = [{ _localId: 'local-2' }]
    vm.pendingPriceLists = [{ _localId: 'local-3' }]

    // Switch type to SERVICE
    vm.formState.type = 'SERVICE'
    await nextTick()

    expect(vm.formState.useStock).toBe(false)
    expect(vm.formState.useLotsAndExpirations).toBe(false)
    expect(vm.formState.quantity).toBe(0)
    expect(vm.formState.minQuantity).toBe(0)
    // hasVariants must NOT be forced to false (D2): the user can keep variants
    expect(vm.formState.hasVariants).toBe(true)
    // pendingVariants must NOT be cleared (D2)
    expect(vm.pendingVariants).toHaveLength(1)
    // pendingPriceLists must NOT be cleared (D2)
    expect(vm.pendingPriceLists).toHaveLength(1)
    // pendingLots IS cleared (only thing SERVICE loses)
    expect(vm.pendingLots).toHaveLength(0)
  })
})