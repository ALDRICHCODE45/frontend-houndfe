import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { humanDecisionQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { humanDecisionApi } from '../api/human-decision.api'
import type {
  HumanDecisionErrorResponse,
  ResolvedHumanDecision,
} from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionAttempt } from '../utils/humanDecisionResolutionAttempt'

function requiresConflictRefresh(error: AxiosError<HumanDecisionErrorResponse>): boolean {
  const response = error.response
  return (
    response?.status === 409 &&
    (response.data.code === 'VERSION_CONFLICT' || response.data.code === 'ALREADY_RESOLVED')
  )
}

export function useResolveHumanDecision() {
  const queryClient = useQueryClient()
  const tenantId = useAuthStore().currentTenantId

  const mutation = useMutation<
    ResolvedHumanDecision,
    AxiosError<HumanDecisionErrorResponse>,
    HumanDecisionResolutionAttempt
  >({
    mutationFn: ({ decisionId, payload }) => humanDecisionApi.resolve(decisionId, payload),
    onSuccess: async (response, attempt) => {
      const detailKey = humanDecisionQueryKeys.detail(tenantId, attempt.decisionId)
      queryClient.setQueryData(detailKey, response)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: humanDecisionQueryKeys.listPrefix(tenantId),
        }),
        queryClient.invalidateQueries({ queryKey: detailKey }),
      ])
    },
    onError: async (error, attempt) => {
      if (!requiresConflictRefresh(error)) return
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: humanDecisionQueryKeys.listPrefix(tenantId),
        }),
        queryClient.refetchQueries({
          queryKey: humanDecisionQueryKeys.detail(tenantId, attempt.decisionId),
        }),
      ])
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}
