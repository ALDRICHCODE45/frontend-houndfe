import { effectScope, nextTick, shallowRef } from 'vue'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { suppliersApi } from '../../api/suppliers.api'
import { useSupplierCommands } from '../useSupplierCommands'

vi.mock('../../api/suppliers.api', () => ({ suppliersApi: { create: vi.fn(), update: vi.fn() } }))
const input = { displayName: 'Proveedor Centro', termsText: null, status: 'ACTIVE' as const }
const supplier = { ...input, id: 'supplier-1', version: 1, createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' }
function setup() {
  const context = shallowRef<{ userId: string; tenantId: string; ready: boolean; canCreate: boolean; canUpdate: boolean }>({ userId: 'user-1', tenantId: 'branch-1', ready: true, canCreate: true, canUpdate: true })
  const scope = effectScope()
  const owner = scope.run(() => useSupplierCommands(context))!
  return { context, scope, owner }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => vi.resetAllMocks())

describe('supplier command ownership', () => {
  it('blocks dispatch without permission or while selecting tenant', async () => {
    const { owner, context, scope } = setup()
    context.value = { ...context.value, canCreate: false }
    expect(await owner.create(input)).toEqual({ status: 'blocked' })
    context.value = { ...context.value, ready: false, canCreate: true }
    expect(await owner.create(input)).toEqual({ status: 'blocked' })
    expect(suppliersApi.create).not.toHaveBeenCalled()
    scope.stop()
  })

  it('retains the immutable original attempt after uncertainty and retries only explicitly', async () => {
    const { owner, scope } = setup()
    vi.mocked(suppliersApi.create).mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(supplier)
    const mutable = { ...input }
    expect(await owner.create(mutable)).toEqual({ status: 'uncertain' })
    const [body, key] = vi.mocked(suppliersApi.create).mock.calls[0]!
    mutable.displayName = 'Changed locally'
    expect(await owner.create(mutable)).toEqual({ status: 'blocked' })
    expect(suppliersApi.create).toHaveBeenCalledTimes(1)
    expect(owner.hasUncertainResult.value).toBe(true)
    expect(await owner.retry()).toEqual({ status: 'applied', supplier })
    expect(suppliersApi.create).toHaveBeenNthCalledWith(2, body, key)
    expect(body.displayName).toBe(input.displayName)
    expect(owner.acknowledged.value).toEqual(supplier)
    scope.stop()
  })

  it('blocks simultaneous commands and discards late success after tenant switch', async () => {
    const { owner, context, scope } = setup()
    const pending = deferred<typeof supplier>()
    vi.mocked(suppliersApi.create).mockReturnValue(pending.promise)
    const first = owner.create(input)
    expect(await owner.create(input)).toEqual({ status: 'blocked' })
    context.value = { ...context.value, tenantId: 'branch-2' }
    pending.resolve(supplier)
    expect(await first).toEqual({ status: 'discarded' })
    expect(owner.acknowledged.value).toBeNull()
    expect(owner.isPending.value).toBe(false)
    scope.stop()
  })

  it('discards late success after disposal or permission revocation', async () => {
    for (const reason of ['dispose', 'permission'] as const) {
      const { owner, context, scope } = setup()
      const pending = deferred<typeof supplier>()
      vi.mocked(suppliersApi.create).mockReturnValueOnce(pending.promise)
      const request = owner.create(input)
      if (reason === 'dispose') scope.stop()
      else context.value = { ...context.value, canCreate: false }
      pending.resolve(supplier)
      expect(await request).toEqual({ status: 'discarded' })
      expect(owner.acknowledged.value).toBeNull()
      scope.stop()
    }
  })

  it('uses PATCH version and preserves the error on conflict without retrying', async () => {
    const { owner, scope } = setup()
    const error = { response: { status: 409, data: { statusCode: 409, error: 'SUPPLIER_VERSION_CONFLICT' } } }
    vi.mocked(suppliersApi.update).mockRejectedValue(error)
    expect(await owner.update(supplier.id, { expectedVersion: 1, changes: { termsText: null } })).toEqual({ status: 'rejected' })
    expect(owner.error.value).toEqual(error)
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    expect(suppliersApi.update).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('retains an in-flight server result and clears it on an authentication transition', async () => {
    const { owner, context, scope } = setup()
    vi.mocked(suppliersApi.create).mockRejectedValue({ response: { status: 409, data: { error: 'IDEMPOTENCY_KEY_IN_FLIGHT' } } })
    expect(await owner.create(input)).toEqual({ status: 'uncertain' })
    context.value = { ...context.value, ready: false }
    await nextTick()
    expect(owner.hasUncertainResult.value).toBe(false)
    expect(owner.error.value).toBeNull()
    expect(await owner.retry()).toEqual({ status: 'blocked' })
    scope.stop()
  })
})
