import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useInfiniteQuery, useQueryClient } from '@tanstack/vue-query'
import { inventoryApi } from '../api/inventory.api'
import type { MovementPage, MovementsQuery, StockMovement } from '../interfaces/inventory.types'
import { useReadScope, type InventoryReadContext } from './useReadScope'

export type MovementsFilter = Pick<MovementsQuery, 'productId' | 'variantId' | 'lotId'>
const PAGE_SIZE = 25

// Kardex pages are cursor based and newest first; "Cargar más" appends the next
// page after the rows already shown.
export function useStockMovements(
  filter: MaybeRefOrGetter<MovementsFilter | null | undefined>,
  context: MaybeRefOrGetter<InventoryReadContext>,
) {
  const client = useQueryClient()
  const { accessGeneration, enabled: allowed } = useReadScope(context)
  const enabled = computed(() => allowed.value && Boolean(toValue(filter)?.productId))
  const queryKey = computed(() => {
    const { productId, variantId, lotId } = toValue(filter) ?? {}
    return ['inventory-movements', toValue(context).userId, toValue(context).tenantId, accessGeneration.value,
      productId, variantId, lotId]
  })
  const query = useInfiniteQuery({
    queryKey,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam, queryKey: requestedKey }) => {
      const { productId, variantId, lotId } = toValue(filter)!
      const page: MovementPage = await inventoryApi.listMovements(
        { productId, ...(variantId && { variantId }), ...(lotId && { lotId }), cursor: pageParam, limit: PAGE_SIZE }, signal)
      return { key: JSON.stringify(requestedKey), page }
    },
    getNextPageParam: last => last.page.nextCursor ?? undefined,
    retry: false,
    placeholderData: undefined,
  })
  const pages = computed(() => {
    const key = JSON.stringify(queryKey.value)
    return enabled.value ? (query.data.value?.pages ?? []).filter(entry => entry.key === key) : []
  })
  const items = computed<StockMovement[]>(() => pages.value.flatMap(entry => entry.page.items))
  const hasMore = computed(() => enabled.value && pages.value.length > 0 && Boolean(query.hasNextPage.value))
  const loadMoreError = computed(() => enabled.value && query.isFetchNextPageError.value)

  async function loadMore() {
    if (!hasMore.value || query.isFetchingNextPage.value) return
    await query.fetchNextPage()
  }
  // Back to the first page, so rows written meanwhile show on top.
  async function refresh() {
    if (!enabled.value) return
    await client.resetQueries({ queryKey: queryKey.value, exact: true })
  }
  return {
    items, hasMore, loadMore, refresh, loadMoreError,
    isLoading: query.isLoading, isFetching: query.isFetching, isFetchingMore: query.isFetchingNextPage,
    error: computed(() => enabled.value && !query.isFetchNextPageError.value ? query.error.value : null),
  }
}
