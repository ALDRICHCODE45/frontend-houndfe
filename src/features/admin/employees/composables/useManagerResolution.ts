/**
 * useManagerResolution — WU-03
 *
 * Manager name resolution without N+1 requests.
 *
 * Strategy (from design.md "Manager picker" + WU-03 goal):
 *   The list API returns only `managerId` (UUID) — not the manager's fullName.
 *   To avoid one request per row (N+1), we:
 *     1. Collect unique managerIds from the current page's employees.
 *     2. Use TanStack useQueries to batch-fetch each unique manager in PARALLEL.
 *        - Bounded: at most pageSize unique managers per page (typically <<10).
 *        - Cached: staleTime 60s — manager data is stable within a session.
 *        - Falls back to "—" for any manager not yet resolved or fetch failure.
 *
 * Pure helpers (exported for testing):
 * - buildManagerMap(employees) — builds id→name Map from a resolved employee array
 * - resolveManagerName(managerId, map) — looks up name, returns "—" on miss
 *
 * Backend note: no batch endpoint exists in v1. The `/admin/employees/:id` approach
 * is used with useQueries parallelism. If a future `/admin/employees?ids=` endpoint
 * is added, this composable can be updated transparently.
 */

import { computed } from 'vue'
import { useQueries } from '@tanstack/vue-query'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { employeesApi } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

export interface ManagerInfo {
  fullName: string
  email: string | null
  currentPosition: string | null
  currentDepartment: string | null
}

/**
 * Build a Map<id, ManagerInfo> from an array of resolved Employee objects.
 *
 * Pure — no side effects.
 */
export function buildManagerMap(managers: Employee[]): Map<string, ManagerInfo> {
  const map = new Map<string, ManagerInfo>()
  for (const manager of managers) {
    map.set(manager.id, {
      fullName: manager.fullName,
      email: manager.email,
      currentPosition: manager.currentPosition,
      currentDepartment: manager.currentDepartment,
    })
  }
  return map
}

/**
 * Resolve a manager's display name from the map.
 *
 * Returns "—" for:
 * - null managerId (employee has no manager)
 * - undefined managerId
 * - managerId not yet in the map (fetch pending or failed)
 *
 * Pure — no side effects.
 */
export function resolveManagerName(
  managerId: string | null | undefined,
  managerMap: Map<string, ManagerInfo>,
): string {
  if (!managerId) return '—'
  return managerMap.get(managerId)?.fullName ?? '—'
}

export function resolveManagerEmail(
  managerId: string | null | undefined,
  managerMap: Map<string, ManagerInfo>,
): string | null {
  if (!managerId) return null
  return managerMap.get(managerId)?.email ?? null
}

// ─── Reactive composable ──────────────────────────────────────────────────────

export interface UseManagerResolutionOptions {
  /** The tenant id for cache scoping */
  tenantId: string
}

/**
 * useManagerResolution — batch-resolves manager names for a list of employees.
 *
 * @param employees — reactive list of employees to resolve managers for
 * @param tenantId — tenant id string (for cache key scoping)
 */
export function useManagerResolution(
  employees: () => Employee[],
  tenantId: () => string,
) {
  // Collect unique, non-null managerIds from the current page
  const uniqueManagerIds = computed<string[]>(() => {
    const ids = new Set<string>()
    for (const emp of employees()) {
      if (emp.managerId) ids.add(emp.managerId)
    }
    return Array.from(ids)
  })

  // Parallel queries — one per unique manager (bounded, cached)
  // useQueries creates queries dynamically based on the ids array
  const managerQueries = useQueries({
    queries: computed(() =>
      uniqueManagerIds.value.map((id) => ({
        queryKey: employeeQueryKeys.detail(tenantId(), id),
        queryFn: () => employeesApi.getById(id),
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Soft failure — if a manager fetch fails, show "—" (not a crash)
        retry: 1,
      })),
    ),
  })

  // Build the id→info map from all successfully resolved managers
  const managerMap = computed<Map<string, ManagerInfo>>(() => {
    const map = new Map<string, ManagerInfo>()
    for (const query of managerQueries.value) {
      if (query.data) {
        map.set(query.data.id, {
          fullName: query.data.fullName,
          email: query.data.email,
          currentPosition: query.data.currentPosition,
          currentDepartment: query.data.currentDepartment,
        })
      }
    }
    return map
  })

  // True when all manager queries have settled (success or error)
  const isResolvingManagers = computed(() =>
    managerQueries.value.some((q) => q.isLoading),
  )

  return {
    managerMap,
    isResolvingManagers,
    /** Convenience: resolve a single managerId against the current map */
    resolveManagerName: (managerId: string | null | undefined) =>
      resolveManagerName(managerId, managerMap.value),
  }
}
