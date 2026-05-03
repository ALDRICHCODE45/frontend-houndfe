import { computed } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'

export function useSafeTenantId() {
  return computed(() => {
    try {
      return useAuthStore().currentTenantId
    } catch {
      return ''
    }
  })
}
