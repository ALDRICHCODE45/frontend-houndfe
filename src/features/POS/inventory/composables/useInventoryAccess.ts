import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

export interface InventoryContext {
  userId: string
  tenantId: string
  ready: boolean
  canRead: boolean
  canAdjust: boolean
}

// Identity scope that fences reads and commands: a different user, branch or
// grant retires whatever was in flight (the same shape procurement uses).
export function useInventoryContext() {
  const auth = useAuthStore()
  return computed<InventoryContext>(() => {
    const ready = auth.authPhase === 'authenticated' && auth.permissionsLoaded
    const canRead = ready && auth.userCan('read', 'InventoryJournal')
    return {
      userId: auth.user?.id ?? '', tenantId: auth.currentTenantId, ready, canRead,
      // The adjustment response carries the stock snapshot, so it needs read too.
      canAdjust: canRead && auth.userCan('create', 'InventoryAdjustment'),
    }
  })
}

export function useInventoryAccess() {
  const context = useInventoryContext()
  return {
    canRead: computed(() => context.value.canRead),
    canAdjust: computed(() => context.value.canAdjust),
  }
}
