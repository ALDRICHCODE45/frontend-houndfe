import { effectScope, nextTick, shallowRef } from 'vue'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { suppliersApi } from '../../api/suppliers.api'
import { useSupplierCommands } from '../useSupplierCommands'

vi.mock('../../api/suppliers.api', () => ({ suppliersApi: { create: vi.fn(), update: vi.fn(), delete: vi.fn() } }))
const input = { displayName: 'Proveedor Centro', termsText: null, status: 'ACTIVE' as const }
const supplier = { ...input, id: 'supplier-1', version: 1, createdAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' }
function setup() {
  const context = shallowRef<{ userId: string; tenantId: string; ready: boolean; canCreate: boolean; canUpdate: boolean; canDelete: boolean }>({ userId: 'user-1', tenantId: 'branch-1', ready: true, canCreate: true, canUpdate: true, canDelete: true })
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
  it('locks uncertain deletion and explicitly replays the same immutable CAS and key', async () => {
    const { owner, scope } = setup()
    vi.mocked(suppliersApi.delete).mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce(undefined)
    const input = { expectedVersion: 2 }
    expect(await owner.delete(supplier.id, input)).toEqual({ status: 'uncertain' })
    const [id, body, key] = vi.mocked(suppliersApi.delete).mock.calls[0]!
    input.expectedVersion = 99
    expect(await owner.update(supplier.id, { expectedVersion: 2, changes: { termsText: null } })).toEqual({ status: 'blocked' })
    expect(suppliersApi.delete).toHaveBeenCalledTimes(1)
    expect(await owner.retry()).toEqual({ status: 'deleted', id: supplier.id })
    expect(vi.mocked(suppliersApi.delete).mock.calls[1]!.slice(0, 3)).toEqual([id, body, key])
    expect(body).toEqual({ expectedVersion: 2 })
    expect(Object.isFrozen(body)).toBe(true)
    scope.stop()
  })
  it('requires delete independently and retires late deletion on context or permission change', async () => {
    for (const change of ['tenant', 'permission', 'ready'] as const) {
      const { owner, context, scope } = setup()
      context.value = { ...context.value, canDelete: false }
      expect(await owner.delete(supplier.id, { expectedVersion: 1 })).toEqual({ status: 'blocked' })
      context.value = { ...context.value, canDelete: true, canUpdate: false }
      const pending = deferred<void>()
      vi.mocked(suppliersApi.delete).mockReturnValueOnce(pending.promise)
      const result = owner.delete(supplier.id, { expectedVersion: 1 })
      context.value = { ...context.value, ...(change === 'tenant' ? { tenantId: 'other' } : change === 'ready' ? { ready: false } : { canDelete: false }) }
      pending.resolve()
      expect(await result).toEqual({ status: 'discarded' })
      expect(await owner.retry()).toEqual({ status: 'blocked' })
      scope.stop()
    }
  })
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
    expect(vi.mocked(suppliersApi.create).mock.calls[1]!.slice(0, 2)).toEqual([body, key])
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

describe('supplier command dispatch cancellation', () => {
  it.each(['create', 'update', 'delete'] as const)('aborts the in-flight %s signal when readiness or permission retires the context', async (kind) => {
    for (const change of ['ready', 'permission'] as const) {
      vi.resetAllMocks()
      const { owner, context, scope } = setup()
      let fail!: (reason: unknown) => void
      const pending = { promise: new Promise<never>((_, reject) => { fail = reject }) }
      const method = kind === 'create' ? suppliersApi.create : kind === 'update' ? suppliersApi.update : suppliersApi.delete
      vi.mocked(method).mockReturnValueOnce(pending.promise as never)
      const result = kind === 'create' ? owner.create(input)
        : kind === 'update' ? owner.update(supplier.id, { expectedVersion: 1, changes: { termsText: null } })
          : owner.delete(supplier.id, { expectedVersion: 1 })
      const call = vi.mocked(method).mock.calls[0] as unknown[]
      const signal = call[call.length - 1] as AbortSignal
      expect(signal).toBeInstanceOf(AbortSignal)
      expect(signal.aborted).toBe(false)
      const permission = kind === 'create' ? 'canCreate' : kind === 'update' ? 'canUpdate' : 'canDelete'
      context.value = { ...context.value, ...(change === 'ready' ? { ready: false } : { [permission]: false }) }
      expect(signal.aborted).toBe(true)
      fail(new Error('aborted'))
      expect(await result).toEqual({ status: 'discarded' })
      scope.stop()
    }
  })
})
