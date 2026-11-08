import { computed, ref, toValue, watch, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'
import type {
  ColumnOrderState,
  ColumnPinningState,
  ColumnSizingState,
  VisibilityState,
} from '@tanstack/vue-table'
import {
  normalizeTableLayout,
  sanitizeDensity,
  sanitizeOrder,
  sanitizePinning,
  sanitizeSizing,
  sanitizeVisibility,
  type TableDensity,
  type TableLayout,
  type TableLayoutDefaults,
} from '../components/DataTable/tableLayout'

interface TablePreferencesOptions {
  persistKey: string
  defaultPinning?: ColumnPinningState
  defaultVisibility?: VisibilityState
  defaultOrder?: ColumnOrderState
  defaultSizing?: ColumnSizingState
  defaultDensity?: TableDensity
  /**
   * The table's column ids, when the caller knows them: stored ids of columns that no longer exist
   * are dropped, new columns are appended to the order, and the locked selection / Acciones columns
   * are pinned at their edges. Without them the layout is kept as stored (AppDataTable reconciles it
   * against its columns on the next change).
   */
  columnIds?: MaybeRefOrGetter<readonly string[] | undefined>
}

export interface TablePreferences {
  /** Each setter sanitizes the value: locked columns cannot be moved, unpinned or resized. */
  columnOrder: Ref<ColumnOrderState>
  columnPinning: Ref<ColumnPinningState>
  columnSizing: Ref<ColumnSizingState>
  columnVisibility: Ref<VisibilityState>
  density: Ref<TableDensity>
  /** The whole versioned layout, as stored. */
  layout: ComputedRef<TableLayout>
  /** Drops ids of columns that no longer exist and appends new ones. */
  reconcile: (columnIds: readonly string[]) => void
  /** Back to the defaults; the stored layout is removed. */
  reset: () => void
  /** Same as `reset` (kept for existing callers). */
  resetPreferences: () => void
}

export function useTablePreferences(options: TablePreferencesOptions): TablePreferences {
  const storageKey = `table-preferences-${options.persistKey}`
  const defaults: TableLayoutDefaults = {
    order: options.defaultOrder,
    pinning: options.defaultPinning,
    sizing: options.defaultSizing,
    visibility: options.defaultVisibility,
    density: options.defaultDensity,
  }
  const columnIds = () => toValue(options.columnIds)

  // Load from localStorage (SSR-safe); unreadable storage falls back to the defaults.
  function loadFromStorage(): TableLayout {
    let stored: unknown
    if (typeof window !== 'undefined') {
      try {
        const text = localStorage.getItem(storageKey)
        stored = text ? JSON.parse(text) : undefined
      } catch {
        stored = undefined
      }
    }
    return normalizeTableLayout(stored, defaults, columnIds())
  }

  const layout = ref<TableLayout>(loadFromStorage())

  function field<K extends keyof Omit<TableLayout, 'version'>>(
    key: K,
    sanitize: (value: TableLayout[K]) => TableLayout[K],
  ): Ref<TableLayout[K]> {
    return computed({
      get: () => layout.value[key],
      set: value => {
        layout.value = { ...layout.value, [key]: sanitize(value) }
      },
    })
  }

  const columnOrder = field('order', value => sanitizeOrder(value, columnIds()))
  const columnPinning = field('pinning', value => sanitizePinning(value, columnIds()))
  const columnSizing = field('sizing', value => sanitizeSizing(value, columnIds()))
  const columnVisibility = field('visibility', value => sanitizeVisibility(value, columnIds()))
  const density = field('density', sanitizeDensity)

  // Persist on change (never the initial state). Synchronous, so `reset` can skip its own write.
  let persisting = true
  watch(
    layout,
    value => {
      if (!persisting || typeof window === 'undefined') return
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        // Storage full or unavailable
      }
    },
    { deep: true, flush: 'sync' },
  )

  function reconcile(ids: readonly string[]) {
    const next = normalizeTableLayout(layout.value, defaults, ids)
    if (JSON.stringify(next) !== JSON.stringify(layout.value)) layout.value = next
  }

  function reset() {
    persisting = false
    layout.value = normalizeTableLayout(undefined, defaults, columnIds())
    persisting = true
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
  }

  return {
    columnOrder,
    columnPinning,
    columnSizing,
    columnVisibility,
    density,
    layout: computed(() => layout.value),
    reconcile,
    reset,
    resetPreferences: reset,
  }
}
