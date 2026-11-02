import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { suppliersApi } from '../api/suppliers.api'
import type { SupplierListInput } from '../interfaces/supplier.types'

export interface SupplierReadContext {
  userId: string
  tenantId: string
  ready: boolean
  canRead: boolean
}
export function useSuppliers(context: MaybeRefOrGetter<SupplierReadContext>) {
  // A restored grant must never reuse a response from a retired access window.
  const accessGeneration = shallowRef(0)
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canRead]
  }, () => { accessGeneration.value++ }, { flush: 'sync' })
  const search = shallowRef('')
  const status = shallowRef<SupplierListInput['status']>('ACTIVE')
  const cursor = shallowRef<string | undefined>(undefined)
  const previous = shallowRef<Array<string | undefined>>([])
  const enabled = computed(() => {
    const scope = toValue(context)
    return scope.ready && scope.canRead && Boolean(scope.userId && scope.tenantId)
  })
  watch(() => {
    const scope = toValue(context)
    return [scope.userId, scope.tenantId, scope.ready, scope.canRead, search.value, status.value]
  }, () => { cursor.value = undefined; previous.value = [] }, { flush: 'sync' })
  const input = computed<SupplierListInput>(() => ({ search: search.value, status: status.value, cursor: cursor.value, limit: 25 }))
  const query = useQuery({
    queryKey: computed(() => ['procurement-suppliers', toValue(context).userId, toValue(context).tenantId, accessGeneration.value, input.value]),
    enabled,
    queryFn: ({ signal }) => suppliersApi.list({ ...input.value }, signal),
    retry: false,
    // Never show another filter/tenant's page while the requested page loads.
    placeholderData: undefined,
  })
  const items = computed(() => enabled.value ? query.data.value?.items ?? [] : [])
  const hasNext = computed(() => enabled.value && Boolean(query.data.value?.nextCursor))
  const hasPrevious = computed(() => enabled.value && previous.value.length > 0)
  function next() {
    if (!hasNext.value || query.isFetching.value) return
    previous.value = [...previous.value, cursor.value]
    cursor.value = query.data.value!.nextCursor!
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
  return { search, status, items, hasNext, hasPrevious, next, back, refresh,
    isLoading: query.isLoading, isFetching: query.isFetching,
    error: computed(() => enabled.value ? query.error.value : null) }
}
