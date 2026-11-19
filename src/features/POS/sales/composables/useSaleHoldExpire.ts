import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import {
  analyticsQueryKeys,
  promotionQueryKeys,
  saleQueryKeys,
} from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { ExpireSaleHoldResponse, SaleHoldExpireOutcome } from '../interfaces/sale.types'
import { newIdempotencyKey } from '../utils/idempotency.utils'
import {
  decodeSaleHoldExpireError,
  saleHoldExpireErrorMessage,
  saleHoldExpireKeepsAttempt,
  saleHoldExpireNeedsReload,
  saleHoldExpireOutcomeTitle,
  type SaleHoldExpireErrorCode,
} from '../utils/saleHold.utils'

// useToast is auto-imported by the @nuxt/ui/vite plugin (unplugin-auto-import).
declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'success' | 'error' | 'warning' }) => void
}

export type SaleHoldExpireResult =
  | { ok: true; outcome: SaleHoldExpireOutcome | null }
  | { ok: false; code: SaleHoldExpireErrorCode | 'PENDING' }

/**
 * BE handoff 24 §6 «Vencer apartado ahora»: `POST /sales/:id/hold/expire` (`update:Sale`).
 *
 * One `Idempotency-Key` per attempt: taken on the first send, reused only to retry an uncertain
 * result (network, 5xx, in flight), dropped after a success or a definite rejection (which
 * consumes nothing server-side). `resetAttempt()` starts a new attempt (the dialog reopened).
 * Success refreshes the detail, the lists and, since a cancellation releases stock and promotion
 * capacity, the same slots a cancellation refreshes; the toast follows `outcome`. A sale that
 * changed under the user is reloaded; every failure gets its es-MX toast.
 */
export function useSaleHoldExpire(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const toast = useToast()
  let attemptKey: string | null = null

  function refreshSale() {
    const tenant = tenantId.value
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenant, toValue(saleId)) })
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmedPrefix(tenant) })
  }

  function refreshAfterExpiry() {
    refreshSale()
    const tenant = tenantId.value
    for (const queryKey of [
      saleQueryKeys.pendingRefundsPrefix(tenant),
      saleQueryKeys.dashboardRecent(tenant),
      saleQueryKeys.dashboardDebt(tenant),
      promotionQueryKeys.all(tenant),
      analyticsQueryKeys.salesSummaryPrefix(tenant),
      analyticsQueryKeys.salesTimeseriesPrefix(tenant),
    ]) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  const mutation = useMutation<ExpireSaleHoldResponse, unknown, { expectedVersion: number; key: string }>({
    mutationFn: ({ expectedVersion, key }) => saleApi.expireHold(toValue(saleId), { expectedVersion }, key),
  })

  function resetAttempt() {
    attemptKey = null
  }

  async function expireHold(expectedVersion: number): Promise<SaleHoldExpireResult> {
    if (mutation.isPending.value) return { ok: false, code: 'PENDING' }
    attemptKey ??= newIdempotencyKey()
    try {
      const { outcome } = await mutation.mutateAsync({ expectedVersion, key: attemptKey })
      attemptKey = null
      refreshAfterExpiry()
      toast.add({ title: saleHoldExpireOutcomeTitle(outcome), color: 'success' })
      return { ok: true, outcome }
    } catch (error) {
      const code = decodeSaleHoldExpireError(error)
      if (!saleHoldExpireKeepsAttempt(code)) attemptKey = null
      if (saleHoldExpireNeedsReload(code)) refreshSale()
      toast.add({ title: saleHoldExpireErrorMessage(code), color: 'error' })
      return { ok: false, code }
    }
  }

  return { expireHold, resetAttempt, isPending: computed(() => mutation.isPending.value) }
}
