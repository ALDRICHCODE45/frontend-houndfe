import { useViewMode } from '@/core/shared/composables/useViewMode'

export type ProductViewMode = 'table' | 'card'

export const PRODUCT_VIEW_MODE_STORAGE_KEY = 'products-view-mode'

const VALID_MODES = ['table', 'card'] as const

/** Type guard so callers can validate untyped input instead of casting blindly. */
export function isProductViewMode(value: string): value is ProductViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function useProductViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    PRODUCT_VIEW_MODE_STORAGE_KEY,
    VALID_MODES,
    'table',
  )

  return {
    viewMode,
    setMode,
    toggleViewMode: toggleMode,
  }
}
