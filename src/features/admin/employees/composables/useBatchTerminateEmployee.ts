/**
 * useBatchTerminateEmployee — WU-12 (employees-batch-operations)
 *
 * TanStack mutation composable for POST /admin/employees/batch-terminate.
 *
 * Body: { ids: string[], reason: string } — the reason is shared across all
 * selected employees (backend is atomic, no per-employee reasons in v1).
 *
 * Response dispatch (mirrors useBatchDeleteEmployee):
 *  - 200 { updated: number }       → success toast + invalidateQueries
 *  - 404 BATCH_DELETE_NOT_FOUND    → warning toast + invalidateQueries
 *  - 403 INSUFFICIENT_PERMISSIONS  → error toast + selection preserved
 *  - default                       → fallback Spanish error toast
 *
 * NOTE on the dispatch: this composable does NOT receive `rowSelection` from
 * the caller — the caller is responsible for clearing selection via
 * useEmployeesList.clearSelection() after a successful batch.
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

interface BatchTerminateVariables {
  ids: string[]
  reason: string
}

type BatchTerminateResponse = { updated: number }
type BatchTerminateErrorData = DomainApiError & { offendingIds?: string[] }

export function useBatchTerminateEmployee() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<
    BatchTerminateResponse,
    AxiosError,
    BatchTerminateVariables
  >({
    mutationFn: ({ ids, reason }: BatchTerminateVariables) =>
      employeesApi.batchTerminate(ids, reason),

    onSuccess: (result) => {
      toast.add({
        title: `${result.updated} empleados dados de baja`,
        color: 'success',
      })
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.paginated(tenantId.value),
      })
    },

    onError: (error: AxiosError) => {
      const errData = error.response?.data as BatchTerminateErrorData | undefined
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
          const normalized = normalizeApiError(error, 'No se pudieron dar de baja los empleados.')
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
