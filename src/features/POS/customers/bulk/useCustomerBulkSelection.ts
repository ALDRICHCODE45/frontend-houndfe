/**
 * useCustomerBulkSelection.ts — the selection of the customers table (customers-bulk-actions S3).
 *
 * AppDataTable keys its row marks by the row's index on the page; this composable keeps the real
 * selection by customer id and exposes the page marks as a writable `pageSelection`:
 * - ids mode: the marked ids, kept across pages (up to 1,000, the backend's `customerIds` cap);
 * - filter mode («Seleccionar los N clientes del filtro»): every customer of the filter except the
 *   unmarked ones (`excludeIds`, up to 1,000).
 * Any change of the filter (search, filters sheet, saved view) clears it: the selection describes
 * one filter only.
 */
import { computed, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { RowSelectionState } from '@tanstack/vue-table'
import { BULK_SELECTION_IDS_MAX, type CustomerBulkSelection } from './customerBulkSelection'

export type CustomerBulkSelectionLimit = 'ids' | 'exclude'

export function useCustomerBulkSelection(options: {
  rows: MaybeRefOrGetter<ReadonlyArray<{ id: string }>>
  /** Rows of the whole filter (the listing's total). */
  totalCount: MaybeRefOrGetter<number>
  /** The `selection.filter` of the current table state; a change clears the selection. */
  filter: MaybeRefOrGetter<Record<string, string>>
  onLimit?: (limit: CustomerBulkSelectionLimit) => void
}) {
  const mode = shallowRef<'ids' | 'filter'>('ids')
  // Insertion-ordered sets, replaced on every write so computed values follow.
  const ids = ref<Set<string>>(new Set())
  const excluded = ref<Set<string>>(new Set())

  const rows = () => toValue(options.rows)
  const total = () => Math.max(0, toValue(options.totalCount) ?? 0)

  const isSelected = (id: string) => (mode.value === 'filter' ? !excluded.value.has(id) : ids.value.has(id))

  const count = computed(() =>
    mode.value === 'filter' ? Math.max(0, total() - excluded.value.size) : ids.value.size,
  )

  // The limit is reported a microtask later, so a clear() in the same tick drops it: AppDataTable's
  // «Quitar selección» empties the page marks (in filter mode that reads as «exclude the page» and
  // may hit the 1,000 cap) right before it emits clear-selection.
  let pendingLimit: CustomerBulkSelectionLimit | null = null
  function reportLimit(limit: CustomerBulkSelectionLimit) {
    const queued = pendingLimit !== null
    pendingLimit = limit
    if (queued) return
    void Promise.resolve().then(() => {
      const reported = pendingLimit
      pendingLimit = null
      if (reported) options.onLimit?.(reported)
    })
  }

  function clear() {
    pendingLimit = null
    mode.value = 'ids'
    ids.value = new Set()
    excluded.value = new Set()
  }

  const pageSelection = computed<RowSelectionState>({
    get: () => {
      const marks: RowSelectionState = {}
      rows().forEach((row, index) => {
        if (isSelected(row.id)) marks[index] = true
      })
      return marks
    },
    set: (next) => {
      let limited = false
      if (mode.value === 'filter') {
        const nextExcluded = new Set(excluded.value)
        rows().forEach((row, index) => {
          if (next[index]) nextExcluded.delete(row.id)
          else if (!nextExcluded.has(row.id)) {
            if (nextExcluded.size >= BULK_SELECTION_IDS_MAX) limited = true
            else nextExcluded.add(row.id)
          }
        })
        excluded.value = nextExcluded
        if (limited) reportLimit('exclude')
        if (count.value === 0) clear()
        return
      }
      const nextIds = new Set(ids.value)
      rows().forEach((row, index) => {
        if (!next[index]) nextIds.delete(row.id)
      })
      rows().forEach((row, index) => {
        if (!next[index] || nextIds.has(row.id)) return
        if (nextIds.size >= BULK_SELECTION_IDS_MAX) limited = true
        else nextIds.add(row.id)
      })
      ids.value = nextIds
      if (limited) reportLimit('ids')
    },
  })

  /** The whole page is marked while the filter has more rows than the selection. */
  const canSelectAllFilter = computed(() => {
    if (mode.value !== 'ids') return false
    const page = rows()
    return page.length > 0 && page.every((row) => ids.value.has(row.id)) && total() > ids.value.size
  })

  function selectAllFilter() {
    mode.value = 'filter'
    ids.value = new Set()
    excluded.value = new Set()
  }

  /**
   * Customers that no longer exist (404 missingIds) leave an ids selection. In filter mode nothing
   * changes: the server re-evaluates the filter, so a deleted customer drops out by itself, and taking
   * an id out of `excludeIds` would re-include a customer the user unmarked.
   */
  function removeIds(missing: readonly string[]) {
    if (mode.value === 'filter') return
    const gone = new Set(missing)
    ids.value = new Set([...ids.value].filter((id) => !gone.has(id)))
  }

  /** The request body, or null with nothing selected. */
  function toSelection(): CustomerBulkSelection | null {
    if (count.value === 0) return null
    if (mode.value === 'filter') {
      return { mode: 'filter', filter: { ...toValue(options.filter) }, excludeIds: [...excluded.value] }
    }
    return { mode: 'ids', customerIds: [...ids.value] }
  }

  watch(
    () => JSON.stringify(toValue(options.filter)),
    () => clear(),
  )

  return {
    mode: computed(() => mode.value),
    count,
    pageSelection,
    canSelectAllFilter,
    selectAllFilter,
    removeIds,
    toSelection,
    clear,
  }
}
