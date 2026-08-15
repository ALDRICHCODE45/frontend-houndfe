/**
 * usePendingApprovalsViewMode — WU-A (REQ-2)
 *
 * Composable + type guard for the pending-approvals tray view-mode toggle.
 * Default mode is `card` (the tray is time-sensitive — preserve the deliberate
 * card UX as the default) and the choice persists in `localStorage` under
 * `pending-approvals-view-mode`.
 *
 * Exports:
 *  - PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY — localStorage key
 *  - PendingApprovalsViewMode                 — 'table' | 'card' union
 *  - isPendingApprovalsViewMode               — type guard (rejects 'cards')
 *  - usePendingApprovalsViewMode()            — reactive composable
 *    Returns: { viewMode, setMode, toggleViewMode, displayMode }
 *    `displayMode` bridges 'card' → 'cards' for AppDataTable.
 */

import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PendingApprovalsViewMode = 'table' | 'card'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * localStorage key for view mode preference. Distinct from other feature
 * storage keys (employee-view-mode, user-view-mode, etc.) so preferences do
 * not collide.
 */
export const PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY = 'pending-approvals-view-mode'

const VALID_MODES = ['table', 'card'] as const

// ─── Type guard ───────────────────────────────────────────────────────────────

/**
 * Type guard so callers can validate untyped input instead of casting blindly.
 * Accepts ONLY the internal 'table' | 'card' union — NOT 'cards' (AppDataTable
 * shape). The plural 'cards' is a downstream bridge of the internal 'card'.
 */
export function isPendingApprovalsViewMode(value: string): value is PendingApprovalsViewMode {
  return (VALID_MODES as readonly string[]).includes(value)
}

// ─── Reactive composable ──────────────────────────────────────────────────────

/**
 * usePendingApprovalsViewMode — reactive wrapper around the shared useViewMode
 * composable. Binds PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY, the
 * pending-approvals mode union, and the default `card` (deliberate tray UX).
 *
 * Returns:
 *  - viewMode        — reactive ref<'table' | 'card'>
 *  - setMode         — write mode + persist
 *  - toggleViewMode  — cycle card ↔ table
 *  - displayMode     — bridge to AppDataTable ('table' | 'cards'); maps
 *                      'card' → 'cards'
 */
export function usePendingApprovalsViewMode() {
  const { viewMode, setMode, toggleMode } = useViewMode(
    PENDING_APPROVALS_VIEW_MODE_STORAGE_KEY,
    VALID_MODES,
    'card',
  )

  /**
   * Bridge to AppDataTable's `displayMode` prop. AppDataTable expects
   * `'table' | 'cards' | 'auto'` — we map our internal singular `card` to the
   * plural `cards` form the table uses.
   */
  const displayMode = computed<'table' | 'cards'>(() =>
    viewMode.value === 'card' ? 'cards' : 'table',
  )

  return {
    viewMode,
    toggleViewMode: toggleMode,
    setMode,
    displayMode,
  }
}