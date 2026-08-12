import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

export type CustomerViewMode = 'table' | 'card'

export const CUSTOMER_VIEW_MODE_STORAGE_KEY = 'customers-view-mode'

const VALID_MODES = ['table', 'card'] as const

/** Type guard so callers can validate untyped input instead of casting blindly. */
export function isCustomerViewMode(value: string): value is CustomerViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function useCustomerViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    CUSTOMER_VIEW_MODE_STORAGE_KEY,
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
