import { computed, onScopeDispose, readonly, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { inventoryApi } from '../api/inventory.api'
import type { AdjustmentInput, AdjustmentResult } from '../interfaces/inventory.types'
import { adjustmentErrorCopy, normalizeNote, validateAdjustment, type AdjustmentIssue } from '../utils/adjustment'
import type { InventoryContext } from './useInventoryAccess'

type Outcome =
  | { status: 'applied'; result: AdjustmentResult }
  | { status: 'invalid'; issue: AdjustmentIssue }
  | { status: 'rejected'; code: string | null }
  | { status: 'blocked' | 'discarded' | 'uncertain' }
interface Attempt {
  key: string
  input: AdjustmentInput
}

// The closed body, frozen: later edits to the draft never reach a replay.
function freezeAdjustment(input: AdjustmentInput): AdjustmentInput {
  const note = normalizeNote(input.note)
  return Object.freeze({
    target: Object.freeze({
      productId: input.target.productId,
      ...(input.target.lotId !== undefined && { lotId: input.target.lotId }),
      ...(input.target.variantId !== undefined && { variantId: input.target.variantId }),
    }),
    expectedVersion: input.expectedVersion, delta: input.delta, reason: input.reason,
    ...(note !== undefined && { note }),
  })
}

// One immutable attempt per user submission. Its Idempotency-Key is reused only
// to replay the same body after an uncertain result (network, 5xx, key in flight),
// and only when asked; a definitive answer closes the attempt, so the next
// submission (for example after a version conflict) gets a new key.
export function useStockAdjustment(context: MaybeRefOrGetter<InventoryContext>) {
  const isPending = shallowRef(false)
  const hasUncertainResult = shallowRef(false)
  const acknowledged = shallowRef<AdjustmentResult | null>(null)
  const errorCode = shallowRef<string | null>(null)
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
    errorCode.value = null
  }
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canRead, scope.canAdjust]
  }, retire, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; retire() })

  function allowed() {
    const scope = toValue(context)
    return !disposed && scope.ready && Boolean(scope.userId && scope.tenantId) && scope.canRead && scope.canAdjust
  }

  async function run(current: Attempt): Promise<Outcome> {
    if (!allowed() || request !== null) return { status: 'blocked' }
    const origin = epoch
    const token = Symbol('inventory-adjustment')
    const owns = () => !disposed && origin === epoch && request === token && allowed()
    request = token
    attempt = current
    const dispatch = new AbortController()
    controller = dispatch
    isPending.value = true
    errorCode.value = null
    acknowledged.value = null
    let outcome: Outcome = { status: 'discarded' }
    try {
      const result = await inventoryApi.adjust(current.input, current.key, dispatch.signal)
      if (!owns()) return { status: 'discarded' }
      attempt = null
      hasUncertainResult.value = false
      acknowledged.value = result
      outcome = { status: 'applied', result }
    } catch (caught) {
      if (!owns()) return { status: 'discarded' }
      const response = (caught as { response?: { status?: number; data?: { error?: string } } } | null)?.response
      const status = response?.status
      const code = response?.data?.error ?? null
      const uncertain = status === undefined || status >= 500 || code === 'IDEMPOTENCY_KEY_IN_FLIGHT'
      errorCode.value = code
      hasUncertainResult.value = uncertain
      if (!uncertain) attempt = null
      outcome = uncertain ? { status: 'uncertain' } : { status: 'rejected', code }
    } finally {
      if (controller === dispatch) controller = null
      if (request === token) {
        request = null
        isPending.value = false
      }
    }
    return disposed || origin !== epoch ? { status: 'discarded' } : outcome
  }

  function adjust(input: AdjustmentInput): Promise<Outcome> {
    if (attempt || request || !allowed()) return Promise.resolve({ status: 'blocked' })
    const issue = validateAdjustment(input)
    if (issue) return Promise.resolve({ status: 'invalid', issue })
    return run({ key: crypto.randomUUID(), input: freezeAdjustment(input) })
  }
  function retry(): Promise<Outcome> {
    return attempt && hasUncertainResult.value ? run(attempt) : Promise.resolve({ status: 'blocked' })
  }
  // Gives up on an uncertain attempt (the user will check the stock instead).
  function abandon() {
    if (isPending.value) return
    attempt = null
    hasUncertainResult.value = false
    errorCode.value = null
  }
  const errorMessage = computed(() => {
    if (errorCode.value) return adjustmentErrorCopy(errorCode.value)
    return hasUncertainResult.value ? adjustmentErrorCopy(null) : null
  })
  return {
    adjust, retry, abandon, isPending: readonly(isPending), hasUncertainResult: readonly(hasUncertainResult),
    acknowledged: readonly(acknowledged), errorCode: readonly(errorCode), errorMessage,
  }
}
