import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useConfirmedSales } from '@/features/POS/sales/composables/useConfirmedSales'

/**
 * useEligibleSales — Thin wrapper over `useConfirmedSales` (sdd delivery-routes, design.md §6.2).
 *
 * Forces `deliveryStatus: ['PENDING', 'SHIPPED']` into the query so the
 * manager's create-route picker only surfaces confirmed sales that belong to
 * an active or pending delivery pipeline. REQ-SALES-DR-001 regression pin:
 * adding 'SHIPPED' here relies on the S1a addition to `SALE_DELIVERY_STATUS`
 * — removing it would silently hide every in-transit sale from the picker.
 *
 * Accepts an optional reactive bag of additional filters (search, customerId,
 * etc.) so the slideover can pre-filter by customer without forking the
 * confirmed-sales composition. The wrapper merges caller filters with the
 * pinned deliveryStatus; conflicts favour the caller's value (mirrors the
 * "slideover wins" UX intent documented in `useConfirmedSales`).
 *
 * Note: Status itself is a server-side re-validation (the backend rejects
 * non-eligible sales with `DELIVERY_ROUTE_STOP_SALE_NOT_ELIGIBLE` (422) —
 * surfaced inline on the picker per design.md §7.2).
 *
 * Uses Vue's `MaybeRefOrGetter` adaptive contract (skills/create-adaptable-composable)
 * so callers can pass a plain object, a `Ref<Record<string, unknown>>`, or a getter
 * without breaking reactivity. Inside, we normalize via `toValue()` and wrap in
 * a `computed` so the inner `useConfirmedSales` receives a stable `Ref`.
 */
export function useEligibleSales(
  additionalFilters?: MaybeRefOrGetter<Record<string, unknown>>,
) {
  const filters = computed<Record<string, unknown>>(() => {
    const base = additionalFilters ? toValue(additionalFilters) : {}
    return {
      ...base,
      deliveryStatus: ['PENDING', 'SHIPPED'],
    }
  })

  return useConfirmedSales(filters)
}
