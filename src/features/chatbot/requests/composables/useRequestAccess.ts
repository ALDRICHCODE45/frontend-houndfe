import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'

/**
 * Cache scope and gate of every inbox read: the tenant in the keys (the branch comes from the JWT,
 * nothing is sent) and `read:ChatbotRequest`. Page and section gates only; action buttons follow
 * `allowedActions` / `deniedActions`.
 */
export function useRequestAccess() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  const canRead = computed(() => auth.userCan('read', 'ChatbotRequest'))
  const enabled = computed(() => tenantId.value.length > 0 && canRead.value)
  return { tenantId, canRead, enabled }
}
