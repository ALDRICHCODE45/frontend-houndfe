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

export function useHumanDecisionDetail(decisionId: Ref<string | null>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const id = computed(() => toValue(decisionId))

  return useQuery<HumanDecision>({
    queryKey: computed(() => humanDecisionQueryKeys.detail(tenantId.value, id.value ?? '')),
    queryFn: () => humanDecisionApi.getById(id.value as string),
    enabled: computed(() => Boolean(tenantId.value && id.value)),
    refetchOnWindowFocus: false,
    staleTime: 30_000,
  })
}
