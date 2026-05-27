/**
 * useCreateEmployee — WU-04A
 *
 * TanStack mutation composable for POST /admin/employees.
 *
 * Rules:
 * - NEVER send tenantId (backend reads from JWT)
 * - On success: invalidate employeeQueryKeys.paginated to refresh the list
 * - On error: extract domain error code from error.response.data.error and
 *   map to Spanish toast message via EMPLOYEE_ERROR_MAP
 * - Returns mutateAsync, isPending, error for caller use
 */

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { employeesApi } from '../api/employees.api'
import type { CreateEmployeeDto } from '../interfaces/employee.types'
import type { Employee } from '../interfaces/employee.types'
import { EMPLOYEE_ERROR_MAP, type EmployeeDomainErrorCode } from '../interfaces/errors'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { computed } from 'vue'

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.stubGlobal('useToast', () => ({ add: mockFn })).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

// ─── Pure helper (exported for direct unit testing — no mocks needed) ─────────

interface MaybeAxiosError {
  response?: {
    data?: {
      error?: unknown
    }
  }
}

/**
 * Pure function: extract the domain error code from any error shape.
 *
 * Backend domain errors have shape: { statusCode, message, error: "DOMAIN_CODE" }
 * Returns the code string if present, null otherwise.
 */
export function extractDomainErrorCode(error: unknown): EmployeeDomainErrorCode | null {
  const maybeAxios = error as MaybeAxiosError
  const code = maybeAxios?.response?.data?.error
  if (typeof code === 'string' && code in EMPLOYEE_ERROR_MAP) {
    return code as EmployeeDomainErrorCode
  }
  return null
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<Employee, AxiosError, CreateEmployeeDto>({
    mutationFn: (dto: CreateEmployeeDto) => employeesApi.create(dto),

    onSuccess: () => {
      // Invalidate the paginated list so the new employee appears
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.paginated(tenantId.value),
      })

      toast.add({ title: 'Colaborador creado exitosamente', color: 'success' })
    },

    onError: (error: AxiosError) => {
      const code = extractDomainErrorCode(error)

      if (code && code in EMPLOYEE_ERROR_MAP) {
        toast.add({ title: EMPLOYEE_ERROR_MAP[code], color: 'error' })
        return
      }

      const axiosErr = error as AxiosError<{ message?: string }>
      toast.add({
        title: 'No se pudo crear el colaborador',
        description: axiosErr.response?.data?.message ?? 'Reintentá en unos segundos.',
        color: 'error',
      })
    },
  })

  return {
    /** Call to trigger the creation. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}
