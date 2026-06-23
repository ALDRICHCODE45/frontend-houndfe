/**
 * useViewMode — Shared composable for localStorage-persisted view mode toggle.
 *
 * Generic version of useEmployeeViewMode. Accepts any set of valid string values
 * and a storage key, and returns a reactive ref that persists across page reloads.
 *
 * Usage:
 *   const { viewMode, setMode } = useViewMode(
 *     'my-feature-view-mode',
 *     ['table', 'card'] as const,
 *     'table',
 *   )
 *
 * @param storageKey   - localStorage key to persist the selected mode
 * @param validValues  - tuple of all valid mode strings (used to validate stored value)
 * @param defaultValue - fallback when storage is empty or invalid (defaults to validValues[0])
 */

import { ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * Read a persisted view mode from localStorage without Vue reactivity.
 * Falls back to `defaultValue` when storage is empty, invalid, or unavailable.
 * Single source of truth for the read/validate/fallback logic.
 */
export function readViewMode<T extends string>(
  storageKey: string,
  validValues: readonly T[],
  defaultValue: T = validValues[0]!,
): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored && (validValues as readonly string[]).includes(stored)) {
      return stored as T
    }
  } catch {
    // Storage unavailable (private browsing, quota exceeded, etc.)
  }
  return defaultValue
}

/**
 * Persist a view mode to localStorage without Vue reactivity.
 * No-op when storage is unavailable.
 */
export function writeViewMode<T extends string>(storageKey: string, mode: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey, mode)
  } catch {
    // Storage unavailable
  }
}

export function useViewMode<T extends string>(
  storageKey: string,
  validValues: readonly T[],
  defaultValue: T = validValues[0]!,
): {
  viewMode: Ref<T>
  setMode: (mode: T) => void
  toggleMode: () => void
} {
  const viewMode = ref<T>(readViewMode(storageKey, validValues, defaultValue)) as Ref<T>

  watch(viewMode, (mode) => {
    writeViewMode(storageKey, mode)
  })

  function setMode(mode: T): void {
    viewMode.value = mode
  }

  function toggleMode(): void {
    const idx = validValues.indexOf(viewMode.value)
    viewMode.value = validValues[(idx + 1) % validValues.length]!
  }

  return { viewMode, setMode, toggleMode }
}
