import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { saleApi } from '../api/sale.api'
import {
  analyticsQueryKeys,
  promotionQueryKeys,
  saleQueryKeys,
} from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { SALE_CANCELLATION_REASON } from '../constants/sale.constants'
import type { SaleCancellationResponse } from '../interfaces/sale.types'
import { formatCentsMXN } from '../utils/currency.utils'

// useToast is auto-imported by the @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.mock('@nuxt/ui/composables/useToast').
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

interface DomainErrorResponse {
  error?: string
  message?: string
}

/**
 * PCA-3 (promotion-capacity-alerts): full confirmed-sale cancellation.
 *
 * Backend guide §§2.8–2.9 + §3.3. The POS UI flow ALWAYS cancels as
 * `CUSTOMER_REQUEST`; the composable takes no reason argument so no caller can
 * deviate. The API/types still expose the full five-reason contract.
 *
 * On success the sale is CANCELED and the backend has restored stock and
 * promotion capacity exactly once. We therefore invalidate every slot whose
 * value can change:
 *   - the current sale detail (renders CANCELED),
 *   - every confirmed-sale list slot,
 *   - every pending-refund queue slot,
 *   - the dashboard recent/debt sale slots,
 *   - all active-tenant promotion list/detail/available slots (restored counters),
 *   - the branch sales summary and the branch time-series analytics slots.
 * Tenant isolation is preserved: every key is scoped to the active tenant.
 *
 * Cancellation is idempotent server-side (`sale:cancel:<saleId>`): a replay
 * with the same actor + reason returns the previous result as a normal success.
 * A different actor or reason yields `409 IDEMPOTENCY_KEY_CONFLICT`, which we
 * surface honestly (the units were NOT restored again) while refreshing the
 * affected sale state.
 *
 * `cancelSale()` resolves to the response on success and to `undefined` on any
 * failure (the toast is already dispatched), so the caller can keep the
 * confirmation modal open for recovery.
 */
export function useSaleCancellation(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const toast = useToast()

  function invalidateAffectedSlots() {
    const tenant = tenantId.value
    const id = toValue(saleId)
    for (const queryKey of [
      saleQueryKeys.detail(tenant, id),
      saleQueryKeys.confirmedPrefix(tenant),
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

  function refreshSaleState() {
    const tenant = tenantId.value
    const id = toValue(saleId)
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenant, id) })
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmedPrefix(tenant) })
  }

  function buildSuccessDescription(data: SaleCancellationResponse): string {
    const refunded = formatCentsMXN(data.refundedCents)
    // The authoritative restored quantity is the SUM of each returned line's
    // `quantity`, never the number of restocked rows.
    const restoredUnits = data.restockedItems.reduce((total, item) => total + item.quantity, 0)
    if (restoredUnits === 0) return `${refunded} reembolsados`
    // Authoritative units, not "articles": the backend restores stock quantities,
    // and every unit is a distinct unit restored.
    const noun = restoredUnits === 1 ? 'unidad restaurada' : 'unidades restauradas'
    return `${refunded} reembolsados · ${restoredUnits} ${noun}`
  }

  const mutation = useMutation<SaleCancellationResponse, unknown, void>({
    mutationFn: () =>
      saleApi.cancelSale(toValue(saleId), {
        reason: SALE_CANCELLATION_REASON.CUSTOMER_REQUEST,
      }),
    onSuccess: (data: SaleCancellationResponse) => {
      invalidateAffectedSlots()
      toast.add({
        title: 'Venta cancelada',
        description: buildSuccessDescription(data),
        color: 'success',
      })
    },
    onError: (error: unknown) => {
      const code = (error as AxiosError<DomainErrorResponse>)?.response?.data?.error

      if (code === 'IDEMPOTENCY_KEY_CONFLICT') {
        // Another actor/reason already canceled this sale. The units were NOT
        // restored again — never imply they were.
        refreshSaleState()
        toast.add({
          title: 'No se pudo completar la cancelación',
          description:
            'La venta ya había sido cancelada por otro usuario o con otro motivo. Actualizamos el estado de la venta.',
          color: 'warning',
        })
        return
      }

      if (code === 'SALE_NOT_FOUND') {
        refreshSaleState()
        toast.add({
          title: 'Venta no encontrada',
          description: 'La venta ya no existe o no pertenece a esta sucursal.',
          color: 'error',
        })
        return
      }

      toast.add({
        title: 'No se pudo cancelar la venta',
        description: 'Reintenta en unos segundos.',
        color: 'error',
      })
    },
  })

  async function cancelSale(): Promise<SaleCancellationResponse | undefined> {
    try {
      return await mutation.mutateAsync()
    } catch {
      // Error already handled by onError — swallow rejection so callers keep
      // the confirmation modal open without a try/catch of their own.
      return undefined
    }
  }

  return {
    cancelSale,
    isPending: computed(() => mutation.isPending.value),
  }
}
