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

/**
 * Prepend a "current manager" option so the picker can always render the
 * pre-selected value as a human label, even before any search results are
 * cached.
 *
 * Rules:
 * - If `current` is null or undefined → returns `options` unchanged.
 * - If an option with the same id already exists → returns `options` unchanged
 *   (avoids duplicates when the manager is also part of the search results).
 * - Otherwise prepends `current` at the top so it stays visible without scroll.
 *
 * Pure — no side effects.
 */
export function mergeCurrentManagerOption(
  options: ManagerPickerOption[],
  current: ManagerPickerOption | null | undefined,
): ManagerPickerOption[] {
  if (!current) return options
  if (options.some((o) => o.id === current.id)) return options
  return [current, ...options]
}

// ─── Composable ───────────────────────────────────────────────────────────────

export interface UseManagerPickerOptions {
  /** When provided, this employee is excluded from results (edit mode self-exclusion) */
  excludeId?: string | null
  /**
   * Reactive getter for the currently-selected manager (edit mode).
   * When provided, the option is always merged at the top of `managers` so the
   * trigger renders the human label instead of a UUID.
   */
  currentManager?: () => ManagerPickerOption | null
}

/**
 * useManagerPicker — preloaded combobox composable.
 *
 * UX contract (search-on-open pattern):
 *  - When the picker opens, fetch the first 100 active employees without
 *    requiring the user to type. Most tenants have <100 collaborators so the
 *    full list is visible immediately.
 *  - When the user types, debounce 300ms and re-fetch filtered results.
 *  - In edit mode, the current manager is always merged at the top of the list
 *    so the trigger and the dropdown stay in sync even before any fetch.
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
   *  - The picker has been opened at least once (show first 100 active
   *    employees without a search term — preloaded combobox UX), OR
   *  - The user has typed at least 1 character (search-driven refinement).
   *
   * We use a sticky flag instead of `isOpen` directly so the query stays
   * cached after the picker closes, and re-opening is instant.
   */
  const hasBeenOpened = ref(false)
  watch(isOpen, (open) => {
    if (open) hasBeenOpened.value = true
  })

  const isEnabled = computed(
    () => hasBeenOpened.value || debouncedSearch.value.length >= 1,
  )

  const { data: rawData, isLoading } = useQuery({
    queryKey: computed(() =>
      employeeQueryKeys.activeForPicker(tenantId.value, debouncedSearch.value),
    ),
    queryFn: () => employeesApi.listForPicker(debouncedSearch.value),
    staleTime: 60_000,
    enabled: isEnabled,
  })

  /**
   * Manager options:
   *  1. start from the fetched results,
   *  2. drop the excluded id (self in edit mode),
   *  3. map to the picker shape,
   *  4. prepend the current manager so the trigger always shows a real label.
   */
  const managers = computed<ManagerPickerOption[]>(() => {
    const raw = rawData.value ?? []
    const filtered = filterExcludedId(raw, options.excludeId)
    const built = buildPickerOptions(filtered)
    return mergeCurrentManagerOption(built, options.currentManager?.() ?? null)
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
