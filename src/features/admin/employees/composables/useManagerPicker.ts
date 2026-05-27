/**
 * useManagerPicker — WU-04B
 *
 * Composable for the manager picker UI (used by ManagerPicker.vue).
 *
 * Rules:
 * - NEVER send tenantId in query params (backend reads from JWT)
 * - Uses GET /admin/employees?status=active&pageSize=100&search=... (listForPicker)
 * - staleTime: 60_000 — manager data is stable within a session
 * - Query enabled only when search.length ≥ 1 OR picker is open
 * - Debounced search input: 300ms (avoids hammering the API per keystroke)
 * - excludeId: when provided (edit mode), the employee with that id is excluded
 *   from results (self-exclusion: a manager cannot report to themselves)
 *
 * Pure helpers (exported for direct unit testing — no mocks needed):
 * - filterExcludedId(employees, excludeId) — removes self from results
 * - buildPickerOptions(employees)          — maps Employee[] to ManagerPickerOption[]
 *
 * Backend note:
 *   GET /admin/employees?status=active&pageSize=100&search=...
 *   Backend caps pageSize at 100. We always request 100 active employees.
 *   The `search` param is optional; omit it to return the first 100 active employees.
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { employeesApi } from '../api/employees.api'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { Employee } from '../interfaces/employee.types'

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Flattened option shape for the manager picker dropdown.
 * Includes the three visible pieces of information per option:
 * name, position, and department.
 */
export interface ManagerPickerOption {
  /** Employee UUID — used as the v-model value */
  id: string
  /** Full name — primary display label */
  label: string
  /** Current position — shown as secondary line */
  position: string
  /** Current department — shown as tertiary line */
  department: string
}

// ─── Pure helpers (exported for unit testing) ─────────────────────────────────

/**
 * Exclude a specific employee from the list by id.
 *
 * Used in edit mode so an employee cannot select themselves as their manager.
 * Returns the original array unchanged if excludeId is null/undefined.
 *
 * Pure — no side effects.
 */
export function filterExcludedId(
  employees: Employee[],
  excludeId: string | null | undefined,
): Employee[] {
  if (!excludeId) return employees
  return employees.filter((e) => e.id !== excludeId)
}

/**
 * Map an array of Employee objects to ManagerPickerOption shape.
 *
 * Provides null-safe fallbacks for position/department so the UI always
 * gets a renderable string.
 *
 * Pure — no side effects.
 */
export function buildPickerOptions(employees: Employee[]): ManagerPickerOption[] {
  return employees.map((emp) => ({
    id: emp.id,
    label: emp.fullName,
    position: emp.currentPosition ?? '—',
    department: emp.currentDepartment ?? '—',
  }))
}

// ─── Composable ───────────────────────────────────────────────────────────────

export interface UseManagerPickerOptions {
  /** When provided, this employee is excluded from results (edit mode self-exclusion) */
  excludeId?: string | null
}

/**
 * useManagerPicker — async manager search composable.
 *
 * @returns search (ref), isOpen (ref), managers (ManagerPickerOption[]), isLoading
 */
export function useManagerPicker(options: UseManagerPickerOptions = {}) {
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId)

  /** The raw search string typed by the user */
  const search = ref('')

  /** Whether the picker dropdown is currently open */
  const isOpen = ref(false)

  /** Debounced search term — updated 300ms after the user stops typing */
  const debouncedSearch = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(search, (value) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedSearch.value = value
    }, 300)
  })

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  /**
   * Query is enabled when:
   *  - The picker is open (show first 100 active employees without a search term), OR
   *  - The user has typed at least 1 character (search-driven)
   */
  const isEnabled = computed(() => isOpen.value || debouncedSearch.value.length >= 1)

  const { data: rawData, isLoading } = useQuery({
    queryKey: computed(() =>
      employeeQueryKeys.activeForPicker(tenantId.value, debouncedSearch.value),
    ),
    queryFn: () => employeesApi.listForPicker(debouncedSearch.value),
    staleTime: 60_000,
    enabled: isEnabled,
  })

  /** Manager options with exclusion applied and mapped to picker shape */
  const managers = computed<ManagerPickerOption[]>(() => {
    const raw = rawData.value ?? []
    const filtered = filterExcludedId(raw, options.excludeId)
    return buildPickerOptions(filtered)
  })

  return {
    /** Bind to the search input */
    search,
    /** Control picker open state — drives the enabled gate */
    isOpen,
    /** Ready-to-render option items */
    managers,
    /** True while the query is in-flight */
    isLoading,
  }
}
