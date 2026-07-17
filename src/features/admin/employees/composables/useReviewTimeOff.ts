/**
 * useReviewTimeOff — WU-11 + S5 (hr-validation-notifications)
 *
 * Mutation composable to approve or reject a pending time-off request.
 *
 * Exports:
 *   - useReviewTimeOff(employeeId)         — mutation for POST /:employeeId/time-off/:timeOffId/review
 *   - usePendingApprovals()                — GET /admin/employees-time-off/pending-approvals (tenant-wide)
 *
 * CASL gates:
 *   - Review requires can('update', 'EmployeeTimeOff')
 *   - Pending approvals requires can('read', 'EmployeeTimeOff')
 *
 * Backend constraints (§4.5):
 *   - reviewTimeOff only works on PENDING status — backend throws TIME_OFF_INVALID_TRANSITION otherwise.
 *   - pending-approvals route uses hyphen (employees-time-off) — NOT under employeeId.
 *   - The endpoint returns the tenant-wide PENDING queue (the manager→subordinates
 *     model was removed backend-side); frontend NEVER sends managerId.
 *   - NEVER send tenantId.
 */

import { computed } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeTimeOffQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { employeesApi } from '../api/employees.api'
import { resolveDomainErrorMessage } from './useAusencias'
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
 *
 * On success:
 *   - Invalidates the tenant-wide pending-approvals query so the row
 *     disappears from the "Validaciones pendientes" tray (S5).
 *   - Invalidates the employee's time-off list (current year).
 *   - Invalidates the employee's vacation balance (APPROVED affects
 *     used/remaining).
 *
 * On error:
 *   - Routes the error through `normalizeApiError` (S3) to extract the
 *     backend `code` (e.g. `TIME_OFF_INVALID_TRANSITION`) and message.
 *   - Looks up the voseo message via `resolveDomainErrorMessage` (S5).
 *   - Surfaces a single toast so users see a real reason (not the prior
 *     hardcoded "Solo se pueden revisar solicitudes en estado PENDIENTE.").
 *
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
      // Invalidate the tenant-wide pending-approvals tray so the row
      // disappears immediately after a successful review (S5).
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.pending(tenantId.value),
      })
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

    onError: (err) => {
      // S5: route the error through normalizeApiError (S3) so the user
      // sees a domain-specific voseo message (e.g. 409
      // TIME_OFF_INVALID_TRANSITION), not a hardcoded generic.
      const { code, message } = normalizeApiError(
        err,
        'No se pudo procesar la revisión.',
      )
      const description = resolveDomainErrorMessage(code, message)
      toast.add({
        title: 'No se pudo procesar la revisión',
        description,
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
 * usePendingApprovals — tenant-wide pending approvals queue.
 *
 * Returns every PENDING time-off request in the tenant (the manager→subordinates
 * model was removed backend-side). Anyone with read:EmployeeTimeOff sees the
 * same queue — there is no per-user filtering at the API level.
 *
 * - Ordered by startDate asc (nearest first).
 * - Medical reason stripping applied server-side.
 * - Requires read:EmployeeTimeOff permission.
 * - Cache key is scoped per tenant; the current user is implicit in the JWT.
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
