import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

/**
 * useDeliveryRouteRole — Manager/driver discriminator (sdd delivery-routes, design.md §6.4, §9.3).
 *
 *   - Manager ⇔ `create:DeliveryRoute` OR `delete:DeliveryRoute` present.
 *   - Driver  ⇔ read-only / read+update on DeliveryRoute AND not manager.
 *   - No new query: `permissionCodes` are already loaded by the global
 *     `beforeEach` guard via `authStore.fetchPermissions()` before any
 *     guarded route renders. We only project over the already-loaded state.
 *
 *   `canCreate` / `canDelete` / `canUpdate` are exposed because §9.3 wants them
 *   as per-action gating booleans for the row-action helper. `canUpdate` does
 *   NOT promote to manager — `update` gates edit / start / cancel / append /
 *   reorder on the manager branch AND check-in on the driver branch; the
 *   manager/driver split is exclusively create-or-delete vs read-only.
 */
export function useDeliveryRouteRole() {
  const authStore = useAuthStore()

  const canCreate = computed(() => authStore.userCan('create', 'DeliveryRoute'))
  const canDelete = computed(() => authStore.userCan('delete', 'DeliveryRoute'))
  const canUpdate = computed(() => authStore.userCan('update', 'DeliveryRoute'))
  const canRead = computed(() => authStore.userCan('read', 'DeliveryRoute'))

  const isManager = computed(() => canCreate.value || canDelete.value)
  const isDriver = computed(() => !isManager.value && canRead.value)

  return {
    isManager,
    isDriver,
    canCreate,
    canDelete,
    canUpdate,
    canRead,
  }
}
