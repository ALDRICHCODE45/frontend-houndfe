import { readonly, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { newIdempotencyKey } from '@/features/POS/sales/utils/idempotency.utils'
import type {
  RefundSettlementRequest,
  RefundSettlementResponse,
} from '@/features/POS/sales/interfaces/refund-settlement.types'
import {
  buildSettlementRequest,
  formSignature,
  type SettlementFormValues,
} from '../utils/settlementForm'
import {
  mapSettlementError,
  type SettlementErrorCode,
  type SettlementErrorInfo,
} from '../utils/settlementErrors'

export type SettleOutcome =
  | { status: 'ignored' }
  | { status: 'settled'; response: RefundSettlementResponse; request: RefundSettlementRequest }
  | { status: 'failed'; error: SettlementErrorInfo }

export interface UseSettleRefundOptions {
  /** Wait before resending after `IDEMPOTENCY_KEY_IN_FLIGHT`. */
  retryDelayMs?: number
  /** Resends after `IDEMPOTENCY_KEY_IN_FLIGHT` before giving up. */
  maxInFlightRetries?: number
  /** Clock for «Ahora» (tests). */
  now?: () => Date
}

/** Errors after which the list and the balance are refetched (§4 balance rules, §6). */
const REFETCH_CODES: ReadonlySet<SettlementErrorCode> = new Set([
  'SETTLEMENT_EXCEEDS_REFUND',
  'REFUND_ALREADY_SETTLED',
  'REFUND_NOT_FOUND',
  'RESPONSE_INVALID',
])

interface Attempt {
  signature: string
  key: string
  request: RefundSettlementRequest
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Records one devolución against a refund with the contract's idempotency rules
 * (odd/handoff/06-refund-settlements.md §5):
 *
 *   - One `Idempotency-Key` per attempt. An attempt is the refund plus the form answers; a
 *     retry with the same answers resends the SAME frozen request (so «Ahora» keeps its first
 *     instant) under the same key, and any changed answer opens a new attempt.
 *   - A submit while one is in flight is ignored (double click).
 *   - `IDEMPOTENCY_KEY_IN_FLIGHT` waits and resends the same key and body; the stored `200`
 *     comes back once the first request finishes.
 *   - `IDEMPOTENCY_KEY_CONFLICT` and a success close the attempt; other failures keep it, since
 *     the backend released the key and retrying the same body is safe.
 *   - After a success (new or replayed, whose balances are a snapshot) and after the balance
 *     errors, every pending-refund slot is invalidated: this page, the dashboard and the nav badge,
 *     plus the detail of the cancelled sale.
 */
export function useSettleRefund(options: UseSettleRefundOptions = {}) {
  const { retryDelayMs = 800, maxInFlightRetries = 5, now = () => new Date() } = options
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const isSubmitting = ref(false)
  let attempt: Attempt | null = null

  function refreshPending(saleId?: string) {
    void queryClient.invalidateQueries({
      queryKey: saleQueryKeys.pendingRefundsPrefix(tenantId.value),
    })
    // The cancelled sale's detail lists its refunds too.
    if (saleId) {
      void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenantId.value, saleId) })
    }
  }

  async function send(refundId: string, current: Attempt): Promise<RefundSettlementResponse> {
    for (let retry = 0; ; retry += 1) {
      try {
        return await saleApi.settleRefund(refundId, current.request, current.key)
      } catch (error) {
        const inFlight = mapSettlementError(error).code === 'IDEMPOTENCY_KEY_IN_FLIGHT'
        if (!inFlight || retry >= maxInFlightRetries) throw error
        await wait(retryDelayMs)
      }
    }
  }

  async function submit(
    refundId: string,
    values: SettlementFormValues,
    context: { cashSessionId: string | null; saleId?: string },
  ): Promise<SettleOutcome> {
    if (isSubmitting.value) return { status: 'ignored' }

    const signature = formSignature(refundId, values)
    if (!attempt || attempt.signature !== signature) {
      attempt = {
        signature,
        key: newIdempotencyKey(),
        request: buildSettlementRequest(values, { now: now(), cashSessionId: context.cashSessionId }),
      }
    }
    const current = attempt

    isSubmitting.value = true
    try {
      const response = await send(refundId, current)
      attempt = null
      refreshPending(response.saleId)
      return { status: 'settled', response, request: current.request }
    } catch (caught) {
      const error = mapSettlementError(caught)
      if (error.code === 'IDEMPOTENCY_KEY_CONFLICT') attempt = null
      if (REFETCH_CODES.has(error.code)) refreshPending(context.saleId)
      return { status: 'failed', error }
    } finally {
      isSubmitting.value = false
    }
  }

  /** Forget the open attempt (the panel closed or moved to another refund). */
  function reset() {
    attempt = null
  }

  return { submit, reset, isSubmitting: readonly(isSubmitting) }
}
