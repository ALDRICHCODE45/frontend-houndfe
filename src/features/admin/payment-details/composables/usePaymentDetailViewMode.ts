import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

/**
 * usePaymentDetailViewMode — sdd payment-details-admin S2 (REQ-PD-001)
 *
 * Tabla / Tarjetas toggle for the admin Datos bancarios list. Pure wrapper
 * over the shared `useViewMode` composable: persists to localStorage under a
 * stable key, falls back to 'table', and exposes a `displayMode` bridge that
 * maps the internal `card` to the plural `cards` form `AppDataTable` expects.
 *
 * The localStorage key matches the existing `admin-...-view-mode` convention
 * used by `useUserViewMode` and `useEmployeeViewMode`.
 */

export type PaymentDetailViewMode = 'table' | 'card'

export const PAYMENT_DETAIL_VIEW_MODE_STORAGE_KEY = 'admin-payment-details-view-mode'

const VALID_MODES = ['table', 'card'] as const

/** Type guard. Accepts ONLY `'table' | 'card'` — NOT the plural `cards`. */
export function isPaymentDetailViewMode(value: string): value is PaymentDetailViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

export function usePaymentDetailViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    PAYMENT_DETAIL_VIEW_MODE_STORAGE_KEY,
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
