import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { SaleDetail, UpdateSaleHoldPayload } from '../interfaces/sale.types'
import {
  decodeSaleHoldError,
  saleHoldErrorNeedsReload,
  type SaleHoldErrorCode,
} from '../utils/saleHold.utils'

// useToast is auto-imported by the @nuxt/ui/vite plugin (unplugin-auto-import).
declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'success' | 'error' | 'warning' }) => void
}

export type SaleHoldDeadlineResult = { ok: true } | { ok: false; code: SaleHoldErrorCode }

/**
 * BE handoff 24 §2: `PATCH /sales/:id/hold` (`update:Sale`). Success refreshes the sale detail and
 * every confirmed-list slot (the list shows the deadline too). A failure resolves to its decoded
 * code so the dialog places the message (field error, inline alert or toast); when the sale changed
 * under the user (`saleHoldErrorNeedsReload`) the same slots are refreshed first.
 */
export function useSaleHoldDeadline(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const toast = useToast()

  function refreshSale() {
    const tenant = tenantId.value
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.detail(tenant, toValue(saleId)) })
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.confirmedPrefix(tenant) })
  }

  const mutation = useMutation<SaleDetail, unknown, UpdateSaleHoldPayload>({
    mutationFn: (payload) => saleApi.updateHold(toValue(saleId), payload),
    onSuccess: () => {
      refreshSale()
      toast.add({ title: 'Fecha límite actualizada', color: 'success' })
    },
  })

  async function updateDeadline(payload: UpdateSaleHoldPayload): Promise<SaleHoldDeadlineResult> {
    try {
      await mutation.mutateAsync(payload)
      return { ok: true }
    } catch (error) {
      const code = decodeSaleHoldError(error)
      if (saleHoldErrorNeedsReload(code)) refreshSale()
      return { ok: false, code }
    }
  }

  return { updateDeadline, isPending: computed(() => mutation.isPending.value) }
}
