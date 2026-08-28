/**
 * useCheckInStop — S6b (sdd delivery-routes, design.md §4.2, §6.3, §7.2, REQ-DRC-001..008)
 *
 * TanStack mutation composable for `POST /delivery-routes/:id/stops/:stopId/check-in`
 * (driver-only; transitions a PENDING stop → COMPLETED on an ACTIVE route the
 * driver owns).
 *
 * Contract:
 *   - On success: invalidate BOTH `deliveryRouteQueryKeys.detail(tenantId, id)`
 *     AND `deliveryRouteQueryKeys.listPrefix(tenantId)`. Fires the Spanish
 *     "Parada marcada como entregada" toast (`toasts.checkInSuccess`).
 *   - On error: route through `surfaceDeliveryRouteError(error, 'toast')`.
 *     `DELIVERY_ROUTE_INVALID_TRANSITION` (422) — including the replay-safe
 *     repeat-check-in path — surfaces the canonical "La ruta no permite esta
 *     acción en su estado actual." copy. 404 ENTITY_NOT_FOUND surfaces the
 *     "Ruta no encontrada." copy.
 *   - NO optimistic writes, NO setQueryData (payment-details convention). The
 *     server-driven refetch is the canonical source of truth: last-stop
 *     check-in flips the route to COMPLETED on the next detail fetch.
 *   - Returns `{ mutateAsync, isPending, error }` (mirrors the other mutations).
 *
 * Pure handlers (`handleCheckInSuccess`, `handleCheckInError`) are extracted as
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
 * CheckInMutationDeps — Side-effect collaborators the mutation delegates to.
 * Pure handlers accept these so the unit test asserts against `vi.fn()` mocks
 * without any runtime.
 */
export interface CheckInMutationDeps extends DeliveryRouteErrorSurface {
  /** Invalidate the per-tenant detail query so the next read is fresh. */
  invalidateDetail: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the per-tenant list prefix query. */
  invalidateList: (args: { queryKey: readonly unknown[] }) => void
}

/**
 * PURE success handler — invalidates detail + listPrefix + fires Spanish toast.
 * Exported for direct unit testing.
 *
 * `stopId` is recorded in the call signature for symmetry with the other
 * mutation handlers (and so the audit log captures it), but the invalidation
 * keys do not include it — the detail cache slot is keyed on the route id
 * alone; the backend returns the canonical DTO with all stops refreshed.
 */
export function handleCheckInSuccess(
  tenantId: string,
  id: string,
  stopId: string,
  deps: CheckInMutationDeps,
): void {
  void stopId // referenced for audit symmetry; the cache invalidation is route-scoped.
  deps.invalidateDetail({ queryKey: deliveryRouteQueryKeys.detail(tenantId, id) })
  deps.invalidateList({ queryKey: deliveryRouteQueryKeys.listPrefix(tenantId) })
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.checkInSuccess, color: 'success' })
}

/**
 * PURE error router — every domain / transport error flows through the shared
 * `surfaceDeliveryRouteError(error, 'toast')` helper. The 422 repeat-check-in
 * idempotency is server-driven: the backend rejects the second transition with
 * `DELIVERY_ROUTE_INVALID_TRANSITION`, the composable surfaces the canonical
 * Spanish copy verbatim, and the user sees ONE toast (no duplicate per the
 * TRIANGULATE invariant — we never fire a success toast on a rejected promise).
 */
export function handleCheckInError(error: unknown, deps: CheckInMutationDeps): void {
  surfaceDeliveryRouteError(error, 'toast', deps, 'No se pudo marcar la parada como entregada')
}

/** Payload tuple the mutationFn accepts. */
export interface CheckInMutationInput {
  id: string
  stopId: string
}

/**
 * useCheckInStop — composable wrapper.
 *
 * Returns the same shape as the other delivery-route mutations:
 *   - mutateAsync({ id, stopId }) — call to trigger the check-in
 *   - isPending                   — true while the request is in-flight
 *   - error                       — the last error, or null
 */
export function useCheckInStop() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<DeliveryRouteResponseDto, AxiosError, CheckInMutationInput>({
    mutationFn: ({ id, stopId }) => deliveryRoutesApi.checkInStop(id, stopId),

    onSuccess: (_response, { id, stopId }) => {
      handleCheckInSuccess(tenantId.value, id, stopId, {
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
      handleCheckInError(error, {
        invalidateDetail: () => undefined,
        invalidateList: () => undefined,
        addToast: (t) => toast.add(t),
      })
    },
  })

  return {
    /** Call to trigger the check-in. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
