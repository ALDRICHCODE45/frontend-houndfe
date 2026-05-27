/**
 * useOrganigrama — WU-08
 *
 * Pure helpers + composables for the Organigrama tab.
 *
 * Exports:
 *   Pure helpers (exported for direct unit testing — ZERO mocks needed):
 *   - buildManagerChainDisplay(chain)       — maps Employee[] chain → display entries
 *   - buildSubordinateDisplayEntry(emp)     — maps a single Employee → display entry
 *   - isChainTruncated(chain)              — true when chain.length === 50 (backend cap)
 *   - buildCvDownloadUrl(fileId)            — builds '/files/:fileId' download path
 *
 *   Composables (require Vue + TanStack Query context):
 *   - useEmployeeSubordinates(id)           — query for direct subordinates array
 *   - useEmployeeManagerChain(id)           — query for manager-chain array
 *
 * CASL gates:
 *   - Both endpoints require read:Employee (standard tier, no salary exposure)
 *   - Org chart display NEVER shows salary fields
 */

import { computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import type { MaybeRef } from 'vue'
import { toValue } from 'vue'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeesApi } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'

// ─── Display entry types ──────────────────────────────────────────────────────

export interface ManagerChainEntry {
  id: string
  fullName: string
  position: string
  department: string | null
}

export interface SubordinateDisplayEntry {
  id: string
  fullName: string
  position: string
  department: string | null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Backend max depth cap for manager chain (employees.service.ts:212) */
const MANAGER_CHAIN_MAX = 50

/**
 * Map a raw manager chain (Employee[]) to display-ready entries.
 * Chain is ordered from direct manager → top (CEO/root).
 * Position falls back to '—' when null.
 *
 * PURE — deterministic, no side effects.
 */
export function buildManagerChainDisplay(chain: Employee[]): ManagerChainEntry[] {
  return chain.map((emp) => ({
    id: emp.id,
    fullName: emp.fullName,
    position: emp.currentPosition ?? '—',
    department: emp.currentDepartment,
  }))
}

/**
 * Map a single subordinate Employee to a display-ready entry.
 * Position falls back to '—' when null.
 *
 * PURE — deterministic, no side effects.
 */
export function buildSubordinateDisplayEntry(emp: Employee): SubordinateDisplayEntry {
  return {
    id: emp.id,
    fullName: emp.fullName,
    position: emp.currentPosition ?? '—',
    department: emp.currentDepartment,
  }
}

/**
 * Determine whether the manager chain was truncated at the 50-level backend cap.
 * When chain.length === 50, there may be more levels above the last entry.
 *
 * PURE — deterministic, no side effects.
 */
export function isChainTruncated(chain: Employee[]): boolean {
  return chain.length === MANAGER_CHAIN_MAX
}

/**
 * Build the FilesService download URL for a CV file.
 *
 * @param fileId - UUID of the CV file stored in FilesService
 * @returns '/files/:fileId' path — passed to downloadFile() from multipart.ts
 *
 * PURE — deterministic, no side effects.
 */
export function buildCvDownloadUrl(fileId: string): string {
  return `/files/${fileId}`
}

// ─── Composables ──────────────────────────────────────────────────────────────

/**
 * useEmployeeSubordinates — query composable for direct subordinates.
 *
 * Calls GET /admin/employees/:id/subordinates.
 * Requires read:Employee permission (enforced by backend).
 * Returns only direct reports — NOT recursive.
 * Salary fields are stripped server-side.
 */
export function useEmployeeSubordinates(employeeId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeQueryKeys.subordinates(tenantId.value, toValue(employeeId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery<Employee[]>({
    queryKey,
    queryFn: () => employeesApi.getSubordinates(toValue(employeeId)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * useEmployeeManagerChain — query composable for the manager hierarchy.
 *
 * Calls GET /admin/employees/:id/manager-chain.
 * Requires read:Employee permission (enforced by backend).
 * Returns Employee[] from direct manager to root (max 50 levels).
 * Salary fields are stripped server-side.
 */
export function useEmployeeManagerChain(employeeId: MaybeRef<string>) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  const queryKey = computed(() =>
    employeeQueryKeys.managerChain(tenantId.value, toValue(employeeId)),
  )

  const isReady = computed(() => !!tenantId.value && !!toValue(employeeId))

  return useQuery<Employee[]>({
    queryKey,
    queryFn: () => employeesApi.getManagerChain(toValue(employeeId)),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })
}
