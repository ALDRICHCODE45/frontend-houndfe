/**
 * useBatchReactivateEmployee — WU-12 (employees-batch-operations)
 *
 * TanStack mutation composable for POST /admin/employees/batch-reactivate.
 *
 * Body: { ids: string[] } — no body other than ids.
 *
 * Response dispatch (mirrors useBatchDeleteEmployee / useBatchTerminateEmployee):
 *  - 200 { updated: number }       → success toast + invalidateQueries
 *  - 404 BATCH_DELETE_NOT_FOUND    → warning toast + invalidateQueries
 *  - 403 INSUFFICIENT_PERMISSIONS  → error toast + selection preserved
 *  - default                       → fallback Spanish error toast
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { computed } from 'vue'
import { employeesApi } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'
import { EMPLOYEE_ERROR_MAP } from '../interfaces/errors'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { normalizeApiError, type DomainApiError } from '@/core/shared/utils/error.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

type BatchReactivateResponse = { updated: number }
type BatchReactivateErrorData = DomainApiError & { offendingIds?: string[] }

export function useBatchReactivateEmployee() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<BatchReactivateResponse, AxiosError, string[]>({
    mutationFn: (ids: string[]) => employeesApi.batchReactivate(ids),

    onSuccess: (result) => {
      toast.add({
        title: `${result.updated} empleados reactivados`,
        color: 'success',
      })
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.paginated(tenantId.value),
      })
    },

    onError: (error: AxiosError) => {
      const errData = error.response?.data as BatchReactivateErrorData | undefined
      const code = errData?.error

      switch (code) {
        case 'BATCH_DELETE_NOT_FOUND': {
          toast.add({
            title: EMPLOYEE_ERROR_MAP['BATCH_DELETE_NOT_FOUND'],
            color: 'warning',
          })
          void queryClient.invalidateQueries({
            queryKey: employeeQueryKeys.paginated(tenantId.value),
          })
          break
        }
        case 'INSUFFICIENT_PERMISSIONS': {
          toast.add({
            title: EMPLOYEE_ERROR_MAP['INSUFFICIENT_PERMISSIONS'],
            color: 'error',
          })
          break
        }
        default: {
          const normalized = normalizeApiError(error, 'No se pudieron reactivar los empleados.')
          toast.add({
            title: 'Error',
            description: normalized.message,
            color: 'error',
          })
        }
      }
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

export type { Employee }
