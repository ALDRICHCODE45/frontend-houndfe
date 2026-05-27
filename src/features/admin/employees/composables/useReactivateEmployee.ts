/**
 * useReactivateEmployee — WU-05A
 *
 * TanStack mutation composable for POST /admin/employees/:id/reactivate.
 *
 * Rules:
 * - No request body (backend ignores body; we send empty object)
 * - NEVER send tenantId (backend reads from JWT)
 * - On success: invalidate employeeQueryKeys.paginated AND employeeQueryKeys.detail
 * - On error: extract domain error code and map to Spanish toast via EMPLOYEE_ERROR_MAP
 * - Returns mutateAsync, isPending, error for caller use
 *
 * Domain errors handled:
 * - EMPLOYEE_NOT_FOUND (404)
 * - EMPLOYEE_NOT_TERMINATED (409): employee is not in TERMINATED status
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { computed } from 'vue'
import { employeesApi } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'
import { EMPLOYEE_ERROR_MAP } from '../interfaces/errors'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { extractDomainErrorCode } from './useCreateEmployee'

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.stubGlobal('useToast', () => ({ add: mockFn })).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

// ─── Mutation payload type ────────────────────────────────────────────────────

/** The employee id is the only required variable for reactivation */
type ReactivateEmployeeVariables = string

// ─── Composable ───────────────────────────────────────────────────────────────

export function useReactivateEmployee() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<Employee, AxiosError, ReactivateEmployeeVariables>({
    mutationFn: (id: string) => employeesApi.reactivate(id),

    onSuccess: (_data, id) => {
      // Invalidate the paginated list so the employee status change is reflected
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.paginated(tenantId.value),
      })

      // Invalidate the specific employee detail
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.detail(tenantId.value, id),
      })

      toast.add({ title: 'Colaborador reactivado exitosamente', color: 'success' })
    },

    onError: (error: AxiosError) => {
      const code = extractDomainErrorCode(error)

      if (code && code in EMPLOYEE_ERROR_MAP) {
        toast.add({ title: EMPLOYEE_ERROR_MAP[code], color: 'error' })
        return
      }

      const axiosErr = error as AxiosError<{ message?: string }>
      toast.add({
        title: 'No se pudo reactivar al colaborador',
        description: axiosErr.response?.data?.message ?? 'Reintentá en unos segundos.',
        color: 'error',
      })
    },
  })

  return {
    /** Call to trigger reactivation with the employee id. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
