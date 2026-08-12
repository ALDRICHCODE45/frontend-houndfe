/**
 * useMembershipViewMode — localStorage-persisted table/card view mode toggle.
 *
 * Wraps the generic `useViewMode` composable, binds the
 * admin-tenant-members storage key (`admin-tenant-members-view-mode`)
 * and exposes the `isMembershipViewMode` type guard plus a `displayMode`
 * bridge so callers can pass the result straight into `AppDataTable`'s
 * `displayMode` prop (which expects `'table' | 'cards' | 'auto'` — our
 * internal singular `card` maps to the plural `cards` form the table
 * uses).
 */

import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

export type MembershipViewMode = 'table' | 'card'

export const MEMBERSHIP_VIEW_MODE_STORAGE_KEY = 'admin-tenant-members-view-mode'

const VALID_MODES = ['table', 'card'] as const

/**
 * Type guard so callers can validate untyped input instead of casting blindly.
 */
export function isMembershipViewMode(value: string): value is MembershipViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function useMembershipViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    MEMBERSHIP_VIEW_MODE_STORAGE_KEY,
    VALID_MODES,
    'table',
  )

  /**
   * Bridge to AppDataTable's `displayMode` prop. AppDataTable expects
   * `'table' | 'cards' | 'auto'` — we map our internal singular `card`
   * to the plural `cards` form the table uses.
   */
  const displayMode = computed<'table' | 'cards'>(() =>
    viewMode.value === 'card' ? 'cards' : 'table',
  )

  return {
    viewMode,
    setMode,
    toggleViewMode: toggleMode,
    displayMode,
  }
}