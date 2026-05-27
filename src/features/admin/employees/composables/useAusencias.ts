/**
 * useAusencias — WU-10
 *
 * Pure helpers + composables for the Ausencias (time-off) tab.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - formatTimeOffType(type)           — TimeOffType enum → Spanish label
 *   - formatTimeOffStatus(status)       — TimeOffStatus enum → Spanish label
 *   - computeTimeOffDays(start, end)    — inclusive UTC day count (same as computeDays in types)
 *   - resolveSickReason(type, reason)   — Tier 3 medical guard: null+SICK → "Confidencial"
 *   - canCancelTimeOff(status, start)   — PENDING always; APPROVED only if start is future
 *
 *   Composables (require Vue + TanStack Query context):
 *   - useEmployeeTimeOff(employeeId)    — query for time-off list (with optional year/status)
 *   - useVacationBalance(employeeId)    — query for vacation balance
 *   - useCreateTimeOff()               — mutation to request time off
 *   - useCancelTimeOff()               — mutation to cancel a time-off request
 *
 * CASL gates:
 *   - Read list/balance requires can('read', 'EmployeeTimeOff')
 *   - Request requires can('create', 'EmployeeTimeOff')
 *   - Cancel requires can('update', 'EmployeeTimeOff')
 *   - Seeing SICK reason requires can('read', 'EmployeeTimeOffMedical')
 *     (enforced server-side — null reason = stripped)
 *
 * Backend constraints (§4.5):
 *   - POST /admin/employees/:id/time-off → 201. endDate >= startDate.
 *   - POST /admin/employees/:id/time-off/:id/cancel → 200. PENDING or future APPROVED only.
 *   - GET /admin/employees/:id/time-off/vacation-balance → { year, entitlement, used, pending, remaining }
 *   - TimeOffType: VACATION, SICK, PERSONAL, UNPAID.
 *   - Error codes: TIME_OFF_INVALID_DATE_RANGE, TIME_OFF_INVALID_TRANSITION.
 *   - NEVER send tenantId.
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeTimeOffQueryKeys, employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
import {
  TIME_OFF_TYPE_LABELS,
  TIME_OFF_STATUS_LABELS,
} from '../interfaces/employee.types'
import type {
  TimeOffType,
  TimeOffStatus,
  TimeOffRequest,
  VacationBalance,
  CreateTimeOffDto,
} from '../interfaces/employee.types'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Map a TimeOffType enum value to its Spanish display label.
 *
 * PURE — deterministic.
 */
export function formatTimeOffType(type: TimeOffType): string {
  return TIME_OFF_TYPE_LABELS[type] ?? type
}

/**
 * Map a TimeOffStatus enum value to its Spanish display label.
 *
 * PURE — deterministic.
 */
export function formatTimeOffStatus(status: TimeOffStatus): string {
  return TIME_OFF_STATUS_LABELS[status] ?? status
}

/**
 * Compute the inclusive UTC day count between two ISO date strings (YYYY-MM-DD).
 *
 * Formula: (endDate - startDate) / 86_400_000 + 1
 * UTC-safe — no timezone offset interference.
 * Same formula as backend desviación #5.
 *
 * PURE — deterministic.
 */
export function computeTimeOffDays(startDate: string, endDate: string): number {
  const MS_PER_DAY = 86_400_000
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  return (end - start) / MS_PER_DAY + 1
}

/**
 * Resolve the display value for a time-off reason, applying the Tier 3 medical guard.
 *
 * Rules:
 *   - type === 'SICK' && (reason === null || reason === '') → "Confidencial"
 *     (null means backend stripped it — caller lacks read:EmployeeTimeOffMedical)
 *   - type !== 'SICK' && (reason === null || reason === '') → "—"
 *   - reason has a non-empty value → return reason as-is
 *
 * PURE — deterministic.
 */
export function resolveSickReason(type: TimeOffType, reason: string | null): string {
  // null = backend-stripped (Tier 3 medical guard) → "Confidencial" for SICK only
  // '' (empty string) = user provided no reason → "—" regardless of type
  if (reason === null) {
    return type === 'SICK' ? 'Confidencial' : '—'
  }
  if (reason.trim() === '') {
    return '—'
  }
  return reason
}

/**
 * Determine if a time-off request can be cancelled by the current user.
 *
 * Business rules (§4.5 backend spec):
 *   - PENDING → always cancellable
 *   - APPROVED → only if startDate is strictly in the future (> today UTC)
 *   - REJECTED or CANCELLED → never cancellable
 *
 * Uses UTC date comparison to avoid timezone drift.
 *
 * PURE — deterministic for a given wall-clock instant.
 */
export function canCancelTimeOff(status: TimeOffStatus, startDate: string): boolean {
  if (status === 'PENDING') return true
  if (status !== 'APPROVED') return false

  // APPROVED: only if startDate is strictly in the future
  const MS_PER_DAY = 86_400_000
  const now = Date.now()
  const todayStart = now - (now % MS_PER_DAY) // midnight UTC today
  const startMs = new Date(startDate).getTime()
  return startMs > todayStart
}

// ─── Composables ──────────────────────────────────────────────────────────────

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * useEmployeeTimeOff — query composable for the time-off list.
 *
 * Requires read:EmployeeTimeOff permission.
 * Optional year and status filters for the list view.
 * SICK reason is server-stripped to null if caller lacks read:EmployeeTimeOffMedical.
 */
export function useEmployeeTimeOff(
  employeeId: MaybeRef<string>,
  year?: MaybeRef<number>,
  status?: MaybeRef<string | undefined>,
) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const currentYear = new Date().getFullYear()

  const queryKey = computed(() =>
    employeeTimeOffQueryKeys.list(
      tenantId.value,
      toValue(employeeId),
      toValue(year) ?? currentYear,
      toValue(status) ?? undefined,
    ),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery({
    queryKey,
    queryFn: () =>
      employeesApi.getTimeOff(toValue(employeeId), {
        year: toValue(year) ?? currentYear,
        status: toValue(status) ?? undefined,
        pageSize: 50,
      }),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useVacationBalance — query composable for the vacation balance card.
 *
 * Requires read:EmployeeTimeOff permission.
 * Returns { year, entitlement, used, pending, remaining }.
 */
export function useVacationBalance(
  employeeId: MaybeRef<string>,
  year?: MaybeRef<number>,
) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const currentYear = new Date().getFullYear()

  const queryKey = computed(() =>
    employeeTimeOffQueryKeys.balance(
      tenantId.value,
      toValue(employeeId),
      toValue(year) ?? currentYear,
    ),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery({
    queryKey,
    queryFn: () =>
      employeesApi.getVacationBalance(toValue(employeeId), toValue(year) ?? currentYear),
    enabled: isReady,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useCreateTimeOff — mutation composable to request a new time-off.
 *
 * Requires create:EmployeeTimeOff permission. Returns 201 with created record.
 * On success: invalidates time-off list + vacation balance keys for the employee.
 */
export function useCreateTimeOff(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const currentYear = new Date().getFullYear()

  const mutation = useMutation<TimeOffRequest, Error, CreateTimeOffDto>({
    mutationFn: (dto: CreateTimeOffDto) =>
      employeesApi.createTimeOff(toValue(employeeId), dto),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.list(
          tenantId.value,
          toValue(employeeId),
          currentYear,
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.balance(
          tenantId.value,
          toValue(employeeId),
          currentYear,
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.detail(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Ausencia solicitada', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo registrar la ausencia',
        description: 'Verificá que las fechas sean válidas (fecha fin ≥ fecha inicio) e intentá de nuevo.',
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
 * useCancelTimeOff — mutation composable to cancel a pending or future-approved time-off.
 *
 * Requires update:EmployeeTimeOff permission.
 * On success: invalidates time-off list + vacation balance keys.
 * Backend error TIME_OFF_INVALID_TRANSITION if the row is not cancellable.
 */
export function useCancelTimeOff(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const currentYear = new Date().getFullYear()

  const mutation = useMutation<void, Error, string>({
    mutationFn: (timeOffId: string) =>
      employeesApi.cancelTimeOff(toValue(employeeId), timeOffId),

    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.list(
          tenantId.value,
          toValue(employeeId),
          currentYear,
        ),
      })
      void queryClient.invalidateQueries({
        queryKey: employeeTimeOffQueryKeys.balance(
          tenantId.value,
          toValue(employeeId),
          currentYear,
        ),
      })
      toast.add({ title: 'Ausencia cancelada', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo cancelar la ausencia',
        description: 'Solo se pueden cancelar solicitudes pendientes o aprobadas con fecha futura.',
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
