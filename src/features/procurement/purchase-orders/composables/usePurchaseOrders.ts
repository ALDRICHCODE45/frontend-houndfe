import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { purchaseOrdersApi } from '../api/purchase-orders.api'
import type { PurchaseOrderListInput } from '../interfaces/purchase-order.types'

export interface PurchaseOrderReadContext {
  userId: string
  tenantId: string
  ready: boolean
  canRead: boolean
}
function useReadAccess(context: MaybeRefOrGetter<PurchaseOrderReadContext>) {
  // A restored grant must never reuse a response from a retired access window.
  const accessGeneration = shallowRef(0)
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canRead]
  }, () => { accessGeneration.value++ }, { flush: 'sync' })
  const enabled = computed(() => {
    const scope = toValue(context)
    return scope.ready && scope.canRead && Boolean(scope.userId && scope.tenantId)
  })
  return { accessGeneration, enabled }
}
export function usePurchaseOrders(context: MaybeRefOrGetter<PurchaseOrderReadContext>) {
  const { accessGeneration, enabled } = useReadAccess(context)
  const search = shallowRef('')
  const supplierId = shallowRef<string | undefined>(undefined)
  const cursor = shallowRef<string | undefined>(undefined)
  const previous = shallowRef<Array<string | undefined>>([])
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canRead, supplierId.value, search.value]
  }, () => { cursor.value = undefined; previous.value = [] }, { flush: 'sync' })
  const input = computed<PurchaseOrderListInput>(() => ({ supplierId: supplierId.value, search: search.value.trim() || undefined, cursor: cursor.value, limit: 25 }))
  const queryKey = computed(() => ['procurement-purchase-orders', toValue(context).userId, toValue(context).tenantId, accessGeneration.value, input.value])
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal, queryKey: requestedKey }) => ({
      key: JSON.stringify(requestedKey), data: await purchaseOrdersApi.list({ ...input.value }, signal),
    }),
    retry: false,
    placeholderData: undefined,
  })
  // Vue Query updates its observer on the next tick. Fence even synchronous reads
  // in the tick where identity or filters change, not only late HTTP responses.
  const page = computed(() => enabled.value && query.data.value?.key === JSON.stringify(queryKey.value) ? query.data.value.data : undefined)
  const items = computed(() => page.value?.items ?? [])
  const hasNext = computed(() => Boolean(page.value?.nextCursor))
  const hasPrevious = computed(() => enabled.value && previous.value.length > 0)
  function next() {
    if (!hasNext.value || query.isFetching.value) return
    previous.value = [...previous.value, cursor.value]
    cursor.value = page.value?.nextCursor ?? undefined
  }
  function back() {
    if (!hasPrevious.value || query.isFetching.value) return
    cursor.value = previous.value[previous.value.length - 1]
    previous.value = previous.value.slice(0, -1)
  }
  async function refresh() {
    if (!enabled.value) return
    return query.refetch()
  }
  return { search, supplierId, items, hasNext, hasPrevious, next, back, refresh,
    isLoading: query.isLoading, isFetching: query.isFetching,
    error: computed(() => enabled.value ? query.error.value : null) }
}

export function usePurchaseOrder(id: MaybeRefOrGetter<string | null | undefined>, context: MaybeRefOrGetter<PurchaseOrderReadContext>) {
  const access = useReadAccess(context)
  const enabled = computed(() => access.enabled.value && Boolean(toValue(id)))
  const queryKey = computed(() => ['procurement-purchase-order', toValue(context).userId, toValue(context).tenantId, access.accessGeneration.value, toValue(id)])
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal, queryKey: requestedKey }) => ({
      key: JSON.stringify(requestedKey), data: await purchaseOrdersApi.get(toValue(id)!, signal),
    }),
    retry: false,
    placeholderData: undefined,
  })
  async function refresh() {
    if (!enabled.value) return
    return query.refetch()
  }
  return { order: computed(() => enabled.value && query.data.value?.key === JSON.stringify(queryKey.value) ? query.data.value.data : null), refresh,
    isLoading: query.isLoading, isFetching: query.isFetching,
    error: computed(() => enabled.value ? query.error.value : null) }
}
