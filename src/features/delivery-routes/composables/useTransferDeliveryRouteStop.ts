/**
 * useTransferDeliveryRouteStop — T3 S2/S4 draft-to-draft stop transfer.
 *
 * Backend contract (`POST /delivery-routes/:routeId/stops/:stopId/transfer`):
 *   - Body: `{ destinationRouteId: UUIDv4 }` only.
 *   - Response: a TUPLE `{ originRoute, destinationRoute }` — NOT a single route.
 *   - The backend requires read+update on BOTH routes before mutating; it
 *     revalidates that both are DRAFT and that source !== destination. The list
 *     read permission does NOT imply update on the destination, so the client
 *     never claims it.
 *
 * Contract:
 *   - On success BOTH detail slots are invalidated (origin + destination) plus
 *     the route list prefix, the confirmed-sales prefix and the eligible-sales
 *     prefix (the imported `eligibleSalesQueryKeys` helper — the selector is not
 *     edited). Fires the Spanish "Parada movida" toast.
 *   - Errors are NOT toasted here: the dialog surfaces an inline, meaningful
 *     reason (422 flat reason / 403) and stays actionable via
 *     `resolveTransferErrorMessage`. The caller keeps the dialog open.
 *   - NO optimistic writes, NO setQueryData.
 *
 * Pure helpers + the destination-list query are exported so the co-located spec
 * can drive them without Pinia / QueryClient / toast runtime.
 */

import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { deliveryRouteQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { DELIVERY_ROUTE_COPY } from '../copy'
import { deliveryRoutesApi } from '../api/delivery-routes.api'
import { eligibleSalesQueryKeys } from './useEligibleSales'
import type { DeliveryRouteErrorSurface } from '../interfaces/errors'
import type {
  DeliveryRouteResponseDto,
  TransferDeliveryRouteStopResponseDto,
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
 * TransferMutationDeps — side-effect collaborators for the pure success handler.
 */
export interface TransferMutationDeps extends DeliveryRouteErrorSurface {
  /** Invalidate one per-tenant route detail slot (called for BOTH routes). */
  invalidateDetail: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the per-tenant list prefix (refreshes the draft destination list). */
  invalidateList: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the confirmed-sales prefix so availability refreshes. */
  invalidateConfirmedSales: (args: { queryKey: readonly unknown[] }) => void
  /** Invalidate the eligible-sales prefix so any open selector refreshes. */
  invalidateEligibleSales: (args: { queryKey: readonly unknown[] }) => void
}

/**
 * PURE success handler — invalidates BOTH detail keys + list prefix +
 * confirmed-sales prefix + eligible-sales prefix, then fires the toast.
 */
export function handleTransferSuccess(
  tenantId: string,
  ids: { originRouteId: string; destinationRouteId: string },
  deps: TransferMutationDeps,
): void {
  // Both affected routes: origin loses the stop, destination gains it.
  deps.invalidateDetail({ queryKey: deliveryRouteQueryKeys.detail(tenantId, ids.originRouteId) })
  deps.invalidateDetail({
    queryKey: deliveryRouteQueryKeys.detail(tenantId, ids.destinationRouteId),
  })
  deps.invalidateList({ queryKey: deliveryRouteQueryKeys.listPrefix(tenantId) })
  deps.invalidateConfirmedSales({ queryKey: saleQueryKeys.confirmedPrefix(tenantId) })
  deps.invalidateEligibleSales({ queryKey: eligibleSalesQueryKeys.listPrefix(tenantId) })
  deps.addToast({ title: DELIVERY_ROUTE_COPY.toasts.transferSuccess, color: 'success' })
}

/** Status pinned for the destination picker — only DRAFT routes can receive. */
export const TRANSFER_DESTINATIONS_STATUS = 'DRAFT' as const

/**
 * transferDestinationsQueryKey — the DRAFT list slot keyed off the shared
 * delivery-routes list prefix. Prefix invalidation after a successful transfer
 * (via `listPrefix`) refreshes it atomically.
 */
export function transferDestinationsQueryKey(tenantId: string) {
  return deliveryRouteQueryKeys.list(tenantId, { status: TRANSFER_DESTINATIONS_STATUS })
}

/**
 * PURE: exclude the origin route from the destination options. Source and
 * destination must differ (also enforced server-side as SAME_ROUTE_TRANSFER).
 */
export function filterTransferDestinations(
  routes: readonly DeliveryRouteResponseDto[],
  originRouteId: string,
): DeliveryRouteResponseDto[] {
  return routes.filter((route) => route.id !== originRouteId)
}

/** Pure fetch seam — the only network call for the destination list. */
export async function fetchDraftTransferDestinations(): Promise<DeliveryRouteResponseDto[]> {
  return deliveryRoutesApi.list(TRANSFER_DESTINATIONS_STATUS)
}

/** Optional `enabled` gate so the list only fetches while the dialog is open. */
export interface UseDraftTransferDestinationsConfig {
  enabled?: MaybeRefOrGetter<boolean>
}

/**
 * useDraftTransferDestinations — draft-route list for the destination picker.
 *
 * A failed fetch (including 403 because list read does not imply update) is
 * surfaced by the caller via `resolveTransferDestinationsErrorMessage`; the
 * query never throws to the component tree.
 */
export function useDraftTransferDestinations(config?: UseDraftTransferDestinationsConfig) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const enabled = computed(() =>
    config?.enabled !== undefined ? toValue(config.enabled) : true,
  )

  const query = useQuery<DeliveryRouteResponseDto[]>({
    queryKey: computed(() => transferDestinationsQueryKey(tenantId.value)),
    queryFn: fetchDraftTransferDestinations,
    enabled,
    refetchOnWindowFocus: false,
  })

  return {
    data: computed<DeliveryRouteResponseDto[]>(() => query.data.value ?? []),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/** Payload tuple the transfer mutationFn accepts. */
export interface TransferDeliveryRouteStopMutationInput {
  originRouteId: string
  stopId: string
  destinationRouteId: string
}

/**
 * useTransferDeliveryRouteStop — mutation wrapper.
 *
 * Returns `{ mutateAsync, isPending, error }`. The caller owns the inline error
 * surfacing (keep the dialog open + render `resolveTransferErrorMessage`).
 */
export function useTransferDeliveryRouteStop() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<
    TransferDeliveryRouteStopResponseDto,
    AxiosError,
    TransferDeliveryRouteStopMutationInput
  >({
    mutationFn: ({ originRouteId, stopId, destinationRouteId }) =>
      deliveryRoutesApi.transferStop(originRouteId, stopId, { destinationRouteId }),

    onSuccess: (_response, { originRouteId, destinationRouteId }) => {
      handleTransferSuccess(
        tenantId.value,
        { originRouteId, destinationRouteId },
        {
          invalidateDetail: ({ queryKey }) => {
            void queryClient.invalidateQueries({ queryKey })
          },
          invalidateList: ({ queryKey }) => {
            void queryClient.invalidateQueries({ queryKey })
          },
          invalidateConfirmedSales: ({ queryKey }) => {
            void queryClient.invalidateQueries({ queryKey })
          },
          invalidateEligibleSales: ({ queryKey }) => {
            void queryClient.invalidateQueries({ queryKey })
          },
          addToast: (t) => toast.add(t),
        },
      )
    },

    // No onError toast: the transfer dialog renders the meaningful reason inline
    // (422 flat reason / 403) and stays actionable.
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
