import { effectScope, nextTick, reactive, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePurchaseOrderWorkspace } from '../usePurchaseOrderWorkspace'
import type { PurchaseOrder } from '../../interfaces/purchase-order.types'
const mocks = vi.hoisted(() => ({ create: vi.fn(), saveDraft: vi.fn(), delete: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), refresh: vi.fn(), detailRefresh: vi.fn() }))
vi.mock('../../api/purchase-orders.api', () => ({ purchaseOrdersApi: mocks }))
const current = shallowRef<PurchaseOrder | null>(null)
vi.mock('../usePurchaseOrders', () => ({
  usePurchaseOrder: () => ({ order: current, refresh: mocks.detailRefresh }),
}))
const order: PurchaseOrder = { id: 'o', version: 3, status: 'DRAFT', supplierId: null, note: null, location: { detail: null }, lines: [], createdAt: '', updatedAt: '', supplierDisplaySnapshot: null, lineDisplaySnapshots: [], lineSubtotals: [], locationSnapshot: { tenantId: 't', tenantName: 'Centro', detail: null }, validation: { issues: [] }, supplierCurrentVersion: null, referenceToken: null, canConfirm: false, confirmedAt: null, confirmedBy: null, cancelledAt: null, cancelledBy: null }
const ready: PurchaseOrder = { ...order, supplierId: 's', supplierDisplaySnapshot: { id: 's', displayName: 'Distribuidora del Norte', status: 'ACTIVE' }, supplierCurrentVersion: 7, referenceToken: 'opaque-token', canConfirm: true }
const input = { supplierId: null, note: 'local', location: { detail: null }, lines: [] }
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.forEach(scope => scope.stop()); scopes.length = 0; vi.resetAllMocks(); current.value = null })
function setup(draft: PurchaseOrder = order) {
  const context = reactive({ userId: 'u', tenantId: 't', ready: true, canRead: true, canCreate: true, canUpdate: true, canDelete: true, canConfirm: true, canCancel: true, canReadProduct: true, canReadSupplier: true })
  const scope = effectScope(); scopes.push(scope)
  mocks.detailRefresh.mockImplementation(async () => { current.value = draft; return { isError: false } })
  const workspace = scope.run(() => usePurchaseOrderWorkspace(() => context, mocks.refresh))!
  return { workspace, context }
}
describe('draft workspace command integration', () => {
  it('exposes whether the open editor can save, so create-only users do not get an unsaveable form', async () => {
    const { workspace: w, context } = setup()
    context.canUpdate = false
    mocks.create.mockResolvedValue(order)
    w.create()
    expect(w.canSave.value).toBe(true)
    await w.save(input)
    expect(w.selected.value?.id).toBe('o')
    expect(w.canSave.value).toBe(false)
    await w.save(input)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
    context.canUpdate = true
    await w.show(order)
    expect(w.canSave.value).toBe(true)
    context.canReadProduct = false
    expect(w.canSave.value).toBe(false)
  })
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

describe('order confirmation and cancellation workspace', () => {
  it('opens closed orders read-only with read permission alone and never saves them', async () => {
    const { workspace: w, context } = setup({ ...ready, status: 'CONFIRMED', canConfirm: false })
    context.canUpdate = false; context.canCreate = false
    await w.show({ id: 'o' })
    expect(w.open.value).toBe(true)
    expect(w.canSave.value).toBe(false)
    context.canUpdate = true
    expect(w.canSave.value).toBe(false)
    await w.save(input)
    expect(mocks.saveDraft).not.toHaveBeenCalled()
  })
  it('confirms with the server expectations verbatim, replaces the order and refreshes the list', async () => {
    const { workspace: w } = setup(ready)
    await w.show({ id: 'o' })
    expect(w.canConfirm.value).toBe(true)
    w.requestTransition('confirm')
    expect(w.transitionOpen.value).toBe(true)
    mocks.confirm.mockResolvedValue({ ...ready, status: 'CONFIRMED', version: 4, canConfirm: false, confirmedAt: '2026-11-03T10:00:00Z', confirmedBy: { displayName: 'Ana Pérez' } })
    await w.confirmTransition()
    expect(mocks.confirm).toHaveBeenCalledWith('o', { expectedVersion: 3, expectedSupplierVersion: 7, expectedReferenceToken: 'opaque-token' }, expect.any(String), expect.any(AbortSignal))
    expect(w.selected.value?.status).toBe('CONFIRMED')
    expect(w.transitionOpen.value).toBe(false)
    expect(w.notice.value).toBe('Orden confirmada correctamente.')
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(w.canConfirm.value).toBe(false)
    expect(w.canSave.value).toBe(false)
  })
  it('gates confirm on permission, draft status, server canConfirm, unsaved changes and lock', async () => {
    const { workspace: w, context } = setup(ready)
    await w.show({ id: 'o' })
    w.dirty.value = true
    expect(w.canConfirm.value).toBe(false); expect(w.canCancel.value).toBe(false); expect(w.needsSave.value).toBe(true)
    w.requestTransition('confirm')
    expect(w.transitionOpen.value).toBe(false)
    w.dirty.value = false
    expect(w.needsSave.value).toBe(false)
    context.canConfirm = false; await w.show({ id: 'o' })
    expect(w.canConfirm.value).toBe(false); expect(w.canCancel.value).toBe(true)
    context.canConfirm = true; context.canCancel = false; await w.show({ id: 'o' })
    expect(w.canConfirm.value).toBe(true); expect(w.canCancel.value).toBe(false)
    mocks.detailRefresh.mockImplementation(async () => { current.value = { ...ready, canConfirm: false }; return { isError: false } }); await w.show({ id: 'o' })
    expect(w.canConfirm.value).toBe(false)
    await w.confirmTransition()
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it('cancels drafts and confirmed orders without a reason, but not cancelled ones', async () => {
    const { workspace: w } = setup({ ...ready, status: 'CONFIRMED', canConfirm: false })
    await w.show({ id: 'o' })
    expect(w.canConfirm.value).toBe(false)
    expect(w.canCancel.value).toBe(true)
    w.requestTransition('cancel')
    mocks.cancel.mockResolvedValue({ ...ready, status: 'CANCELLED', version: 5, cancelledBy: { displayName: 'Ana Pérez' }, cancelledAt: '2026-11-03T11:00:00Z' })
    await w.confirmTransition()
    expect(mocks.cancel).toHaveBeenCalledWith('o', { expectedVersion: 3 }, expect.any(String), expect.any(AbortSignal))
    expect(w.selected.value?.status).toBe('CANCELLED')
    expect(w.notice.value).toBe('Orden cancelada correctamente.')
    expect(w.canCancel.value).toBe(false)
    w.requestTransition('cancel')
    expect(w.transitionOpen.value).toBe(false)
  })
  it.each(['ORDER_NOT_READY', 'ELIGIBILITY_CHANGED', 'SUPPLIER_VERSION_CONFLICT', 'ORDER_VERSION_CONFLICT', 'ORDER_STATE_CONFLICT', 'SUPPLIER_ARCHIVED'])('closes the dialog, re-reads the order and keeps the %s message visible', async code => {
    const { workspace: w } = setup(ready)
    await w.show({ id: 'o' })
    w.requestTransition('confirm')
    mocks.confirm.mockRejectedValue({ response: { status: 409, data: { statusCode: 409, error: code } } })
    mocks.detailRefresh.mockClear()
    current.value = { ...ready, version: 4, canConfirm: false }
    mocks.detailRefresh.mockImplementation(async () => ({ isError: false }))
    await w.confirmTransition()
    expect(w.transitionOpen.value).toBe(false)
    expect(mocks.detailRefresh).toHaveBeenCalledTimes(1)
    expect(w.selected.value?.version).toBe(4)
    expect(w.message.value).not.toBe('')
    expect(w.conflict.value).toBe(false)
    if (code === 'SUPPLIER_ARCHIVED') expect(w.message.value).toContain('Elige un proveedor activo y guarda el borrador antes de confirmar')
  })
  it('keeps the dialog open on other rejections and locks on uncertain results until an explicit retry', async () => {
    const { workspace: w } = setup(ready)
    await w.show({ id: 'o' })
    w.requestTransition('confirm')
    mocks.confirm.mockRejectedValueOnce({ response: { status: 403, data: { error: 'FORBIDDEN' } } })
    await w.confirmTransition()
    expect(w.transitionOpen.value).toBe(true)
    expect(w.transitionRejected.value).toBe(true)
    expect(mocks.detailRefresh).toHaveBeenCalledTimes(1)
    w.transitionOpen.value = false
    w.requestTransition('cancel')
    mocks.cancel.mockRejectedValueOnce(new Error('network'))
    await w.confirmTransition()
    expect(w.locked.value).toBe(true)
    expect(w.message.value).toContain('El resultado no está confirmado')
    expect(w.transitionOpen.value).toBe(true)
    mocks.cancel.mockResolvedValue({ ...ready, status: 'CANCELLED', version: 4 })
    await w.retry()
    expect(mocks.cancel.mock.calls[0]?.[2]).toBe(mocks.cancel.mock.calls[1]?.[2])
    expect(w.selected.value?.status).toBe('CANCELLED')
    expect(w.notice.value).toBe('Orden cancelada correctamente.')
    expect(w.transitionOpen.value).toBe(false)
    expect(w.locked.value).toBe(false)
  })
  it('never enables confirm for an order replayed without O3c fields', async () => {
    const legacy: Partial<PurchaseOrder> = { ...ready }
    delete legacy.canConfirm; delete legacy.referenceToken; delete legacy.supplierCurrentVersion
    const { workspace: w } = setup(legacy as PurchaseOrder)
    await w.show({ id: 'o' })
    expect(w.canConfirm.value).toBe(false)
    w.requestTransition('confirm')
    expect(w.transitionOpen.value).toBe(false)
  })
})
