import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

/**
 * usePaymentMethodViewMode — sdd custom-payment-methods S2A (REQ-PM-001)
 *
 * Tabla / Tarjetas toggle for the admin Métodos de cobro list. Pure wrapper
 * over the shared `useViewMode` composable: persists to localStorage under a
 * stable key, falls back to 'table', and exposes a `displayMode` bridge that
 * maps the internal `card` to the plural `cards` form `AppDataTable` expects.
 *
 * The localStorage key matches the existing `admin-...-view-mode` convention
 * used by `usePaymentDetailViewMode` and `useUserViewMode`.
 */

export type PaymentMethodViewMode = 'table' | 'card'

export const PAYMENT_METHOD_VIEW_MODE_STORAGE_KEY = 'admin-payment-methods-view-mode'

const VALID_MODES = ['table', 'card'] as const

/** Type guard. Accepts ONLY `'table' | 'card'` — NOT the plural `cards`. */
export function isPaymentMethodViewMode(value: string): value is PaymentMethodViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function usePaymentMethodViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    PAYMENT_METHOD_VIEW_MODE_STORAGE_KEY,
    VALID_MODES,
    'table',
  )

  /**
   * Bridge to AppDataTable's `displayMode` prop. AppDataTable expects
   * `'table' | 'cards' | 'auto'`. Our internal singular `card` maps to `cards`.
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