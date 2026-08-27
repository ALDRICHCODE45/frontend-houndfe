/**
 * useUpdateDeliveryRoute — S4c (sdd delivery-routes, design.md §6.3, §7.2)
 *
 * TanStack mutation composable for `PATCH /delivery-routes/:id` (edit DRAFT).
 *
 * Contract:
 *   - On success: invalidate BOTH `deliveryRouteQueryKeys.detail(tenantId, id)`
 *     AND `deliveryRouteQueryKeys.listPrefix(tenantId)`. Fires the Spanish
 *     "Cambios guardados" toast.
 *   - On error: route through `extractDeliveryRouteErrorCode` → toast with
 *     `DELIVERY_ROUTE_ERROR_MAP` copy, else fall back to `normalizeApiError`.
 *   - NO optimistic writes, NO setQueryData.
 *   - Returns `mutateAsync`, `isPending`, `error`.
 *
 * Pure handlers (`handleUpdateSuccess`, `handleUpdateError`) are extracted so
 * the co-located spec can drive them with mock deps.
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys } from '@/core/shared/constants/query-keys'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import {
  DELIVERY_ROUTE_ERROR_MAP,
  extractDeliveryRouteErrorCode,
} from '../interfaces/errors'
import type {
  DeliveryRouteResponseDto,
  UpdateDeliveryRouteRequest,
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
 * Side-effect collaborators the mutation delegates to. Pure handlers accept
 * these so the unit tests assert against `vi.fn()` mocks.
 */
export interface UpdateMutationDeps {
  /** Invalidate the per-tenant detail query so the next read is fresh. */
  invalidateDetail: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the per-tenant list prefix query. */
  invalidateList: (args: { queryKey: readonly unknown[] }) => void
  /** Fire a Spanish toast (success or error). */
  addToast: (toast: { title: string; description?: string; color: 'success' | 'error' }) => void
}

/**
 * PURE success handler — invalidates detail + listPrefix, fires Spanish toast.
 * Exported for direct unit testing.
 */
export function handleUpdateSuccess(
  tenantId: string,
  id: string,
  deps: UpdateMutationDeps,
): void {
  deps.invalidateDetail({ queryKey: deliveryRouteQueryKeys.detail(tenantId, id) })
  deps.invalidateList({ queryKey: deliveryRouteQueryKeys.listPrefix(tenantId) })
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.updateSuccess, color: 'success' })
}

/**
 * PURE error router — passes the error through `extractDeliveryRouteErrorCode`
 * and dispatches to a toast. Falls back to `normalizeApiError`.
 */
export function handleUpdateError(
  error: unknown,
  deps: UpdateMutationDeps,
): void {
  const code = extractDeliveryRouteErrorCode(error)
  if (code) {
    deps.addToast({ title: DELIVERY_ROUTE_ERROR_MAP[code], color: 'error' })
    return
  }
  const fallback = 'No se pudo actualizar la ruta'
  const normalized = normalizeApiError(error, fallback)
  deps.addToast({
    title: fallback,
    description: normalized.message,
    color: 'error',
  })
}

/** Payload tuple the mutationFn accepts. */
export interface UpdateDeliveryRouteMutationInput {
  id: string
  payload: UpdateDeliveryRouteRequest
}

/**
 * useUpdateDeliveryRoute — composable wrapper.
 *
 * Returns the same shape as `useUpdateNotificationConfigMutation`:
 *   - mutateAsync({ id, payload }) — call to trigger the update
 *   - isPending                     — true while the request is in-flight
 *   - error                         — the last error, or null
 */
export function useUpdateDeliveryRoute() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<
    DeliveryRouteResponseDto,
    AxiosError,
    UpdateDeliveryRouteMutationInput
  >({
    mutationFn: ({ id, payload }) => deliveryRoutesApi.update(id, payload),

    onSuccess: (_response, { id }) => {
      handleUpdateSuccess(tenantId.value, id, {
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
      handleUpdateError(error, {
        invalidateDetail: () => undefined,
        invalidateList: () => undefined,
        addToast: (t) => toast.add(t),
      })
    },
  })

  return {
    /** Call to trigger the update. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
