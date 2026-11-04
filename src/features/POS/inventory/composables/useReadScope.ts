import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { InventoryContext } from './useInventoryAccess'

export type InventoryReadContext = Pick<InventoryContext, 'userId' | 'tenantId' | 'ready' | 'canRead'>

// A restored grant or a different branch must never reuse a response that was
// read in a retired access window, so the generation is part of every query key.
export function useReadScope(context: MaybeRefOrGetter<InventoryReadContext>) {
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
