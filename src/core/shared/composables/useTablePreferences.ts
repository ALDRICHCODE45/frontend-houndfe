import { ref, watch, type Ref } from 'vue'
import type { ColumnPinningState, VisibilityState } from '@tanstack/vue-table'

interface TablePreferencesOptions {
  persistKey: string
  defaultPinning?: ColumnPinningState
  defaultVisibility?: VisibilityState
}

interface TablePreferences {
  columnPinning: Ref<ColumnPinningState>
  columnVisibility: Ref<VisibilityState>
  resetPreferences: () => void
}

export function useTablePreferences(options: TablePreferencesOptions): TablePreferences {
  const storageKey = `table-preferences-${options.persistKey}`

  // Load from localStorage (SSR-safe)
  function loadFromStorage(): { pinning?: ColumnPinningState; visibility?: VisibilityState } {
    if (typeof window === 'undefined') return {}
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  const stored = loadFromStorage()

  const columnPinning = ref<ColumnPinningState>(
    stored.pinning ?? options.defaultPinning ?? { left: [], right: [] },
  )

  const columnVisibility = ref<VisibilityState>(
    stored.visibility ?? options.defaultVisibility ?? {},
  )

  // Persist on change (skip initial)
  let isInitial = true
  watch(
    [columnPinning, columnVisibility],
    ([pinning, visibility]) => {
      if (isInitial) {
        isInitial = false
        return
      }
      if (typeof window === 'undefined') return
      try {
        localStorage.setItem(storageKey, JSON.stringify({ pinning, visibility }))
      } catch {
        // Storage full or unavailable
      }
    },
    { deep: true },
  )

  function resetPreferences() {
    columnPinning.value = options.defaultPinning ?? { left: [], right: [] }
    columnVisibility.value = options.defaultVisibility ?? {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
  }

  return {
    columnPinning,
    columnVisibility,
    resetPreferences,
  }
}
