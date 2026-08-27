/**
 * useDeleteDeliveryRoute — S5b (sdd delivery-routes, design.md §6.3, §7.2, §10.1)
 *
 * TanStack mutation composable for `DELETE /delivery-routes/:id` (204, manager
 * only — zero-stop DRAFT).
 *
 * Contract:
 *   - On success: `removeQueries(detail(tenantId, id))` (the route no longer
 *     exists server-side, so we drop the cached detail rather than refetch it)
 *     AND `invalidateQueries(listPrefix(tenantId))`. Fires the Spanish
 *     "Ruta eliminada" toast.
 *   - On error: route through the shared `surfaceDeliveryRouteError(error,
 *     'toast', deps)` helper (S5a REFACTOR target, reused by S5b).
 *   - NO optimistic writes, NO setQueryData (payment-details convention).
 *   - Returns `{ mutateAsync, isPending, error }` (mirrors the other mutations).
 *
 * Pure handlers (`handleDeleteSuccess`, `handleDeleteError`) are extracted as
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

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * DeleteMutationDeps — Side-effect collaborators the mutation delegates to.
 * Pure handlers accept these so the unit test asserts against `vi.fn()` mocks
 * without any runtime.
 */
export interface DeleteMutationDeps extends DeliveryRouteErrorSurface {
  /** Remove the cached detail slot (the route is gone, not stale). */
  removeDetail: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the per-tenant list prefix query. */
  invalidateList: (args: { queryKey: readonly unknown[] }) => void
}

/**
 * PURE success handler — removes the detail slot + invalidates the list prefix
 * + fires the Spanish toast. Exported for direct unit testing.
 */
export function handleDeleteSuccess(
  tenantId: string,
  id: string,
  deps: DeleteMutationDeps,
): void {
  deps.removeDetail({ queryKey: deliveryRouteQueryKeys.detail(tenantId, id) })
  deps.invalidateList({ queryKey: deliveryRouteQueryKeys.listPrefix(tenantId) })
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.deleteSuccess, color: 'success' })
}

/**
 * PURE error router — pushes the error through `surfaceDeliveryRouteError` with
 * channel `'toast'` (delete is an action mutation; a 404/422 surfaces a toast,
 * not a full-page state).
 */
export function handleDeleteError(
  error: unknown,
  deps: DeleteMutationDeps,
): void {
  surfaceDeliveryRouteError(error, 'toast', deps, 'No se pudo eliminar la ruta')
}

/**
 * useDeleteDeliveryRoute — composable wrapper.
 *
 * Returns the same shape as the other delivery-route mutations:
 *   - mutateAsync(id) — call to trigger the delete
 *   - isPending       — true while the request is in-flight
 *   - error           — the last error, or null
 */
export function useDeleteDeliveryRoute() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<void, AxiosError, string>({
    mutationFn: (id) => deliveryRoutesApi.delete(id),

    onSuccess: (_response, id) => {
      handleDeleteSuccess(tenantId.value, id, {
        removeDetail: ({ queryKey }) => {
          queryClient.removeQueries({ queryKey })
        },
        invalidateList: ({ queryKey }) => {
          void queryClient.invalidateQueries({ queryKey })
        },
        addToast: (t) => toast.add(t),
      })
    },

    onError: (error: AxiosError) => {
      handleDeleteError(error, {
        removeDetail: () => undefined,
        invalidateList: () => undefined,
        addToast: (t) => toast.add(t),
      })
    },
  })

  return {
    /** Call to trigger the delete. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
