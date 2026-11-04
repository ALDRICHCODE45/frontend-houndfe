import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { inventoryApi } from '../api/inventory.api'
import type { StockSnapshot } from '../interfaces/inventory.types'
import { useReadScope, type InventoryReadContext } from './useReadScope'

export function useProductStock(
  productId: MaybeRefOrGetter<string | null | undefined>,
  context: MaybeRefOrGetter<InventoryReadContext>,
) {
  const client = useQueryClient()
  const { accessGeneration, enabled: allowed } = useReadScope(context)
  const enabled = computed(() => allowed.value && Boolean(toValue(productId)))
  const queryKey = computed(() => [
    'inventory-stock', toValue(context).userId, toValue(context).tenantId, accessGeneration.value, toValue(productId),
  ])
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal, queryKey: requestedKey }) => ({
      key: JSON.stringify(requestedKey), data: await inventoryApi.getStock(toValue(productId)!, signal),
    }),
    retry: false,
    placeholderData: undefined,
  })
  // Vue Query updates its observer on the next tick: fence even synchronous reads
  // in the tick where the identity or the product changes, not only late responses.
  const stock = computed<StockSnapshot | null>(() =>
    enabled.value && query.data.value?.key === JSON.stringify(queryKey.value) ? query.data.value.data : null)

  // The adjustment response carries the new snapshot: show it instead of re-reading.
  function apply(snapshot: StockSnapshot) {
    if (!enabled.value || snapshot.product.id !== toValue(productId)) return
    client.setQueryData(queryKey.value, { key: JSON.stringify(queryKey.value), data: snapshot })
  }
  async function refresh() {
    if (!enabled.value) return
    return query.refetch()
  }
  return {
    stock, apply, refresh, isLoading: query.isLoading, isFetching: query.isFetching,
    error: computed(() => enabled.value ? query.error.value : null),
  }
}
