import { defineComponent, h, shallowRef } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrdersApi } from '../../api/purchase-orders.api'
import type { PurchaseOrder, PurchaseOrderSummary } from '../../interfaces/purchase-order.types'
import { usePurchaseOrder, usePurchaseOrders } from '../usePurchaseOrders'

vi.mock('../../api/purchase-orders.api', () => ({ purchaseOrdersApi: { list: vi.fn(), get: vi.fn() } }))
const row: PurchaseOrderSummary = { id: 'one', version: 1, status: 'DRAFT', supplierDisplaySnapshot: null, lineCount: 0, issueCount: 0, note: null, locationDetail: null, createdAt: '', updatedAt: '' }
const order: PurchaseOrder = { ...row, supplierId: null, location: { detail: null }, lines: [], lineDisplaySnapshots: [], lineSubtotals: [], locationSnapshot: { tenantId: 'tenant', tenantName: '', detail: null }, validation: { issues: [] }, supplierCurrentVersion: null, referenceToken: null, canConfirm: false, confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null }
const cleanups: Array<() => void> = []
function setup(patch = {}) {
  const context = shallowRef({ userId: 'user', tenantId: 'tenant', ready: true, canRead: true, ...patch })
  const id = shallowRef<string | null>('one')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  let list!: ReturnType<typeof usePurchaseOrders>
  let detail!: ReturnType<typeof usePurchaseOrder>
  const wrapper = mount(defineComponent({ setup() { list = usePurchaseOrders(context); detail = usePurchaseOrder(id, context); return () => h('div') } }), { global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } })
  cleanups.push(() => { wrapper.unmount(); client.clear() })
  return { context, id, list, detail, client }
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(purchaseOrdersApi.list).mockResolvedValue({ items: [row], nextCursor: 'two' }); vi.mocked(purchaseOrdersApi.get).mockResolvedValue(order) })
afterEach(() => cleanups.splice(0).forEach(fn => fn()))

describe('purchase order scoped reads', () => {
  it('passes exact input and signals, navigates cursor stack and resets on supplier/context changes', async () => {
    const { list, context, client } = setup()
    await flushPromises()
    expect(purchaseOrdersApi.list).toHaveBeenLastCalledWith({ supplierId: undefined, search: undefined, cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    expect(purchaseOrdersApi.get).toHaveBeenLastCalledWith('one', expect.any(AbortSignal))
    expect(list.items.value).toEqual([row])
    list.next(); await flushPromises()
    expect(purchaseOrdersApi.list).toHaveBeenLastCalledWith({ supplierId: undefined, search: undefined, cursor: 'two', limit: 25 }, expect.any(AbortSignal))
    expect(list.hasPrevious.value).toBe(true)
    list.back(); await flushPromises()
    expect(list.hasPrevious.value).toBe(false)
    list.next(); await flushPromises()
    list.supplierId.value = 'supplier'; await flushPromises()
    expect(purchaseOrdersApi.list).toHaveBeenLastCalledWith({ supplierId: 'supplier', search: undefined, cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    expect(list.hasPrevious.value).toBe(false)
    list.next(); await flushPromises()
    context.value = { ...context.value, tenantId: 'other' }; await flushPromises()
    expect(list.hasPrevious.value).toBe(false)
    expect(vi.mocked(purchaseOrdersApi.list).mock.lastCall?.[0].cursor).toBeUndefined()
    expect(client.getQueryCache().getAll().every(q => q.queryKey[0] === 'procurement-purchase-orders' || q.queryKey[0] === 'procurement-purchase-order')).toBe(true)
  })
  it('searches on the server, ANDs supplier filtering, resets cursor/back stack and fences the previous search page', async () => {
    const { list } = setup(); await flushPromises()
    list.next(); await flushPromises()
    expect(list.hasPrevious.value).toBe(true)
    list.search.value = 'Proveedor'
    expect(list.items.value).toEqual([])
    await flushPromises()
    expect(list.hasPrevious.value).toBe(false)
    expect(purchaseOrdersApi.list).toHaveBeenLastCalledWith({ supplierId: undefined, search: 'Proveedor', cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    list.next(); await flushPromises()
    list.supplierId.value = 'supplier'; await flushPromises()
    expect(purchaseOrdersApi.list).toHaveBeenLastCalledWith({ supplierId: 'supplier', search: 'Proveedor', cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    list.search.value = '   '; await flushPromises()
    expect(vi.mocked(purchaseOrdersApi.list).mock.lastCall?.[0]).toMatchObject({ search: undefined, cursor: undefined })
  })
  it('sends the single status filter, defaults to every order and resets the cursor when it changes', async () => {
    const { list } = setup(); await flushPromises()
    expect(list.status.value).toBeUndefined()
    expect(vi.mocked(purchaseOrdersApi.list).mock.lastCall?.[0]).not.toHaveProperty('status', 'DRAFT')
    list.next(); await flushPromises()
    expect(list.hasPrevious.value).toBe(true)
    list.status.value = 'CONFIRMED'
    expect(list.items.value).toEqual([])
    await flushPromises()
    expect(list.hasPrevious.value).toBe(false)
    expect(purchaseOrdersApi.list).toHaveBeenLastCalledWith({ supplierId: undefined, search: undefined, status: 'CONFIRMED', cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    list.status.value = undefined; await flushPromises()
    expect(vi.mocked(purchaseOrdersApi.list).mock.lastCall?.[0].status).toBeUndefined()
  })
  it.each([{ ready: false }, { canRead: false }, { userId: '' }, { tenantId: '' }])('does not dispatch without complete access: %j', async patch => {
    const { list, detail } = setup(patch)
    await list.refresh(); await detail.refresh(); await flushPromises()
    expect(purchaseOrdersApi.list).not.toHaveBeenCalled()
    expect(purchaseOrdersApi.get).not.toHaveBeenCalled()
    expect(list.items.value).toEqual([])
    expect(detail.order.value).toBeNull()
  })
  it.each(['userId', 'tenantId', 'ready', 'canRead'] as const)('fences old results across %s changes and restoration', async field => {
    let resolveList!: (v: { items: PurchaseOrderSummary[]; nextCursor: null }) => void
    let resolveDetail!: (v: PurchaseOrder) => void
    vi.mocked(purchaseOrdersApi.list).mockImplementationOnce(() => new Promise(resolve => { resolveList = resolve }))
    vi.mocked(purchaseOrdersApi.get).mockImplementationOnce(() => new Promise(resolve => { resolveDetail = resolve }))
    const { list, detail, context } = setup()
    await flushPromises()
    const original = context.value
    context.value = { ...original, [field]: typeof original[field] === 'boolean' ? false : 'other' }
    expect(list.items.value).toEqual([])
    expect(detail.order.value).toBeNull()
    await flushPromises()
    resolveList({ items: [{ ...row, id: 'stale' }], nextCursor: null }); resolveDetail({ ...order, id: 'stale' })
    await flushPromises()
    context.value = original
    expect(list.items.value).toEqual([])
    expect(detail.order.value).toBeNull()
    await flushPromises()
    expect(list.items.value).toEqual([row])
    expect(detail.order.value).toEqual(order)
  })
  it.each(['userId', 'tenantId', 'ready', 'canRead'] as const)('hides already loaded results synchronously on %s change', async field => {
    const { list, detail, context } = setup(); await flushPromises()
    expect(list.items.value).toEqual([row]); expect(detail.order.value).toEqual(order)
    const original = context.value
    context.value = { ...original, [field]: typeof original[field] === 'boolean' ? false : 'other' }
    expect(list.items.value).toEqual([]); expect(detail.order.value).toBeNull()
  })
  it('aborts retired requests and blocks pagination while a page is pending', async () => {
    vi.mocked(purchaseOrdersApi.list).mockImplementationOnce(() => new Promise(() => {}))
    vi.mocked(purchaseOrdersApi.get).mockImplementationOnce(() => new Promise(() => {}))
    const { list, context } = setup(); await flushPromises()
    const listSignal = vi.mocked(purchaseOrdersApi.list).mock.calls[0]![1]!
    const detailSignal = vi.mocked(purchaseOrdersApi.get).mock.calls[0]![1]!
    list.next(); list.back(); await flushPromises()
    expect(purchaseOrdersApi.list).toHaveBeenCalledTimes(1)
    context.value = { ...context.value, tenantId: 'other' }; await flushPromises()
    expect(listSignal.aborted).toBe(true); expect(detailSignal.aborted).toBe(true)
  })
  it('hides loaded data immediately on revocation and blocks refresh', async () => {
    const { list, detail, context } = setup(); await flushPromises()
    expect(detail.order.value).toEqual(order)
    context.value = { ...context.value, canRead: false }
    expect(list.items.value).toEqual([]); expect(detail.order.value).toBeNull()
    await list.refresh(); await detail.refresh(); await flushPromises()
    expect(purchaseOrdersApi.list).toHaveBeenCalledTimes(1); expect(purchaseOrdersApi.get).toHaveBeenCalledTimes(1)
  })
  it('hides previous detail on id change, and does not read an absent id', async () => {
    const { detail, id } = setup(); await flushPromises()
    vi.mocked(purchaseOrdersApi.get).mockImplementationOnce(() => new Promise(() => {}))
    id.value = 'two'; expect(detail.order.value).toBeNull(); await flushPromises()
    expect(purchaseOrdersApi.get).toHaveBeenLastCalledWith('two', expect.any(AbortSignal))
    id.value = null; await detail.refresh(); await flushPromises()
    expect(detail.order.value).toBeNull(); expect(purchaseOrdersApi.get).toHaveBeenCalledTimes(2)
  })
  it('does not retry failed reads', async () => {
    vi.mocked(purchaseOrdersApi.list).mockRejectedValue(new Error('list'))
    vi.mocked(purchaseOrdersApi.get).mockRejectedValue(new Error('detail'))
    const { list, detail } = setup(); await flushPromises()
    expect(list.error.value).toBeTruthy(); expect(detail.error.value).toBeTruthy()
    expect(purchaseOrdersApi.list).toHaveBeenCalledTimes(1); expect(purchaseOrdersApi.get).toHaveBeenCalledTimes(1)
  })
})
