import { effectScope, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrdersApi } from '../../api/purchase-orders.api'
import { usePurchaseOrderCommands, type PurchaseOrderCommandContext } from '../usePurchaseOrderCommands'
import type { OrderInput, PurchaseOrder } from '../../interfaces/purchase-order.types'

vi.mock('../../api/purchase-orders.api', () => ({
  purchaseOrdersApi: { create: vi.fn(), saveDraft: vi.fn(), delete: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
}))
const input = (): OrderInput => ({
  supplierId: null, note: 'Pedido semanal', location: { detail: null },
  lines: [{ lineId: 'line-1', productId: null, variantId: null, orderedQuantity: '2', informedUnitCost: null }],
})
const order = { ...input(), id: 'order-1', version: 1, status: 'DRAFT' } as PurchaseOrder
function setup(overrides: Partial<PurchaseOrderCommandContext> = {}) {
  const context = shallowRef<PurchaseOrderCommandContext>({
    userId: 'user-1', tenantId: 'branch-1', ready: true, canCreate: true, canUpdate: true, canDelete: true,
    canConfirm: true, canCancel: true, ...overrides,
  })
  const scope = effectScope()
  const owner = scope.run(() => usePurchaseOrderCommands(context))!
  return { context, scope, owner }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const expectations = { expectedVersion: 1, expectedSupplierVersion: 4, expectedReferenceToken: 'opaque' }
const httpError = (status: number, error: string) => Object.assign(new Error(error), { response: { status, data: { statusCode: status, error } } })
beforeEach(() => vi.resetAllMocks())

describe('purchase order command ownership', () => {
  it('creates once with an immutable snapshot and a fresh key per intent', async () => {
    const { owner, scope } = setup()
    vi.mocked(purchaseOrdersApi.create).mockResolvedValue(order)
    const draft = input()
    expect(await owner.create(draft)).toEqual({ status: 'applied', order })
    const [body, key, signal] = vi.mocked(purchaseOrdersApi.create).mock.calls[0]!
    expect(body).toEqual(input())
    expect(Object.isFrozen(body) && Object.isFrozen(body.lines) && Object.isFrozen(body.lines[0])).toBe(true)
    expect(key).toEqual(expect.any(String))
    expect(signal).toEqual(expect.any(AbortSignal))
    await owner.create(draft)
    expect(vi.mocked(purchaseOrdersApi.create).mock.calls[1]![1]).not.toBe(key)
    scope.stop()
  })

  it('retains the uncertain save and replays it only explicitly with the same CAS, body and key', async () => {
    const { owner, scope } = setup()
    vi.mocked(purchaseOrdersApi.saveDraft).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ ...order, version: 2 })
    const draft = input()
    expect(await owner.save('order-1', { expectedVersion: 1, order: draft })).toEqual({ status: 'uncertain' })
    const [id, body, key] = vi.mocked(purchaseOrdersApi.saveDraft).mock.calls[0]!
    draft.lines[0]!.orderedQuantity = '99'
    expect(await owner.save('order-1', { expectedVersion: 1, order: draft })).toEqual({ status: 'blocked' })
    expect(await owner.delete('order-1', { expectedVersion: 1 })).toEqual({ status: 'blocked' })
    expect(owner.hasUncertainResult.value).toBe(true)
    expect(await owner.retry()).toEqual({ status: 'applied', order: { ...order, version: 2 } })
    expect(vi.mocked(purchaseOrdersApi.saveDraft).mock.calls[1]!.slice(0, 3)).toEqual([id, body, key])
    expect(body.order.lines[0]!.orderedQuantity).toBe('2')
    scope.stop()
  })

  it.each([
    [409, 'ORDER_VERSION_CONFLICT', 'rejected'],
    [409, 'SUPPLIER_ARCHIVED', 'rejected'],
    [404, 'NOT_FOUND', 'rejected'],
    [400, 'MALFORMED', 'rejected'],
    [409, 'IDEMPOTENCY_KEY_IN_FLIGHT', 'uncertain'],
    [500, 'INTERNAL_ERROR', 'uncertain'],
  ] as const)('classifies %s %s as %s', async (status, code, expected) => {
    const { owner, scope } = setup()
    vi.mocked(purchaseOrdersApi.saveDraft).mockRejectedValueOnce(httpError(status, code))
    expect(await owner.save('order-1', { expectedVersion: 1, order: input() })).toEqual({ status: expected })
    expect(owner.hasUncertainResult.value).toBe(expected === 'uncertain')
    expect(await owner.retry()).toEqual(expected === 'uncertain' ? expect.anything() : { status: 'blocked' })
    scope.stop()
  })

  it('discards with delete permission independently of update and reports the removed id', async () => {
    const { owner, context, scope } = setup({ canDelete: false })
    expect(await owner.delete('order-1', { expectedVersion: 3 })).toEqual({ status: 'blocked' })
    context.value = { ...context.value, canDelete: true, canUpdate: false, canCreate: false }
    vi.mocked(purchaseOrdersApi.delete).mockResolvedValueOnce(undefined)
    expect(await owner.delete('order-1', { expectedVersion: 3 })).toEqual({ status: 'deleted', id: 'order-1' })
    expect(vi.mocked(purchaseOrdersApi.delete).mock.calls[0]!.slice(0, 2)).toEqual(['order-1', { expectedVersion: 3 }])
    scope.stop()
  })

  it.each(['tenant', 'user', 'ready', 'permission'] as const)('retires a late result and aborts the dispatch on %s change', async change => {
    const { owner, context, scope } = setup()
    const pending = deferred<PurchaseOrder>()
    vi.mocked(purchaseOrdersApi.create).mockReturnValueOnce(pending.promise)
    const result = owner.create(input())
    const signal = vi.mocked(purchaseOrdersApi.create).mock.calls[0]![2]!
    context.value = { ...context.value, ...{
      tenant: { tenantId: 'other' }, user: { userId: 'other' }, ready: { ready: false }, permission: { canCreate: false },
    }[change] }
    expect(signal.aborted).toBe(true)
    pending.resolve(order)
    expect(await result).toEqual({ status: 'discarded' })
    expect(owner.acknowledged.value).toBeNull()
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    scope.stop()
  })

  it('blocks every command while tenant selection is not ready, without dispatching', async () => {
    const { owner, scope } = setup({ ready: false })
    expect(await owner.create(input())).toEqual({ status: 'blocked' })
    expect(await owner.save('order-1', { expectedVersion: 1, order: input() })).toEqual({ status: 'blocked' })
    expect(await owner.delete('order-1', { expectedVersion: 1 })).toEqual({ status: 'blocked' })
    expect(purchaseOrdersApi.create).not.toHaveBeenCalled()
    expect(purchaseOrdersApi.saveDraft).not.toHaveBeenCalled()
    expect(purchaseOrdersApi.delete).not.toHaveBeenCalled()
    scope.stop()
  })

  it('confirms with its own permission, the server expectations and a fresh key per deliberate attempt', async () => {
    const { owner, context, scope } = setup({ canConfirm: false })
    expect(await owner.confirm('order-1', expectations)).toEqual({ status: 'blocked' })
    context.value = { ...context.value, canConfirm: true, canUpdate: false, canCreate: false, canDelete: false }
    const confirmed = { ...order, version: 2, status: 'CONFIRMED' } as PurchaseOrder
    vi.mocked(purchaseOrdersApi.confirm).mockResolvedValue(confirmed)
    expect(await owner.confirm('order-1', { ...expectations, canConfirm: true } as never)).toEqual({ status: 'applied', order: confirmed })
    const [id, body, key, signal] = vi.mocked(purchaseOrdersApi.confirm).mock.calls[0]!
    expect([id, body]).toEqual(['order-1', expectations])
    expect(Object.isFrozen(body)).toBe(true)
    expect(signal).toEqual(expect.any(AbortSignal))
    await owner.confirm('order-1', expectations)
    expect(vi.mocked(purchaseOrdersApi.confirm).mock.calls[1]![2]).not.toBe(key)
    scope.stop()
  })

  it('cancels with its own permission and only the expected version', async () => {
    const { owner, context, scope } = setup({ canCancel: false })
    expect(await owner.cancel('order-1', { expectedVersion: 2 })).toEqual({ status: 'blocked' })
    context.value = { ...context.value, canCancel: true, canConfirm: false, canUpdate: false, canDelete: false }
    const cancelled = { ...order, version: 3, status: 'CANCELLED' } as PurchaseOrder
    vi.mocked(purchaseOrdersApi.cancel).mockResolvedValueOnce(cancelled)
    expect(await owner.cancel('order-1', { expectedVersion: 2, reason: 'x' } as never)).toEqual({ status: 'applied', order: cancelled })
    expect(vi.mocked(purchaseOrdersApi.cancel).mock.calls[0]!.slice(0, 2)).toEqual(['order-1', { expectedVersion: 2 }])
    scope.stop()
  })

  it.each(['ORDER_NOT_READY', 'ELIGIBILITY_CHANGED', 'SUPPLIER_VERSION_CONFLICT', 'ORDER_STATE_CONFLICT', 'SUPPLIER_ARCHIVED', 'ORDER_VERSION_CONFLICT'])(
    'rejects a confirmation answered with 409 %s without keeping it for replay', async code => {
      const { owner, scope } = setup()
      vi.mocked(purchaseOrdersApi.confirm).mockRejectedValueOnce(httpError(409, code))
      expect(await owner.confirm('order-1', expectations)).toEqual({ status: 'rejected' })
      expect(owner.hasUncertainResult.value).toBe(false)
      expect(await owner.retry()).toEqual({ status: 'blocked' })
      scope.stop()
    })

  it.each(['canConfirm', 'canCancel'] as const)('retires a late transition when %s is revoked', async flag => {
    const { owner, context, scope } = setup()
    const pending = deferred<PurchaseOrder>()
    const api = flag === 'canConfirm' ? purchaseOrdersApi.confirm : purchaseOrdersApi.cancel
    vi.mocked(api).mockReturnValueOnce(pending.promise)
    const result = flag === 'canConfirm' ? owner.confirm('order-1', expectations) : owner.cancel('order-1', { expectedVersion: 1 })
    const signal = vi.mocked(api).mock.calls[0]![3]!
    context.value = { ...context.value, [flag]: false }
    expect(signal.aborted).toBe(true)
    pending.resolve(order)
    expect(await result).toEqual({ status: 'discarded' })
    scope.stop()
  })
})
