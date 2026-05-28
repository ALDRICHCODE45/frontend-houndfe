/**
 * useCompensacion — WU-07
 *
 * Pure helpers + composables for the Compensación tab.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - formatSalaryCents(cents, currency)      — formats cents to locale currency string
 *   - formatEffectiveDate(isoDate)            — formats YYYY-MM-DD to locale date string
 *   - buildSalaryTimelineEntry(change)        — builds a display-ready salary timeline entry
 *   - buildPositionTimelineEntry(change)      — builds a display-ready position timeline entry
 *
 *   Composables (require Vue + TanStack Query context):
 *   - useEmployeeSalaryHistory(employeeId)    — query for salary history array
 *   - useAddSalaryChange(employeeId)          — mutation to append salary change
 *   - useEmployeePositionHistory(employeeId)  — query for position history array
 *   - useAddPositionChange(employeeId)        — mutation to append position change
 *
 * CASL gates:
 *   - Salary section requires can('read', 'EmployeeSalary')
 *   - Adding salary change requires can('create', 'EmployeeSalary')
 *   - Position change requires can('update', 'Employee')
 */

import { computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeSalaryQueryKeys, employeePositionQueryKeys, employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
import type { SalaryChange, PositionChange, AddSalaryChangeDto, AddPositionChangeDto } from '../interfaces/employee.types'
// Re-use the memoized currency formatter from useEmployeeDetail — avoids
// duplicating the Intl.NumberFormat instance pool (same es-MX locale, same logic).
import { formatCurrencyMXN } from './useEmployeeDetail'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Format a salary amount in cents to a locale currency string.
 * Delegates to the memoized formatCurrencyMXN from useEmployeeDetail.
 *
 * Examples:
 *   formatSalaryCents(4_500_000, 'MXN') → '$45,000.00'
 *   formatSalaryCents(100, 'MXN')       → '$1.00'
 *
 * PURE — deterministic for a given locale.
 */
export function formatSalaryCents(amountCents: number, currency: string): string {
  return formatCurrencyMXN(amountCents, currency)
}

// Date formatter (memoized)
const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
})

/**
 * Format a date string (YYYY-MM-DD or full ISO with time) to a locale date.
 * Uses UTC timezone to avoid off-by-one day due to timezone shifts.
 *
 * Accepts both:
 *   '2026-06-01'                  → '1 de junio de 2026'
 *   '2026-06-01T00:00:00.000Z'    → '1 de junio de 2026'
 *
 * PURE — deterministic for a given locale.
 */
export function formatEffectiveDate(isoDate: string): string {
  // If the string already contains a time component, parse as-is.
  // Otherwise append a UTC midnight suffix so 'YYYY-MM-DD' renders correctly.
  const normalized = isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return isoDate
  return DATE_FORMATTER.format(date)
}

// ─── Display entry types ──────────────────────────────────────────────────────

export interface SalaryTimelineEntry {
  id: string
  amountFormatted: string
  currency: string
  dateFormatted: string
  reason: string | null
}

export interface PositionTimelineEntry {
  id: string
  position: string
  department: string | null
  dateFormatted: string
  reason: string | null
}

/**
 * Build a display-ready salary timeline entry from a raw SalaryChange.
 * Extracts pure data transformation — no component coupling.
 *
 * PURE — deterministic.
 */
export function buildSalaryTimelineEntry(change: SalaryChange): SalaryTimelineEntry {
  return {
    id: change.id,
    amountFormatted: formatSalaryCents(change.amountCents, change.currency),
    currency: change.currency,
    dateFormatted: formatEffectiveDate(change.effectiveFrom),
    reason: change.reason,
  }
}

/**
 * Build a display-ready position timeline entry from a raw PositionChange.
 * Extracts pure data transformation — no component coupling.
 *
 * PURE — deterministic.
 */
export function buildPositionTimelineEntry(change: PositionChange): PositionTimelineEntry {
  return {
    id: change.id,
    position: change.position,
    department: change.department,
    dateFormatted: formatEffectiveDate(change.effectiveFrom),
    reason: change.reason,
  }
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
 * useEmployeeSalaryHistory — query composable for salary history.
 *
 * Requires read:EmployeeSalary permission (enforced by backend; hide section
 * client-side via can('read', 'EmployeeSalary')).
 */
export function useEmployeeSalaryHistory(employeeId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeSalaryQueryKeys.history(tenantId.value, toValue(employeeId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery<SalaryChange[]>({
    queryKey,
    queryFn: () => employeesApi.getSalaryHistory(toValue(employeeId)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useAddSalaryChange — mutation composable to append a salary change.
 *
 * On success: invalidates salary history + employee detail (currentSalaryCents
 * is updated atomically by the backend).
 */
export function useAddSalaryChange(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<SalaryChange, Error, AddSalaryChangeDto>({
    mutationFn: (dto: AddSalaryChangeDto) =>
      employeesApi.addSalaryChange(toValue(employeeId), dto),

    onSuccess: () => {
      // Invalidate salary history list
      void queryClient.invalidateQueries({
        queryKey: employeeSalaryQueryKeys.history(tenantId.value, toValue(employeeId)),
      })
      // Invalidate employee detail (currentSalaryCents updated atomically)
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.detail(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Ajuste de sueldo registrado exitosamente', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo registrar el ajuste de sueldo',
        description: 'Verificá los datos e intentá de nuevo.',
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
 * useEmployeePositionHistory — query composable for position history.
 *
 * Requires read:Employee permission (position history is standard tier).
 */
export function useEmployeePositionHistory(employeeId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeePositionQueryKeys.history(tenantId.value, toValue(employeeId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery<PositionChange[]>({
    queryKey,
    queryFn: () => employeesApi.getPositionHistory(toValue(employeeId)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useAddPositionChange — mutation composable to append a position change.
 *
 * On success: invalidates position history + employee detail (currentPosition
 * and currentDepartment are updated atomically by the backend).
 * Permission: update:Employee (NOT EmployeeSalary).
 */
export function useAddPositionChange(employeeId: MaybeRef<string>) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)
  const toast = useToast()

  const mutation = useMutation<PositionChange, Error, AddPositionChangeDto>({
    mutationFn: (dto: AddPositionChangeDto) =>
      employeesApi.addPositionChange(toValue(employeeId), dto),

    onSuccess: () => {
      // Invalidate position history list
      void queryClient.invalidateQueries({
        queryKey: employeePositionQueryKeys.history(tenantId.value, toValue(employeeId)),
      })
      // Invalidate employee detail (currentPosition + currentDepartment updated atomically)
      void queryClient.invalidateQueries({
        queryKey: employeeQueryKeys.detail(tenantId.value, toValue(employeeId)),
      })
      toast.add({ title: 'Cambio de posición registrado exitosamente', color: 'success' })
    },

    onError: () => {
      toast.add({
        title: 'No se pudo registrar el cambio de posición',
        description: 'Verificá los datos e intentá de nuevo.',
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
