/**
 * HD2B — lazy RESTOCK human-decision detail. Disabled until an id is set, so a
 * list page never fetches a detail; tenant-scoped key; resolves through
 * `humanDecisionApi.getById`. No resolve mutation or UI lives here (HD4).
 */

import { computed, toValue, type Ref } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../api/human-decision.api'
import type { HumanDecision } from '../interfaces/human-decision.types'

/** Read the validated detail identity from the captured key — never a live ref. */
function readDetailContext(queryKey: readonly unknown[]): { tenantId: string; id: string } {
  const [, tenantId, slot, id] = queryKey
  if (slot !== 'detail' || typeof tenantId !== 'string' || tenantId.length === 0) {
    throw new Error('Invalid human decision detail query context')
  }
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Invalid human decision detail query context')
  }
  return { tenantId, id }
}

export function useHumanDecisionDetail(decisionId: Ref<string | null>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const id = computed(() => toValue(decisionId))

  return useQuery<HumanDecision>({
    queryKey: computed(() => humanDecisionQueryKeys.detail(tenantId.value, id.value ?? '')),
    queryFn: ({ queryKey, signal }) => {
      // `enabled` guards automatic reads only: manual refetch still runs this,
      // so the captured identity and the active tenant are validated before dispatch.
      const captured = readDetailContext(queryKey)
      if (captured.tenantId !== tenantId.value) {
        throw new Error('Human decision detail tenant is no longer active')
      }
      return humanDecisionApi.getById(captured.id, { signal })
    },
    enabled: computed(() => Boolean(tenantId.value && id.value)),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })
}
