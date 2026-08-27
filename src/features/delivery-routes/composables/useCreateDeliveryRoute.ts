/**
 * useCreateDeliveryRoute — S4c (sdd delivery-routes, design.md §6.3, §7.2)
 *
 * TanStack mutation composable for `POST /delivery-routes` (create DRAFT).
 *
 * Contract:
 *   - On success: invalidate `deliveryRouteQueryKeys.listPrefix(tenantId)`
 *     and fire the Spanish "Ruta creada" toast.
 *   - On error: route through `extractDeliveryRouteErrorCode` → toast with
 *     `DELIVERY_ROUTE_ERROR_MAP` copy, else fall back to `normalizeApiError`.
 *   - NO optimistic writes, NO setQueryData (payment-details convention).
 *   - Returns `mutateAsync`, `isPending`, `error`.
 *
 * The pure success/error handlers are extracted as named exports so the
 * co-located spec can drive them with mock deps (extract-before-mock).
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
import type { CreateDeliveryRouteRequest, DeliveryRouteResponseDto } from '../interfaces/delivery-route.types'

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.stubGlobal('useToast', () => ({ add: mockFn })).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * Side-effect collaborators the mutation delegates to. Pure handlers accept
 * these so the unit tests assert against `vi.fn()` mocks with no Pinia,
 * no QueryClient, no toast runtime in the test.
 */
export interface CreateMutationDeps {
  /** Invalidate the per-tenant list prefix query so the next read is fresh. */
  invalidateList: () => void
  /** Fire a Spanish toast (success or error). */
  addToast: (toast: { title: string; description?: string; color: 'success' | 'error' }) => void
}

/**
 * PURE success handler — invalidates list prefix + fires Spanish toast.
 * Exported for direct unit testing.
 */
export function handleCreateSuccess(deps: CreateMutationDeps): void {
  deps.invalidateList()
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.createSuccess, color: 'success' })
}

/**
 * PURE error router — passes the error through `extractDeliveryRouteErrorCode`
 * and dispatches to a toast. Falls back to `normalizeApiError` so the user sees
 * a useful Spanish message even on transport failures / unknown codes.
 */
export function handleCreateError(
  error: unknown,
  deps: CreateMutationDeps,
): void {
  const code = extractDeliveryRouteErrorCode(error)
  if (code) {
    deps.addToast({ title: DELIVERY_ROUTE_ERROR_MAP[code], color: 'error' })
    return
  }
  const fallback = 'No se pudo crear la ruta'
  const normalized = normalizeApiError(error, fallback)
  deps.addToast({
    title: fallback,
    description: normalized.message,
    color: 'error',
  })
}

/**
 * useCreateDeliveryRoute — composable wrapper.
 *
 * Returns the same shape as `useCreateEmployee`:
 *   - mutateAsync(payload) — call to trigger the create
 *   - isPending             — true while the request is in-flight
 *   - error                 — the last error, or null
 */
export function useCreateDeliveryRoute() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<DeliveryRouteResponseDto, AxiosError, CreateDeliveryRouteRequest>({
    mutationFn: (payload) => deliveryRoutesApi.create(payload),

    onSuccess: () => {
      handleCreateSuccess({
        invalidateList: () => {
          void queryClient.invalidateQueries({
            queryKey: deliveryRouteQueryKeys.listPrefix(tenantId.value),
          })
        },
        addToast: (t) => toast.add(t),
      })
    },

    onError: (error: AxiosError) => {
      handleCreateError(error, {
        invalidateList: () => undefined,
        addToast: (t) => toast.add(t),
      })
    },
  })

  return {
    /** Call to trigger the creation. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
