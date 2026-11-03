import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrderProductsApi, type OrderPickerProduct } from '../../api/purchase-order-products.api'
import { usePurchaseOrderProducts, usePurchaseOrderVariants } from '../usePurchaseOrderProducts'
vi.mock('../../api/purchase-order-products.api', () => ({ purchaseOrderProductsApi: { list: vi.fn(), variants: vi.fn() } }))
const product: OrderPickerProduct = { id: 'p', name: 'Arroz', type: 'PRODUCT', unit: 'KILOGRAMO', hasVariants: true, useStock: false }
const cleanups: Array<() => void> = []
function setup(patch = {}) {
  const context = shallowRef({ userId: 'user', tenantId: 'tenant', ready: true, canReadProduct: true, ...patch })
  const productId = shallowRef<string | null>('p')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  let list!: ReturnType<typeof usePurchaseOrderProducts>
  let variants!: ReturnType<typeof usePurchaseOrderVariants>
  const wrapper = mount(defineComponent({ setup() { list = usePurchaseOrderProducts(context); variants = usePurchaseOrderVariants(productId, context); return () => h('div') } }), { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  cleanups.push(() => { wrapper.unmount(); client.clear() })
  return { list, variants, context, productId }
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(purchaseOrderProductsApi.list).mockResolvedValue([product]); vi.mocked(purchaseOrderProductsApi.variants).mockResolvedValue([{ id: 'v', name: 'Grande' }]) })
afterEach(() => cleanups.splice(0).forEach(fn => fn()))
describe('scoped order product picker', () => {
  it('uses offset pages, ends on a short page and resets on search/context changes', async () => {
    vi.mocked(purchaseOrderProductsApi.list).mockResolvedValueOnce(Array.from({ length: 25 }, () => product))
    const { list, context } = setup(); await flushPromises()
    expect(purchaseOrderProductsApi.list).toHaveBeenLastCalledWith({ search: '', page: 1, limit: 25 }, expect.any(AbortSignal))
    expect(list.hasNext.value).toBe(true)
    list.next(); await flushPromises()
    expect(purchaseOrderProductsApi.list).toHaveBeenLastCalledWith({ search: '', page: 2, limit: 25 }, expect.any(AbortSignal))
    expect(list.hasNext.value).toBe(false); expect(list.hasPrevious.value).toBe(true)
    list.next(); await flushPromises(); expect(purchaseOrderProductsApi.list).toHaveBeenCalledTimes(2)
    list.back(); await flushPromises(); expect(list.hasPrevious.value).toBe(false)
    list.search.value = 'arroz'; expect(list.items.value).toEqual([]); await flushPromises()
    expect(purchaseOrderProductsApi.list).toHaveBeenLastCalledWith({ search: 'arroz', page: 1, limit: 25 }, expect.any(AbortSignal))
    context.value = { ...context.value, tenantId: 'other' }; await flushPromises()
    expect(purchaseOrderProductsApi.list).toHaveBeenLastCalledWith({ search: 'arroz', page: 1, limit: 25 }, expect.any(AbortSignal))
  })
  it.each([{ ready: false }, { canReadProduct: false }, { userId: '' }, { tenantId: '' }])('blocks reads and refresh without access %j', async patch => {
    const { list, variants } = setup(patch); await list.refresh(); await variants.refresh(); await flushPromises()
    expect(purchaseOrderProductsApi.list).not.toHaveBeenCalled(); expect(purchaseOrderProductsApi.variants).not.toHaveBeenCalled()
    expect(list.items.value).toEqual([]); expect(variants.items.value).toEqual([])
  })
  it.each(['userId', 'tenantId', 'ready', 'canReadProduct'] as const)('fences pending and loaded results across %s changes and restoration', async field => {
    let resolveList!: (v: OrderPickerProduct[]) => void
    let resolveVariants!: (v: Array<{ id: string; name: string }>) => void
    vi.mocked(purchaseOrderProductsApi.list).mockImplementationOnce(() => new Promise(resolve => { resolveList = resolve }))
    vi.mocked(purchaseOrderProductsApi.variants).mockImplementationOnce(() => new Promise(resolve => { resolveVariants = resolve }))
    const { list, variants, context } = setup(); await flushPromises()
    const original = context.value
    context.value = { ...original, [field]: typeof original[field] === 'boolean' ? false : 'other' }
    expect(list.items.value).toEqual([]); expect(variants.items.value).toEqual([]); await flushPromises()
    resolveList([{ ...product, id: 'stale' }]); resolveVariants([{ id: 'stale', name: 'Stale' }]); await flushPromises()
    context.value = original
    expect(list.items.value).toEqual([]); expect(variants.items.value).toEqual([]); await flushPromises()
    expect(list.items.value).toEqual([product]); expect(variants.items.value).toEqual([{ id: 'v', name: 'Grande' }])
    context.value = { ...original, canReadProduct: false }
    expect(list.items.value).toEqual([]); expect(variants.items.value).toEqual([])
    const calls = vi.mocked(purchaseOrderProductsApi.list).mock.calls.length
    await list.refresh(); await variants.refresh(); await flushPromises()
    expect(purchaseOrderProductsApi.list).toHaveBeenCalledTimes(calls)
  })
  it.each(['userId', 'tenantId', 'ready', 'canReadProduct'] as const)('hides already loaded results synchronously on %s change', async field => {
    const { list, variants, context } = setup(); await flushPromises()
    expect(list.items.value).toEqual([product]); expect(variants.items.value).toHaveLength(1)
    const original = context.value
    context.value = { ...original, [field]: typeof original[field] === 'boolean' ? false : 'other' }
    expect(list.items.value).toEqual([]); expect(variants.items.value).toEqual([])
  })
  it('aborts retired product and variant requests', async () => {
    vi.mocked(purchaseOrderProductsApi.list).mockImplementationOnce(() => new Promise(() => {}))
    vi.mocked(purchaseOrderProductsApi.variants).mockImplementationOnce(() => new Promise(() => {}))
    const { context } = setup(); await flushPromises()
    const listSignal = vi.mocked(purchaseOrderProductsApi.list).mock.calls[0]![1]!
    const variantSignal = vi.mocked(purchaseOrderProductsApi.variants).mock.calls[0]![1]!
    context.value = { ...context.value, tenantId: 'other' }; await flushPromises()
    expect(listSignal.aborted).toBe(true); expect(variantSignal.aborted).toBe(true)
  })
  it('reads variants for only the selected product, without absent-id dispatch', async () => {
    const { variants, productId } = setup(); await flushPromises()
    expect(purchaseOrderProductsApi.variants).toHaveBeenLastCalledWith('p', expect.any(AbortSignal))
    vi.mocked(purchaseOrderProductsApi.variants).mockImplementationOnce(() => new Promise(() => {}))
    productId.value = 'other'; expect(variants.items.value).toEqual([]); await flushPromises()
    expect(purchaseOrderProductsApi.variants).toHaveBeenLastCalledWith('other', expect.any(AbortSignal))
    productId.value = null; await variants.refresh(); await flushPromises()
    expect(variants.items.value).toEqual([]); expect(purchaseOrderProductsApi.variants).toHaveBeenCalledTimes(2)
  })
  it('exposes errors without retries and ends an empty page', async () => {
    vi.mocked(purchaseOrderProductsApi.list).mockResolvedValue([])
    vi.mocked(purchaseOrderProductsApi.variants).mockRejectedValue(new Error('denied'))
    const { list, variants } = setup(); await flushPromises()
    expect(list.items.value).toEqual([]); expect(list.hasNext.value).toBe(false)
    expect(variants.error.value).toBeTruthy(); expect(purchaseOrderProductsApi.variants).toHaveBeenCalledTimes(1)
  })
})
