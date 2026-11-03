import { effectScope, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { purchaseOrdersApi } from '../../api/purchase-orders.api'
import { usePurchaseOrderCommands, type PurchaseOrderCommandContext } from '../usePurchaseOrderCommands'
import type { OrderInput, PurchaseOrder } from '../../interfaces/purchase-order.types'

vi.mock('../../api/purchase-orders.api', () => ({
  purchaseOrdersApi: { create: vi.fn(), saveDraft: vi.fn(), delete: vi.fn() },
}))
const input = (): OrderInput => ({
  supplierId: null, note: 'Pedido semanal', location: { detail: null },
  lines: [{ lineId: 'line-1', productId: null, variantId: null, orderedQuantity: '2', informedUnitCost: null }],
})
const order = { ...input(), id: 'order-1', version: 1, status: 'DRAFT' } as PurchaseOrder
function setup(overrides: Partial<PurchaseOrderCommandContext> = {}) {
  const context = shallowRef<PurchaseOrderCommandContext>({
    userId: 'user-1', tenantId: 'branch-1', ready: true, canCreate: true, canUpdate: true, canDelete: true, ...overrides,
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
})
