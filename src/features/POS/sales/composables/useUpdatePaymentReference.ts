import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { ReferenceUpdateError, saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { UpdatePaymentReferencePayload } from '../interfaces/sale.types'

/**
 * Mutation contract for the reference-edit PATCH (REQ-NEW-2, REQ-NEW-7).
 *
 * The view owns the slideover and passes `paymentId` + `payload` per call so a
 * single composable instance can serve any number of edit affordances on the
 * page (today: one per non-CASH payment row in PaymentsListSection).
 */
export interface UpdatePaymentReferenceVariables {
  paymentId: string
  payload: UpdatePaymentReferencePayload
}

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const MAX_RETRIES = 3

/**
 * useUpdatePaymentReference — wraps the PATCH endpoint exposed in WU-A.
 *
 * Design notes (per `tasks.md` WU-B.3):
 * - Accepts `MaybeRefOrGetter<string>` so callers can pass a raw id, a Ref,
 *   or a getter that derives the id from props/route (mirrors the
 *   `useSaleDueDate` pattern at `composables/useSaleDueDate.ts:31`).
 * - Retries network-level failures up to 3 times (transient), but skips
 *   retries for typed `ReferenceUpdateError` codes (404 / 403) — there is no
 *   value in retrying a missing-payment or forbidden-state response.
 * - On `ENTITY_NOT_FOUND` we invalidate the detail cache so the cashier sees
 *   the fresh state immediately (the payment row may have been removed by
 *   another cashier).
 * - On `SALE_UPDATE_FORBIDDEN` we surface the permission toast only — no
 *   refetch, the state did not change.
 */
export function useUpdatePaymentReference(saleId: MaybeRefOrGetter<string>) {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()
  const lastError = ref<ReferenceUpdateError | null>(null)
  const toast = useToast()

  const mutation = useMutation({
    // sale.api.ts already classifies known backend codes into
    // ReferenceUpdateError; unknown codes (e.g. 5xx) bubble up raw and
    // land in the catch-all branch below.
    mutationFn: ({ paymentId, payload }: UpdatePaymentReferenceVariables) =>
      saleApi.updatePaymentReference(toValue(saleId), paymentId, payload),
    retry: (failureCount, error) => {
      if (error instanceof ReferenceUpdateError) return false
      return failureCount < MAX_RETRIES
    },
    onSuccess: async () => {
      lastError.value = null
      await queryClient.invalidateQueries({
        queryKey: saleQueryKeys.detail(tenantId.value, toValue(saleId)),
      })
    },
    onError: async (error) => {
      if (error instanceof ReferenceUpdateError) {
        lastError.value = error
        if (error.code === 'ENTITY_NOT_FOUND') {
          toast.add({
            title: 'Pago no encontrado',
            description: 'El pago ya no existe. Refrescando detalle...',
            color: 'warning',
          })
          await queryClient.invalidateQueries({
            queryKey: saleQueryKeys.detail(tenantId.value, toValue(saleId)),
          })
          return
        }
        if (error.code === 'SALE_UPDATE_FORBIDDEN') {
          toast.add({
            title: 'Sin permisos',
            description: 'No tenés permisos para editar la referencia',
            color: 'error',
          })
          return
        }
        if (error.code === 'NETWORK_ERROR') {
          // Reserved for explicit re-throw scenarios; fall through to generic.
        }
      }
      toast.add({
        title: 'Error al actualizar la referencia',
        description: 'No se pudo guardar el cambio. Intenta nuevamente.',
        color: 'error',
      })
    },
  })

  return {
    updateReference: (vars: UpdatePaymentReferenceVariables) => mutation.mutateAsync(vars),
    isPending: computed(() => mutation.isPending.value),
    lastError: computed(() => lastError.value),
  }
}