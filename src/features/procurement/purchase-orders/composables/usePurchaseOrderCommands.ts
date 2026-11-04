import { onScopeDispose, readonly, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { purchaseOrdersApi } from '../api/purchase-orders.api'
import type { ConfirmOrderInput, OrderInput, PurchaseOrder, SaveDraftInput } from '../interfaces/purchase-order.types'

export interface PurchaseOrderCommandContext {
  userId: string
  tenantId: string
  ready: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canConfirm: boolean
  canCancel: boolean
}
type Attempt = { key: string } & (
  | { kind: 'create'; input: OrderInput }
  | { kind: 'update'; id: string; input: SaveDraftInput }
  | { kind: 'delete'; id: string; input: { expectedVersion: number } }
  | { kind: 'confirm'; id: string; input: ConfirmOrderInput }
  | { kind: 'cancel'; id: string; input: { expectedVersion: number } }
)
type Outcome = { status: 'applied'; order: PurchaseOrder } | { status: 'deleted'; id: string } | {
  status: 'blocked' | 'discarded' | 'uncertain' | 'rejected'
}

function freezeOrder(input: OrderInput): OrderInput {
  return Object.freeze({
    supplierId: input.supplierId, note: input.note, location: Object.freeze({ detail: input.location.detail }),
    lines: Object.freeze(input.lines.map(line => Object.freeze({
      lineId: line.lineId, productId: line.productId, variantId: line.variantId, orderedQuantity: line.orderedQuantity,
      informedUnitCost: line.informedUnitCost && Object.freeze({ ...line.informedUnitCost }),
    }))) as OrderInput['lines'],
  })
}

// Same ownership rules as supplier commands: one immutable attempt per intent,
// late results fenced by context, uncertain outcomes replayed only explicitly.
export function usePurchaseOrderCommands(context: MaybeRefOrGetter<PurchaseOrderCommandContext>) {
  const isPending = shallowRef(false)
  const hasUncertainResult = shallowRef(false)
  const acknowledged = shallowRef<PurchaseOrder | null>(null)
  const error = shallowRef<unknown>(null)
  let attempt: Attempt | null = null
  let epoch = 0
  let disposed = false
  let request: symbol | null = null
  // Cancels the in-flight dispatch, including a queued credential-refresh replay.
  let controller: AbortController | null = null

  function retire() {
    epoch++
    controller?.abort()
    controller = null
    attempt = null
    request = null
    isPending.value = false
    hasUncertainResult.value = false
    acknowledged.value = null
    error.value = null
  }
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canCreate, scope.canUpdate, scope.canDelete,
      scope.canConfirm, scope.canCancel]
  }, retire, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; retire() })

  function allowed(kind: Attempt['kind']) {
    const scope = toValue(context)
    return !disposed && scope.ready && Boolean(scope.userId && scope.tenantId)
      && {
        create: scope.canCreate, update: scope.canUpdate, delete: scope.canDelete,
        confirm: scope.canConfirm, cancel: scope.canCancel,
      }[kind]
  }

  function send(current: Exclude<Attempt, { kind: 'delete' }>, signal: AbortSignal): Promise<PurchaseOrder> {
    switch (current.kind) {
      case 'create': return purchaseOrdersApi.create(current.input, current.key, signal)
      case 'update': return purchaseOrdersApi.saveDraft(current.id, current.input, current.key, signal)
      case 'confirm': return purchaseOrdersApi.confirm(current.id, current.input, current.key, signal)
      case 'cancel': return purchaseOrdersApi.cancel(current.id, current.input, current.key, signal)
    }
  }

  async function run(current: Attempt): Promise<Outcome> {
    if (!allowed(current.kind) || request !== null) return { status: 'blocked' }
    const origin = epoch
    const token = Symbol('purchase-order-command')
    const owns = () => !disposed && origin === epoch && request === token && allowed(current.kind)
    request = token
    attempt = current
    const dispatch = new AbortController()
    controller = dispatch
    isPending.value = true
    error.value = null
    acknowledged.value = null
    let outcome: Outcome = { status: 'discarded' }
    try {
      if (current.kind === 'delete') {
        await purchaseOrdersApi.delete(current.id, current.input, current.key, dispatch.signal)
        if (!owns()) return { status: 'discarded' }
        attempt = null
        hasUncertainResult.value = false
        outcome = { status: 'deleted', id: current.id }
      } else {
        const order = await send(current, dispatch.signal)
        if (!owns()) return { status: 'discarded' }
        attempt = null
        hasUncertainResult.value = false
        acknowledged.value = order
        outcome = { status: 'applied', order }
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
      if (controller === dispatch) controller = null
      if (request === token) {
        request = null
        isPending.value = false
      }
    }
    return disposed || origin !== epoch ? { status: 'discarded' } : outcome
  }

  function create(input: OrderInput): Promise<Outcome> {
    if (attempt || request || !allowed('create')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'create', key: crypto.randomUUID(), input: freezeOrder(input) })
  }
  function save(id: string, input: SaveDraftInput): Promise<Outcome> {
    if (attempt || request || !allowed('update')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'update', id, key: crypto.randomUUID(), input: Object.freeze({
      expectedVersion: input.expectedVersion, order: freezeOrder(input.order),
    }) })
  }
  function remove(id: string, input: { expectedVersion: number }): Promise<Outcome> {
    if (attempt || request || !allowed('delete')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'delete', id, key: crypto.randomUUID(), input: Object.freeze({ expectedVersion: input.expectedVersion }) })
  }
  // Transitions send back the server-issued expectations from the last read verbatim.
  function confirm(id: string, input: ConfirmOrderInput): Promise<Outcome> {
    if (attempt || request || !allowed('confirm')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'confirm', id, key: crypto.randomUUID(), input: Object.freeze({
      expectedVersion: input.expectedVersion, expectedSupplierVersion: input.expectedSupplierVersion,
      expectedReferenceToken: input.expectedReferenceToken,
    }) })
  }
  function cancel(id: string, input: { expectedVersion: number }): Promise<Outcome> {
    if (attempt || request || !allowed('cancel')) return Promise.resolve({ status: 'blocked' })
    return run({ kind: 'cancel', id, key: crypto.randomUUID(), input: Object.freeze({ expectedVersion: input.expectedVersion }) })
  }
  function retry(): Promise<Outcome> {
    return attempt && hasUncertainResult.value ? run(attempt) : Promise.resolve({ status: 'blocked' })
  }
  function clearFeedback() {
    if (!isPending.value && !hasUncertainResult.value) error.value = null
  }
  return { create, save, delete: remove, confirm, cancel, retry, clearFeedback, isPending: readonly(isPending),
    hasUncertainResult: readonly(hasUncertainResult), acknowledged: readonly(acknowledged), error: readonly(error) }
}
