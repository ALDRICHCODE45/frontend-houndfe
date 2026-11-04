/**
 * Regression guard — ProductsView setup must not throw.
 *
 * WU-F wired `filterType`/`queryTypeParam` into `useServerTable`'s queryKey +
 * queryFn, but originally declared them AFTER the `useServerTable` call. That
 * is a temporal-dead-zone (TDZ) ReferenceError thrown the moment the real
 * TanStack `useQuery` reads the queryKey during setup — a crash the WU-F unit
 * tests never caught because they mocked `useServerTable` (so the config was
 * never evaluated).
 *
 * This test mounts with the REAL `useServerTable` + real `@tanstack/vue-query`
 * (VueQueryPlugin) so the queryKey is actually evaluated during setup. If the
 * declarations regress to after `useServerTable`, this mount throws.
 */

import { describe, it, expect, vi } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ProductsView from '../ProductsView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ query: {}, params: {} }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))

vi.mock('../../api/product.api', () => ({
  productApi: {
    getPaginated: vi.fn(() =>
      Promise.resolve({
        data: [],
        pagination: { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 0 },
      }),
    ),
    getCategories: vi.fn(() => Promise.resolve([])),
    getBrands: vi.fn(() => Promise.resolve([])),
    create: vi.fn(),
    createBrand: vi.fn(),
    createCategory: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getById: vi.fn(),
  },
}))

vi.stubGlobal('useToast', () => ({ add: vi.fn() }))

const baseStubs = {
  ProductList: { template: '<div />' },
  UCard: { template: '<div><slot name="header" /><slot /></div>' },
  Card: { template: '<div><slot name="header" /><slot /></div>' },
  UModal: { template: '<div />' },
  Modal: { template: '<div />' },
  UForm: { template: '<form><slot /></form>' },
  UFormField: { template: '<div><slot /></div>' },
  UInput: { template: '<input />' },
  UButton: { template: '<button><slot /></button>' },
  Button: { template: '<button><slot /></button>' },
  ConfirmModal: { template: '<div />' },
  ProductUpsertSlideover: { template: '<div />' },
  USelect: { template: '<select><slot /></select>' },
}

describe('ProductsView - setup must not throw (TDZ regression)', () => {
  it('mounts with real useServerTable without throwing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    const wrapper = mount(ProductsView, {
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: baseStubs,
      },
    })
    await nextTick()

    expect(wrapper.exists()).toBe(true)
    // The queryKey/queryFn wiring must reference queryTypeParam AFTER its
    // declaration; a TDZ here throws during setup, so reaching this line is
    // the actual assertion.
  })
})
