import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

export type RoleViewMode = 'table' | 'card'

export const ROLE_VIEW_MODE_STORAGE_KEY = 'admin-roles-view-mode'

const VALID_MODES = ['table', 'card'] as const

/**
 * Type guard so callers can validate untyped input instead of casting blindly.
 */
export function isRoleViewMode(value: string): value is RoleViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function useRoleViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    ROLE_VIEW_MODE_STORAGE_KEY,
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
