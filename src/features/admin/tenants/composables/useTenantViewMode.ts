/**
 * useTenantViewMode — localStorage-persisted table/card view mode toggle.
 *
 * Wraps the generic `useViewMode` composable, binds the admin-tenants
 * storage key (`admin-tenants-view-mode`) and exposes the
 * `isTenantViewMode` type guard plus a `displayMode` bridge so callers
 * can pass the result straight into `AppDataTable`'s `displayMode` prop
 * (which expects `'table' | 'cards' | 'auto'` — our internal singular
 * `card` maps to the plural `cards` form the table uses).
 */

import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

export type TenantViewMode = 'table' | 'card'

export const TENANT_VIEW_MODE_STORAGE_KEY = 'admin-tenants-view-mode'

const VALID_MODES = ['table', 'card'] as const

/**
 * Type guard so callers can validate untyped input instead of casting blindly.
 */
export function isTenantViewMode(value: string): value is TenantViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function useTenantViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    TENANT_VIEW_MODE_STORAGE_KEY,
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