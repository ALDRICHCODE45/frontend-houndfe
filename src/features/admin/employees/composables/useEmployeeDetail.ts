/**
 * useEmployeeDetail — WU-06A
 *
 * Composable + pure helpers for the Employee Detail View.
 *
 * Design decisions (from WU-06A spec):
 * - Uses TanStack useQuery with employeeQueryKeys.detail for caching.
 * - Employee id comes from Vue Router param (:id).
 * - Tab state is driven by ?tab= query param for deep linking.
 * - Tab bar shows all 8 tabs; only Resumen/Personal/Laboral have real content.
 * - Others show "Próximamente" placeholder in this slice.
 * - Salary display guarded by hasSalary() — never shows undefined as "0".
 *
 * Pure helpers (exported for unit testing — ZERO mocks needed):
 * - computeTabFromQuery(query)   — maps ?tab= string → valid tab key (default: 'resumen')
 * - resolveDetailTab(tabKey)     — validates tab key, returns default on invalid input
 * - buildProfileInitials(name)   — first 2 words, first char each, uppercase
 * - formatCurrencyMXN(cents, c)  — formats cents → locale currency string
 * - EMPLOYEE_DETAIL_TABS          — ordered tab definitions (all 8 tabs)
 */

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { employeesApi } from '../api/employees.api'
import type { Employee } from '../interfaces/employee.types'

// ─── Tab definitions ──────────────────────────────────────────────────────────

export interface EmployeeDetailTab {
  key: EmployeeDetailTabKey
  label: string
  /** If false, this tab shows "Próximamente" placeholder in WU-06A */
  implemented: boolean
}

export type EmployeeDetailTabKey =
  | 'resumen'
  | 'personal'
  | 'laboral'
  | 'compensacion'
  | 'organigrama'
  | 'documentos'
  | 'ausencias'
  | 'cv'

export const EMPLOYEE_DETAIL_TABS: EmployeeDetailTab[] = [
  { key: 'resumen', label: 'Resumen', implemented: true },
  { key: 'personal', label: 'Personal', implemented: true },
  { key: 'laboral', label: 'Laboral', implemented: true },
  { key: 'compensacion', label: 'Compensación', implemented: false },
  { key: 'organigrama', label: 'Organigrama', implemented: false },
  { key: 'documentos', label: 'Documentos', implemented: false },
  { key: 'ausencias', label: 'Ausencias', implemented: false },
  { key: 'cv', label: 'CV', implemented: false },
]

const VALID_TAB_KEYS = new Set<string>(EMPLOYEE_DETAIL_TABS.map((t) => t.key))

const DEFAULT_TAB: EmployeeDetailTabKey = 'resumen'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/**
 * Map the raw ?tab= query param string to a valid EmployeeDetailTabKey.
 * Returns DEFAULT_TAB when the value is absent, empty, or not a valid key.
 *
 * PURE — deterministic, no side effects.
 */
export function computeTabFromQuery(
  query: string | string[] | undefined | null,
): EmployeeDetailTabKey {
  const raw = Array.isArray(query) ? query[0] : query
  if (!raw || !VALID_TAB_KEYS.has(raw)) return DEFAULT_TAB
  return raw as EmployeeDetailTabKey
}

/**
 * Validate a tab key value from any source.
 * Returns DEFAULT_TAB when input is null, undefined, or invalid.
 *
 * PURE — deterministic, no side effects.
 */
export function resolveDetailTab(
  tabKey: string | null | undefined,
): EmployeeDetailTabKey {
  if (!tabKey || !VALID_TAB_KEYS.has(tabKey)) return DEFAULT_TAB
  return tabKey as EmployeeDetailTabKey
}

/**
 * Build avatar initials from a full name.
 * Rule: first two whitespace-separated words, first character each, uppercase.
 * Falls back to 'C' (Colaborador) for empty names.
 *
 * PURE — deterministic, no side effects.
 */
export function buildProfileInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'C'
  return parts
    .slice(0, 2)
    .map((p) => (p[0] ?? '').toUpperCase())
    .join('')
}

// Currency formatter — Intl.NumberFormat is expensive to construct, create once
const CURRENCY_FORMATTERS = new Map<string, Intl.NumberFormat>()

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  if (!CURRENCY_FORMATTERS.has(currency)) {
    CURRENCY_FORMATTERS.set(
      currency,
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    )
  }
  return CURRENCY_FORMATTERS.get(currency)!
}

/**
 * Format a salary amount in cents to a locale currency string.
 *
 * Examples:
 *   formatCurrencyMXN(4_500_000, 'MXN') → '$45,000.00'
 *   formatCurrencyMXN(100, 'MXN')       → '$1.00'
 *
 * PURE — deterministic for a given locale.
 */
export function formatCurrencyMXN(amountCents: number, currency: string): string {
  const amount = amountCents / 100
  try {
    return getCurrencyFormatter(currency).format(amount)
  } catch {
    // Fallback if currency code is invalid
    return `${currency} ${(amount).toFixed(2)}`
  }
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * useEmployeeDetail — reactive composable for the Employee Detail View.
 *
 * Reads :id from route params and ?tab= from route query.
 * Fires GET /admin/employees/:id — requires read:Employee.
 * Salary stripping is handled server-side; use hasSalary() before rendering.
 */
export function useEmployeeDetail() {
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()

  const tenantId = computed(() => authStore.currentTenantId)
  const employeeId = computed(() => route.params.id as string)

  // ── Query ─────────────────────────────────────────────────────────────────
  const isReady = computed(() => !!tenantId.value && !!employeeId.value)

  const queryKey = computed(() =>
    employeeQueryKeys.detail(tenantId.value, employeeId.value),
  )

  const {
    data: employee,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Employee>({
    queryKey,
    queryFn: () => employeesApi.getById(employeeId.value),
    enabled: isReady,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  // ── Tab state — driven by ?tab= query param ────────────────────────────────
  const activeTab = computed<EmployeeDetailTabKey>(() =>
    computeTabFromQuery(route.query.tab as string | undefined),
  )

  function setTab(tab: EmployeeDetailTabKey): void {
    void router.replace({
      query: { ...route.query, tab },
    })
  }

  // ── CASL guards ────────────────────────────────────────────────────────────
  const canUpdate = computed(() => authStore.userCan('update', 'Employee'))
  const canReadSalary = computed(() => authStore.userCan('read', 'EmployeeSalary'))

  // ── Derived display data ───────────────────────────────────────────────────
  const initials = computed(() =>
    employee.value ? buildProfileInitials(employee.value.fullName) : 'C',
  )

  return {
    // Query state
    employee,
    isLoading,
    isError,
    error,
    refetch,
    // Tab state
    activeTab,
    setTab,
    tabs: EMPLOYEE_DETAIL_TABS,
    // CASL guards
    canUpdate,
    canReadSalary,
    // Display helpers
    initials,
    employeeId,
  }
}
