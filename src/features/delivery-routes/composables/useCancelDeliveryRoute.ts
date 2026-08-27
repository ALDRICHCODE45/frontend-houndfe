/**
 * useCancelDeliveryRoute — S5b (sdd delivery-routes, design.md §6.3, §7.2)
 *
 * TanStack mutation composable for `POST /delivery-routes/:id/cancel`
 * (manager-only; transitions ACTIVE → CANCELLED).
 *
 * Contract:
 *   - On success: invalidate BOTH `deliveryRouteQueryKeys.detail(tenantId, id)`
 *     AND `deliveryRouteQueryKeys.listPrefix(tenantId)`. Fires the Spanish
 *     "Ruta cancelada" toast.
 *   - On 422 `DELIVERY_ROUTE_INVALID_TRANSITION`: specific toast (resync stale
 *     status) via the shared `surfaceDeliveryRouteError(error, 'toast')` helper.
 *   - Other errors route through the same shared helper.
 *   - NO optimistic writes, NO setQueryData (payment-details convention).
 *   - Returns `{ mutateAsync, isPending, error }` (mirrors the other mutations).
 *
 * Pure handlers (`handleCancelSuccess`, `handleCancelError`) are extracted as
 * named exports so the co-located spec can drive them with mock deps — no
 * Pinia, no QueryClient, no toast runtime in the unit test (extract-before-mock).
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import {
  surfaceDeliveryRouteError,
  type DeliveryRouteErrorSurface,
} from '../interfaces/errors'
import type { DeliveryRouteResponseDto } from '../interfaces/delivery-route.types'

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * CancelMutationDeps — Side-effect collaborators the mutation delegates to.
 * Pure handlers accept these so the unit test asserts against `vi.fn()` mocks
 * without any runtime.
 */
export interface CancelMutationDeps extends DeliveryRouteErrorSurface {
  /** Invalidate the per-tenant detail query so the next read is fresh. */
  invalidateDetail: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the per-tenant list prefix query. */
  invalidateList: (args: { queryKey: readonly unknown[] }) => void
}

/**
 * PURE success handler — invalidates detail + listPrefix + fires Spanish toast.
 * Exported for direct unit testing.
 */
export function handleCancelSuccess(
  tenantId: string,
  id: string,
  deps: CancelMutationDeps,
): void {
  deps.invalidateDetail({ queryKey: deliveryRouteQueryKeys.detail(tenantId, id) })
  deps.invalidateList({ queryKey: deliveryRouteQueryKeys.listPrefix(tenantId) })
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.cancelSuccess, color: 'success' })
}

/**
 * PURE error router — pushes the error through `surfaceDeliveryRouteError` with
 * channel `'toast'` (cancel is an action mutation; a 422/404 surfaces a toast).
 */
export function handleCancelError(
  error: unknown,
  deps: CancelMutationDeps,
): void {
  surfaceDeliveryRouteError(error, 'toast', deps, 'No se pudo cancelar la ruta')
}

/**
 * useCancelDeliveryRoute — composable wrapper.
 *
 * Returns the same shape as the other delivery-route mutations:
 *   - mutateAsync(id) — call to trigger the cancel
 *   - isPending       — true while the request is in-flight
 *   - error           — the last error, or null
 */
export function useCancelDeliveryRoute() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<DeliveryRouteResponseDto, AxiosError, string>({
    mutationFn: (id) => deliveryRoutesApi.cancel(id),

    onSuccess: (_response, id) => {
      handleCancelSuccess(tenantId.value, id, {
        invalidateDetail: ({ queryKey }) => {
          void queryClient.invalidateQueries({ queryKey })
        },
        invalidateList: ({ queryKey }) => {
          void queryClient.invalidateQueries({ queryKey })
        },
        addToast: (t) => toast.add(t),
      })
    },

    onError: (error: AxiosError) => {
      handleCancelError(error, {
        invalidateDetail: () => undefined,
        invalidateList: () => undefined,
        addToast: (t) => toast.add(t),
      })
    },
  })

  return {
    /** Call to trigger the cancel. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
