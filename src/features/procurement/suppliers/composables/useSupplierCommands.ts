import { onScopeDispose, readonly, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { suppliersApi } from '../api/suppliers.api'
import type { Supplier, SupplierInput, SupplierPatch } from '../interfaces/supplier.types'

export interface SupplierCommandContext {
  userId: string
  tenantId: string
  ready: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}
type Attempt = { key: string } & (
  | { kind: 'create'; input: SupplierInput }
  | { kind: 'update'; id: string; input: SupplierPatch }
  | { kind: 'delete'; id: string; input: { expectedVersion: number } }
)
type Outcome = { status: 'applied'; supplier: Supplier } | { status: 'deleted'; id: string } | {
  status: 'blocked' | 'discarded' | 'uncertain' | 'rejected'
}

// The view supplies reactive authentication readiness and effective permissions.
// This owner fences late successes as well as errors; the HTTP interceptor only
// fences its error/retry path. No cache or toast effects run here.
export function useSupplierCommands(context: MaybeRefOrGetter<SupplierCommandContext>) {
  const isPending = shallowRef(false)
  const hasUncertainResult = shallowRef(false)
  const acknowledged = shallowRef<Supplier | null>(null)
  const error = shallowRef<unknown>(null)
  let attempt: Attempt | null = null
  let epoch = 0
  let disposed = false
  let request: symbol | null = null

  function retire() {
    epoch++
    attempt = null
    request = null
    isPending.value = false
    hasUncertainResult.value = false
    acknowledged.value = null
    error.value = null
  }
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canCreate, scope.canUpdate, scope.canDelete]
  }, retire, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; retire() })

  function allowed(kind: Attempt['kind']) {
    const scope = toValue(context)
    return !disposed && scope.ready && Boolean(scope.userId && scope.tenantId)
      && { create: scope.canCreate, update: scope.canUpdate, delete: scope.canDelete }[kind]
  }

  async function run(current: Attempt): Promise<Outcome> {
    if (!allowed(current.kind) || request !== null) return { status: 'blocked' }
    const origin = epoch
    const token = Symbol('supplier-command')
    const owns = () => !disposed && origin === epoch && request === token && allowed(current.kind)
    request = token
    attempt = current
    isPending.value = true
    error.value = null
    acknowledged.value = null
    let outcome: Outcome = { status: 'discarded' }
    try {
      if (current.kind === 'delete') {
        await suppliersApi.delete(current.id, current.input, current.key)
        if (!owns()) return { status: 'discarded' }
        attempt = null
        hasUncertainResult.value = false
        outcome = { status: 'deleted', id: current.id }
      } else {
        const supplier = current.kind === 'create'
          ? await suppliersApi.create(current.input, current.key)
          : await suppliersApi.update(current.id, current.input, current.key)
        if (!owns()) return { status: 'discarded' }
        attempt = null
        hasUncertainResult.value = false
        acknowledged.value = supplier
        outcome = { status: 'applied', supplier }
      }
    } catch (caught) {
      if (!owns()) return { status: 'discarded' }
      error.value = caught
      const response = (caught as { response?: { status?: number; data?: { error?: string } } } | null)?.response
      const status = response?.status
      const uncertain = status === undefined || status >= 500
        || response?.data?.error === 'IDEMPOTENCY_KEY_IN_FLIGHT'
      hasUncertainResult.value = uncertain
      if (!uncertain) attempt = null
      outcome = { status: uncertain ? 'uncertain' : 'rejected' }
    } finally {
      if (request === token) {
        request = null
        isPending.value = false
      }
    }
    return disposed || origin !== epoch ? { status: 'discarded' } : outcome
  }

  function create(input: SupplierInput): Promise<Outcome> {
    if (attempt || request || !allowed('create')) return Promise.resolve({ status: 'blocked' })
    const { displayName, termsText, status } = input
    return run({ kind: 'create', key: crypto.randomUUID(), input: Object.freeze({ displayName, termsText, status }) })
  }
  function update(id: string, input: SupplierPatch): Promise<Outcome> {
    if (attempt || request || !allowed('update')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'update', id, key: crypto.randomUUID(), input: Object.freeze({
      expectedVersion: input.expectedVersion, changes: Object.freeze({ ...input.changes }),
    }) })
  }
  function remove(id: string, input: { expectedVersion: number }): Promise<Outcome> {
    if (attempt || request || !allowed('delete')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'delete', id, key: crypto.randomUUID(), input: Object.freeze({ expectedVersion: input.expectedVersion }) })
  }
  function retry(): Promise<Outcome> {
    return attempt && hasUncertainResult.value ? run(attempt) : Promise.resolve({ status: 'blocked' })
  }
  function clearFeedback() {
    if (!isPending.value && !hasUncertainResult.value) error.value = null
  }
  return { create, update, delete: remove, retry, clearFeedback, isPending: readonly(isPending),
    hasUncertainResult: readonly(hasUncertainResult), acknowledged: readonly(acknowledged), error: readonly(error) }
}
