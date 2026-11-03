import { effectScope, nextTick, reactive, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePurchaseOrderWorkspace } from '../usePurchaseOrderWorkspace'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
const mocks = vi.hoisted(() => ({ create: vi.fn(), saveDraft: vi.fn(), delete: vi.fn(), refresh: vi.fn(), detailRefresh: vi.fn() }))
vi.mock('../../api/purchase-orders.api', () => ({ purchaseOrdersApi: mocks }))
const current = shallowRef<PurchaseOrder | null>(null)
vi.mock('../usePurchaseOrders', () => ({
  usePurchaseOrder: () => ({ order: current, refresh: mocks.detailRefresh }),
}))
const order: PurchaseOrder = { id: 'o', version: 3, status: 'DRAFT', supplierId: null, note: null, location: { detail: null }, lines: [], createdAt: '', updatedAt: '', supplierDisplaySnapshot: null, lineDisplaySnapshots: [], lineSubtotals: [], locationSnapshot: { tenantId: 't', tenantName: 'Centro', detail: null }, validation: { issues: [] } }
const input = { supplierId: null, note: 'local', location: { detail: null }, lines: [] }
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.forEach(scope => scope.stop()); scopes.length = 0; vi.resetAllMocks(); current.value = null })
function setup() {
  const context = reactive({ userId: 'u', tenantId: 't', ready: true, canRead: true, canCreate: true, canUpdate: true, canDelete: true, canReadProduct: true, canReadSupplier: true })
  const scope = effectScope(); scopes.push(scope)
  mocks.detailRefresh.mockImplementation(async () => { current.value = order; return { isError: false } })
  const workspace = scope.run(() => usePurchaseOrderWorkspace(() => context, mocks.refresh))!
  return { workspace, context }
}
describe('draft workspace command integration', () => {
  it('creates then saves with expectedVersion; keeps the editor open for diagnostics', async () => {
    const { workspace: w } = setup()
    mocks.create.mockResolvedValue(order)
    w.create(); await w.save(input)
    expect(mocks.create).toHaveBeenCalledWith(input, expect.any(String), expect.any(AbortSignal))
    expect(w.selected.value?.version).toBe(3)
    expect(w.open.value).toBe(true)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    mocks.saveDraft.mockResolvedValue({ ...order, version: 4 })
    await w.save(input)
    expect(mocks.saveDraft).toHaveBeenCalledWith('o', { expectedVersion: 3, order: input }, expect.any(String), expect.any(AbortSignal))
  })
  it('preserves the buffer on conflict and locks uncertain attempts until explicit retry', async () => {
    const { workspace: w } = setup()
    await w.show({ id: order.id })
    mocks.saveDraft.mockRejectedValueOnce({ response: { status: 409, data: { error: 'ORDER_VERSION_CONFLICT' } } })
    w.dirty.value = true
    const key = w.formKey.value
    await w.save(input)
    expect(w.conflict.value).toBe(true)
    expect(w.formKey.value).toBe(key)
    expect(w.dirty.value).toBe(true)
    mocks.saveDraft.mockRejectedValueOnce(new Error('network'))
    await w.save(input)
    expect(w.locked.value).toBe(true)
    expect(w.close()).toBe(false)
    mocks.saveDraft.mockResolvedValue(order)
    await w.retry()
    expect(w.locked.value).toBe(false)
    expect(mocks.saveDraft.mock.calls[1]?.[2]).toBe(mocks.saveDraft.mock.calls[2]?.[2])
  })
  it('deletes with read+delete independently of update; context changes fence local state', async () => {
    const { workspace: w, context } = setup()
    context.canUpdate = false
    mocks.delete.mockResolvedValue(undefined)
    const row = { ...order, lineCount: 0, issueCount: 0, locationDetail: null }
    w.requestDelete(row); await w.confirmDelete()
    expect(mocks.delete).toHaveBeenCalledWith('o', { expectedVersion: 3 }, expect.any(String), expect.any(AbortSignal))
    context.canUpdate = true
    w.create(); w.dirty.value = true
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(w.close()).toBe(false)
    expect(w.open.value).toBe(true)
    context.tenantId = 'other'; await nextTick()
    expect(w.open.value).toBe(false)
    confirm.mockRestore()
  })
})
