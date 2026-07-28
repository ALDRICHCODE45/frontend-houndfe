/**
 * useBatchDeleteEmployee — WU-12 (employees-batch-operations)
 *
 * TanStack mutation composable for POST /admin/employees/batch-delete.
 *
 * Response dispatch (mirrors SDD-11 promotions-batch-end):
 *  - 200 { deleted: number }       → success toast + invalidateQueries + clearSelection
 *  - 404 BATCH_DELETE_NOT_FOUND    → warning toast + invalidateQueries + clearSelection
 *                                     (rows already gone; cache must refresh)
 *  - 403 INSUFFICIENT_PERMISSIONS  → error toast + selection preserved
 *                                     (user can fix by re-selecting after perm refresh)
 *  - default                       → fallback Spanish error toast via normalizeApiError
 *
 * NOTE on the dispatch: this composable does NOT receive `rowSelection` from
 * the caller — the caller is responsible for clearing selection via
 * useEmployeesList.clearSelection() after a successful batch. (For the
 * EmployeesListView wiring, the view calls clearSelection() inside the
 * success/error branches of the bulk-action onClick closures — keeping the
 * composable decoupled from the list composable.)
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

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

type BatchDeleteResponse = { deleted: number }
type BatchDeleteErrorData = DomainApiError & { offendingIds?: string[] }

export function useBatchDeleteEmployee() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<BatchDeleteResponse, AxiosError, string[]>({
    mutationFn: (ids: string[]) => employeesApi.batchDelete(ids),

    onSuccess: (result) => {
      toast.add({
        title: `${result.deleted} empleados eliminados`,
        color: 'success',
      })
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.paginated(tenantId.value),
      })
    },

    onError: (error: AxiosError) => {
      const errData = error.response?.data as BatchDeleteErrorData | undefined
      const code = errData?.error

      switch (code) {
        case 'BATCH_DELETE_NOT_FOUND': {
          // Backend naming quirk: this literal is reused across all 3 batch
          // endpoints (delete/terminate/reactivate) — see PromotionsView.vue:339
          // for the same convention in promotions-batch-end.
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
          // Selection preserved — caller does NOT clear on 403.
          break
        }
        default: {
          const normalized = normalizeApiError(error, 'No se pudieron eliminar los empleados.')
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

// Type-only re-export for callers — avoids importing Employee in every file
// that only uses the API result type.
export type { Employee }
