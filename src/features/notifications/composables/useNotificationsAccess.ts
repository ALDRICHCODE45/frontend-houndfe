import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'

/**
 * Cache scope and gate of every notifications read: the tenant in the keys (the branch comes from
 * the JWT, nothing is sent) and an authenticated session. There is no CASL permission: each person
 * only ever sees their own notices.
 */
export function useNotificationsAccess() {
  const tenantId = useSafeTenantId()
  const isAuthenticated = computed(() => {
    try {
      return useAuthStore().isAuthenticated
    } catch {
      return false
    }
  })
  const enabled = computed(() => tenantId.value.length > 0 && isAuthenticated.value)
  return { tenantId, isAuthenticated, enabled }
}
