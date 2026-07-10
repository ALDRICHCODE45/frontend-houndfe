// promotions-in-sale A.5 — useApplicablePromotions
// Fetches the "Promociones disponibles" list for a given draft.
//
// Why this is ADAPTABLE (per create-adaptable-composable pattern):
// The seller UI passes the active draftId from several places:
//   - the current ref of useSalesDrafts (reactive),
//   - a route param (plain string),
//   - a `() => activeDraft.value?.id` getter.
// All three call sites want the SAME behavior: skip until the id appears,
// query once enabled, react to changes. We accept a MaybeRefOrGetter and
// resolve with `toValue()` inside the reactive effects (queryKey,
// enabled, queryFn) so any input source "just works".
//
// Tenant source: useSafeTenantId — matches useSalesDrafts, useSaleComments,
// useSellerAssignment, etc. (single tenant-resolution contract in this
// module — NEVER reach into useAuthStore directly in composables).
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type { ListApplicablePromotionsResponse } from '../interfaces/sale.types'

export function useApplicablePromotions(draftId: MaybeRefOrGetter<string | undefined>) {
  const tenantId = useSafeTenantId()

  // Build the cache key from the resolved tenant + draftId.
  // Fallback to '' when undefined so the key is still a stable, comparable
  // tuple while the query is disabled (vue-query stores disabled queries too).
  const queryKey = computed(() =>
    saleQueryKeys.applicablePromotions(tenantId.value, toValue(draftId) ?? ''),
  )

  // Only fetch when we actually have a draft.
  const enabled = computed(() => !!toValue(draftId))

  const query = useQuery<ListApplicablePromotionsResponse>({
    queryKey,
    enabled,
    staleTime: 0,
    queryFn: () => {
      // `enabled` is false when this is undefined, so reaching here implies
      // a draftId is present. The guard documents that contract.
      const id = toValue(draftId)
      if (!id) throw new Error('useApplicablePromotions: draftId is required')
      return saleApi.listApplicablePromotions(id)
    },
  })

  return query
}
