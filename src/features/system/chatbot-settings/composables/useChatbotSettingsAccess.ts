import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'

/**
 * Cache scope and gates of the screen (the branch comes from the JWT, nothing is sent): `read` opens
 * it, `update` unlocks editing, `update:ChatbotSettingsAllBranches` shows «Aplicar a todas».
 */
export function useChatbotSettingsAccess() {
  const auth = useAuthStore()
  const tenantId = useSafeTenantId()
  const canRead = computed(() => auth.userCan('read', 'ChatbotSettings'))
  const canUpdate = computed(() => canRead.value && auth.userCan('update', 'ChatbotSettings'))
  const canApplyAll = computed(() => auth.userCan('update', 'ChatbotSettingsAllBranches'))
  const enabled = computed(() => tenantId.value.length > 0 && canRead.value)
  return { tenantId, canRead, canUpdate, canApplyAll, enabled }
}
