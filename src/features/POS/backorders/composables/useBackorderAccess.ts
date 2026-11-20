import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'

/**
 * Cache scope and gates of «Pedidos por reposición» (S2): the tenant in the keys (the branch comes
 * from the token, nothing is sent), `read:Backorder` for every read and `update:Backorder` for the
 * cancel.
 */
export function useBackorderAccess() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  const canRead = computed(() => auth.userCan('read', 'Backorder'))
  const canUpdate = computed(() => auth.userCan('update', 'Backorder'))
  const enabled = computed(() => tenantId.value.length > 0 && canRead.value)
  return { tenantId, canRead, canUpdate, enabled }
}
