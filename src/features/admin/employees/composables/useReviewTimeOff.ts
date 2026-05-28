/**
 * useReviewTimeOff — WU-11
 *
 * Mutation composable to approve or reject a pending time-off request.
 *
 * Exports:
 *   - useReviewTimeOff(employeeId)         — mutation for POST /:employeeId/time-off/:timeOffId/review
 *   - usePendingApprovals()                — GET /admin/employees-time-off/pending-approvals (current user)
 *   - usePendingApprovalsByManager(id)     — GET /admin/employees-time-off/pending-approvals/by-manager/:id (admin/HR)
 *
 * CASL gates:
 *   - Review requires can('update', 'EmployeeTimeOff')
 *   - Pending approvals requires can('read', 'EmployeeTimeOff')
 *
 * Backend constraints (§4.5):
 *   - reviewTimeOff only works on PENDING status — backend throws TIME_OFF_INVALID_TRANSITION otherwise.
 *   - pending-approvals route uses hyphen (employees-time-off) — NOT under employeeId.
 *   - The personal endpoint resolves the manager Employee from the JWT via
 *     Employee.userId; frontend NEVER sends managerId for that variant.
 *   - NEVER send tenantId on either endpoint.
 */

import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeTimeOffQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
import type { TimeOffRequest, ReviewTimeOffDto } from '../interfaces/employee.types'

// ─── Composables ──────────────────────────────────────────────────────────────

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * useReviewTimeOff — mutation to approve or reject a time-off request.
 *
 * mutateAsync arg: { timeOffId, dto: ReviewTimeOffDto }
 * On success: invalidates time-off list for the employee (all years/statuses).
 * Also invalidates pending-approvals in case the current user is a manager.
 * Requires update:EmployeeTimeOff permission.
 */
export function useReviewTimeOff(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const currentYear = new Date().getFullYear()

  const mutation = useMutation<
    TimeOffRequest,
    Error,
    { timeOffId: string; dto: ReviewTimeOffDto }
  >({
    mutationFn: ({ timeOffId, dto }) =>
      employeesApi.reviewTimeOff(toValue(employeeId), timeOffId, dto),

    onSuccess: (result) => {
      // Invalidate employee's time-off list (current year)
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.list(
          tenantId.value,
          toValue(employeeId),
          currentYear,
        ),
      })
      // Invalidate vacation balance (APPROVED affects used/remaining)
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.balance(
          tenantId.value,
          toValue(employeeId),
          currentYear,
        ),
      })

      const decisionLabel = result.status === 'APPROVED' ? 'aprobada' : 'rechazada'
      toast.add({ title: `Ausencia ${decisionLabel}`, color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo procesar la revisión',
        description: 'Solo se pueden revisar solicitudes en estado PENDIENTE.',
        color: 'error',
      })
    },
  })

  return {
    mutateAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
  }
}

/**
 * usePendingApprovals — pending approvals for the current logged-in user.
 *
 * Backend resolves the manager Employee from the JWT (via Employee.userId)
 * and returns PENDING requests for the direct subordinates of that Employee.
 * If the user has no linked Employee, the backend returns [].
 *
 * - Ordered by startDate asc (nearest first).
 * - Medical reason stripping applied server-side.
 * - Requires read:EmployeeTimeOff permission.
 * - Cache key is scoped per tenant (the user is implicit in the JWT).
 */
export function usePendingApprovals() {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() => employeeTimeOffQueryKeys.pending(tenantId.value))

  const isReady = computed(() => !!tenantId.value)

  return useQuery<TimeOffRequest[]>({
    queryKey,
    queryFn: () => employeesApi.getPendingApprovals(),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: true, // approvals are time-sensitive — refetch on focus
  })
}

/**
 * usePendingApprovalsByManager — admin/HR view of any manager's pending queue.
 *
 * `managerId` is an Employee.id (NOT a User.id). Backend filters subordinates
 * of that specific Employee. Same response semantics as `usePendingApprovals`.
 *
 * Requires read:EmployeeTimeOff permission. Intended for HR dashboards where
 * an admin wants to see another manager's queue without impersonation.
 */
export function usePendingApprovalsByManager(managerId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeTimeOffQueryKeys.pendingByManager(tenantId.value, toValue(managerId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(managerId))

  return useQuery<TimeOffRequest[]>({
    queryKey,
    queryFn: () => employeesApi.getPendingApprovalsByManager(toValue(managerId)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
