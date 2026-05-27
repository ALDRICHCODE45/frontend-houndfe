/**
 * useReviewTimeOff — WU-11
 *
 * Mutation composable to approve or reject a pending time-off request.
 *
 * Exports:
 *   - useReviewTimeOff(employeeId)  — mutation for POST /:employeeId/time-off/:timeOffId/review
 *   - usePendingApprovals(managerId) — query for GET /admin/employees-time-off/pending-approvals
 *
 * CASL gates:
 *   - Review requires can('update', 'EmployeeTimeOff')
 *   - Pending approvals requires can('read', 'EmployeeTimeOff')
 *
 * Backend constraints (§4.5):
 *   - reviewTimeOff only works on PENDING status — backend throws TIME_OFF_INVALID_TRANSITION otherwise.
 *   - pending-approvals route: /admin/employees-time-off/pending-approvals (hyphen, NOT under employeeId).
 *   - NEVER send tenantId.
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
 * usePendingApprovals — query for pending approvals as seen by a manager.
 *
 * Returns all PENDING time-off requests for direct subordinates of managerId.
 * Ordered by startDate asc (nearest first).
 * Medical reason stripping applied server-side.
 * Requires read:EmployeeTimeOff permission.
 *
 * Uses employeeTimeOffQueryKeys.pending(tenantId, managerId) for cache key.
 */
export function usePendingApprovals(managerId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeTimeOffQueryKeys.pending(tenantId.value, toValue(managerId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(managerId))

  return useQuery<TimeOffRequest[]>({
    queryKey,
    queryFn: () => employeesApi.getPendingApprovals(toValue(managerId)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: true, // approvals are time-sensitive — refetch on focus
  })
}
