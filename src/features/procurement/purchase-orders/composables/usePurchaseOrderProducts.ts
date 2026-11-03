import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { purchaseOrderProductsApi } from '../api/purchase-order-products.api'

export interface OrderProductReadContext {
  userId: string
  tenantId: string
  ready: boolean
  canReadProduct: boolean
}
function useProductAccess(context: MaybeRefOrGetter<OrderProductReadContext>) {
  const accessGeneration = shallowRef(0)
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canReadProduct]
  }, () => { accessGeneration.value++ }, { flush: 'sync' })
  const enabled = computed(() => {
    const scope = toValue(context)
    return scope.ready && scope.canReadProduct && Boolean(scope.userId && scope.tenantId)
  })
  return { accessGeneration, enabled }
}
export function usePurchaseOrderProducts(context: MaybeRefOrGetter<OrderProductReadContext>) {
  const { accessGeneration, enabled } = useProductAccess(context)
  const search = shallowRef('')
  const page = shallowRef(1)
  const limit = 25
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canReadProduct, search.value]
  }, () => { page.value = 1 }, { flush: 'sync' })
  const input = computed(() => ({ search: search.value, page: page.value, limit }))
  const queryKey = computed(() => ['procurement-purchase-order-products', toValue(context).userId, toValue(context).tenantId, accessGeneration.value, input.value])
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal, queryKey: requestedKey }) => ({
      key: JSON.stringify(requestedKey), data: await purchaseOrderProductsApi.list({ ...input.value }, signal),
    }),
    retry: false,
    placeholderData: undefined,
  })
  // Fence the observer's previous value even before Vue Query's next-tick update.
  const items = computed(() => enabled.value && query.data.value?.key === JSON.stringify(queryKey.value) ? query.data.value.data : [])
  const hasNext = computed(() => enabled.value && items.value.length === limit)
  const hasPrevious = computed(() => enabled.value && page.value > 1)
  function next() {
    if (!hasNext.value || query.isFetching.value) return
    page.value++
  }
  function back() {
    if (!hasPrevious.value || query.isFetching.value) return
    page.value--
  }
  async function refresh() {
    if (!enabled.value) return
    return query.refetch()
  }
  return { search, items, hasNext, hasPrevious, next, back, refresh,
    isLoading: query.isLoading, isFetching: query.isFetching,
    error: computed(() => enabled.value ? query.error.value : null) }
}

export function usePurchaseOrderVariants(productId: MaybeRefOrGetter<string | null | undefined>, context: MaybeRefOrGetter<OrderProductReadContext>) {
  const access = useProductAccess(context)
  const enabled = computed(() => access.enabled.value && Boolean(toValue(productId)))
  const queryKey = computed(() => ['procurement-purchase-order-variants', toValue(context).userId, toValue(context).tenantId, access.accessGeneration.value, toValue(productId)])
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal, queryKey: requestedKey }) => ({
      key: JSON.stringify(requestedKey), data: await purchaseOrderProductsApi.variants(toValue(productId)!, signal),
    }),
    retry: false,
    placeholderData: undefined,
  })
  async function refresh() {
    if (!enabled.value) return
    return query.refetch()
  }
  return { items: computed(() => enabled.value && query.data.value?.key === JSON.stringify(queryKey.value) ? query.data.value.data : []), refresh,
    isLoading: query.isLoading, isFetching: query.isFetching,
    error: computed(() => enabled.value ? query.error.value : null) }
}
