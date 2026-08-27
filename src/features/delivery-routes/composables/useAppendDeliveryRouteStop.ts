/**
 * useAppendDeliveryRouteStop — S5b (sdd delivery-routes, design.md §6.3, §7.2)
 *
 * TanStack mutation composable for `POST /delivery-routes/:id/stops` (201,
 * manager-only; appends a sale as a new stop on a DRAFT route).
 *
 * Contract:
 *   - On success: invalidate `deliveryRouteQueryKeys.detail(tenantId, id)` +
 *     `deliveryRouteQueryKeys.listPrefix(tenantId)` + `saleQueryKeys.confirmed
 *     (tenantId)` (the eligible picker refreshes because a sale just left the
 *     eligible pool). Fires the Spanish "Parada agregada" toast.
 *   - On error: route through the shared `surfaceDeliveryRouteError(error,
 *     'toast')` helper — the `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` (422)
 *     domain copy surfaces verbatim.
 *   - NO optimistic writes, NO setQueryData (payment-details convention).
 *   - Returns `{ mutateAsync, isPending, error }` (mirrors the other mutations).
 *
 * Pure handlers (`handleAppendSuccess`, `handleAppendError`) are extracted as
 * named exports so the co-located spec can drive them with mock deps — no
 * Pinia, no QueryClient, no toast runtime in the unit test (extract-before-mock).
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import {
  surfaceDeliveryRouteError,
  type DeliveryRouteErrorSurface,
} from '../interfaces/errors'
import type {
  AppendDeliveryRouteStopRequest,
  DeliveryRouteResponseDto,
} from '../interfaces/delivery-route.types'

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * AppendMutationDeps — Side-effect collaborators the mutation delegates to.
 * Pure handlers accept these so the unit test asserts against `vi.fn()` mocks
 * without any runtime.
 */
export interface AppendMutationDeps extends DeliveryRouteErrorSurface {
  /** Invalidate the per-tenant detail query so the next read is fresh. */
  invalidateDetail: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the per-tenant list prefix query. */
  invalidateList: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the confirmed-sales slot so the eligible picker refreshes. */
  invalidateConfirmedSales: (args: { queryKey: readonly unknown[] }) => void
}

/**
 * PURE success handler — invalidates detail + listPrefix + confirmed-sales +
 * fires Spanish toast. Exported for direct unit testing.
 */
export function handleAppendSuccess(
  tenantId: string,
  id: string,
  deps: AppendMutationDeps,
): void {
  deps.invalidateDetail({ queryKey: deliveryRouteQueryKeys.detail(tenantId, id) })
  deps.invalidateList({ queryKey: deliveryRouteQueryKeys.listPrefix(tenantId) })
  deps.invalidateConfirmedSales({ queryKey: saleQueryKeys.confirmed(tenantId) })
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.appendSuccess, color: 'success' })
}

/**
 * PURE error router — pushes the error through `surfaceDeliveryRouteError` with
 * channel `'toast'` (append is an action mutation; eligibility conflict surfaces
 * a toast, not an inline field).
 */
export function handleAppendError(
  error: unknown,
  deps: AppendMutationDeps,
): void {
  surfaceDeliveryRouteError(error, 'toast', deps, 'No se pudo agregar la parada')
}

/** Payload tuple the mutationFn accepts. */
export interface AppendDeliveryRouteStopMutationInput {
  id: string
  payload: AppendDeliveryRouteStopRequest
}

/**
 * useAppendDeliveryRouteStop — composable wrapper.
 *
 * Returns the same shape as the other delivery-route mutations:
 *   - mutateAsync({ id, payload }) — call to trigger the append
 *   - isPending                     — true while the request is in-flight
 *   - error                         — the last error, or null
 */
export function useAppendDeliveryRouteStop() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<
    DeliveryRouteResponseDto,
    AxiosError,
    AppendDeliveryRouteStopMutationInput
  >({
    mutationFn: ({ id, payload }) => deliveryRoutesApi.appendStop(id, payload),

    onSuccess: (_response, { id }) => {
      handleAppendSuccess(tenantId.value, id, {
        invalidateDetail: ({ queryKey }) => {
          void queryClient.invalidateQueries({ queryKey })
        },
        invalidateList: ({ queryKey }) => {
          void queryClient.invalidateQueries({ queryKey })
        },
        invalidateConfirmedSales: ({ queryKey }) => {
          void queryClient.invalidateQueries({ queryKey })
        },
        addToast: (t) => toast.add(t),
      })
    },

    onError: (error: AxiosError) => {
      handleAppendError(error, {
        invalidateDetail: () => undefined,
        invalidateList: () => undefined,
        invalidateConfirmedSales: () => undefined,
        addToast: (t) => toast.add(t),
      })
    },
  })

  return {
    /** Call to trigger the append. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
