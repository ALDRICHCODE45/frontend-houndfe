/**
 * useAusencias — WU-10 + S5 (hr-validation-notifications)
 *
 * Pure helpers + composables for the Ausencias (time-off) tab and the
 * tenant-wide "Validaciones pendientes" tray.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - formatTimeOffType(type)                    — TimeOffType enum → Spanish label
 *   - formatTimeOffStatus(status)                — TimeOffStatus enum → Spanish label
 *   - computeTimeOffDays(start, end)             — inclusive UTC day count (same as computeDays in types)
 *   - resolveSickReason(type, reason)            — Tier 3 medical guard: null+SICK → "Motivo médico reservado" (S5)
 *   - canCancelTimeOff(status, start)            — PENDING always; APPROVED only if start is future
 *   - filterPendingBySearch(requests, map, q)    — pure client-side search by resolved employee name (S5)
 *   - resolveDomainErrorMessage(code, fallback?) — pure EMPLOYEE_ERROR_MAP lookup → voseo message (S5)
 *   - computeTrayRows(requests, map, q)          — runtime mirror of PendingApprovalsView's filteredRequests computed (S5)
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
import { EMPLOYEE_ERROR_MAP } from '../interfaces/errors'
import type { EmployeeDomainErrorCode } from '../interfaces/errors'
import type { ManagerInfo } from './useManagerResolution'

/** Default fallback used when a code is not in {@link EMPLOYEE_ERROR_MAP}.
 *  Kept in lockstep with `DEFAULT_FALLBACK` in `core/shared/utils/error.utils.ts`. */
const DEFAULT_ERROR_FALLBACK = 'No pudimos completar la operación. Reintentá.'

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
 *   - type === 'SICK' && reason === null → "Motivo médico reservado"
 *     (null means backend stripped it — caller lacks read:EmployeeTimeOffMedical)
 *   - type !== 'SICK' && (reason === null || reason === '') → "—"
 *   - reason has a non-empty value → return reason as-is
 *
 * S5 (hr-validation-notifications): the SICK+null placeholder changed from
 * "Confidencial" to "Motivo médico reservado" — the prior copy was ambiguous
 * and read as confidential-by-policy rather than confidential-by-permission.
 *
 * PURE — deterministic.
 */
export function resolveSickReason(type: TimeOffType, reason: string | null): string {
  // null = backend-stripped (Tier 3 medical guard) → voseo placeholder for SICK only
  // '' (empty string) = user provided no reason → "—" regardless of type
  if (reason === null) {
    return type === 'SICK' ? 'Motivo médico reservado' : '—'
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

/**
 * Pure client-side filter for the tenant-wide pending approvals tray.
 *
 * Filters the given list of PENDING `TimeOffRequest`s by employee name.
 * The lookup uses a pre-built `id→ManagerInfo` map (produced by
 * `buildManagerMap` in {@link useManagerResolution}); an unknown
 * `employeeId` is treated as "—" and therefore does NOT match any
 * non-empty query.
 *
 * Rules:
 *   - Empty / whitespace-only query → returns the input array unchanged
 *     (preserves backend ordering: startDate asc, then id asc).
 *   - Otherwise → case-insensitive substring match against the resolved
 *     `fullName`. Missing names resolve to "—" and never match.
 *
 * PURE — no side effects, no I/O.
 */
export function filterPendingBySearch(
  requests: TimeOffRequest[],
  nameMap: Map<string, ManagerInfo>,
  query: string,
): TimeOffRequest[] {
  const normalized = query.trim().toLowerCase()
  if (normalized === '') return requests

  return requests.filter((req) => {
    const name = nameMap.get(req.employeeId)?.fullName ?? '—'
    return name.toLowerCase().includes(normalized)
  })
}

/**
 * Pure lookup of a domain error code against {@link EMPLOYEE_ERROR_MAP}.
 *
 * Returns the voseo message for known codes. For unknown / empty codes,
 * returns the explicit `fallback` (when provided and non-blank) or the
 * module default (`DEFAULT_ERROR_FALLBACK`).
 *
 * The map is authoritative — an explicit fallback is ONLY used on a
 * miss. Pair with {@link normalizeApiError} (core/shared/utils/error.utils.ts)
 * to extract `code` from a 409 / 400 backend envelope, then pass the code
 * here to surface a user-visible Spanish message.
 *
 * PURE — deterministic.
 */
export function resolveDomainErrorMessage(
  code: string | null | undefined,
  fallback?: string,
): string {
  if (typeof code === 'string' && code.length > 0) {
    // Narrow the index lookup to known codes — TS will type-check the union.
    if (code in EMPLOYEE_ERROR_MAP) {
      const known = code as EmployeeDomainErrorCode
      return EMPLOYEE_ERROR_MAP[known]
    }
  }
  if (typeof fallback === 'string' && fallback.trim().length > 0) {
    return fallback
  }
  return DEFAULT_ERROR_FALLBACK
}

/**
 * Runtime computed-logic mirror of `PendingApprovalsView.vue`'s
 * `filteredRequests` computed.
 *
 * Used by the runtime computed-logic test pattern (see strict-tdd.md):
 * the SAME pure pipeline that the view wires into a Vue `computed`
 * is exported here so tests can exercise it without mounting the
 * component or mocking the TanStack query.
 *
 * Equivalent to:
 *   `filterPendingBySearch(requests, nameMap, query.trim())`
 *
 * PURE — deterministic.
 */
export function computeTrayRows(
  requests: TimeOffRequest[],
  nameMap: Map<string, ManagerInfo>,
  query: string,
): TimeOffRequest[] {
  return filterPendingBySearch(requests, nameMap, query.trim())
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
