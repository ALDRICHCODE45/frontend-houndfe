/**
 * customers-bulk-actions T1 (S3): the selection of the customers table. Row marks select ids (kept
 * across pages); with the whole page marked and more rows in the filter, «Seleccionar los N clientes
 * del filtro» switches to filter mode, where unmarking a row excludes it (up to 1,000).
 */
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useCustomerBulkSelection } from '../useCustomerBulkSelection'

const rowsOf = (...ids: string[]) => ids.map((id) => ({ id }))

function setup(options: { total?: number; ids?: string[] } = {}) {
  const rows = ref(rowsOf(...(options.ids ?? ['a', 'b', 'c'])))
  const total = ref(options.total ?? 3)
  const filter = ref<Record<string, string>>({ city: 'Monterrey' })
  const onLimit = vi.fn()
  const selection = useCustomerBulkSelection({
    rows: () => rows.value,
    totalCount: () => total.value,
    filter: () => filter.value,
    onLimit,
  })
  return { rows, total, filter, onLimit, selection }
}

describe('useCustomerBulkSelection — ids mode', () => {
  it('maps the page marks (by index) to ids and back', () => {
    const { selection } = setup()
    selection.pageSelection.value = { 0: true, 2: true }
    expect(selection.mode.value).toBe('ids')
    expect(selection.count.value).toBe(2)
    expect(selection.toSelection()).toEqual({ mode: 'ids', customerIds: ['a', 'c'] })
    expect(selection.pageSelection.value).toEqual({ 0: true, 2: true })
  })

  it('keeps the ids of another page when the page changes', () => {
    const { rows, selection } = setup({ total: 6 })
    selection.pageSelection.value = { 1: true }
    rows.value = rowsOf('d', 'e', 'f')
    expect(selection.pageSelection.value).toEqual({})
    selection.pageSelection.value = { 0: true }
    expect(selection.toSelection()).toEqual({ mode: 'ids', customerIds: ['b', 'd'] })
    expect(selection.count.value).toBe(2)
  })

  it('unmarking a row on the page removes only that id', () => {
    const { selection } = setup()
    selection.pageSelection.value = { 0: true, 1: true }
    selection.pageSelection.value = { 1: true }
    expect(selection.toSelection()).toEqual({ mode: 'ids', customerIds: ['b'] })
  })

  it('offers the whole filter only with the full page marked and more rows in the filter', () => {
    const { selection, total } = setup({ total: 3 })
    selection.pageSelection.value = { 0: true, 1: true, 2: true }
    expect(selection.canSelectAllFilter.value).toBe(false)
    total.value = 40
    expect(selection.canSelectAllFilter.value).toBe(true)
    selection.pageSelection.value = { 0: true, 1: true }
    expect(selection.canSelectAllFilter.value).toBe(false)
  })

  it('caps ids at 1,000 and reports it', async () => {
    const ids = Array.from({ length: 1_001 }, (_, i) => `id-${i}`)
    const { selection, onLimit } = setup({ ids, total: 2_000 })
    selection.pageSelection.value = Object.fromEntries(ids.map((_, i) => [i, true]))
    expect(selection.count.value).toBe(1_000)
    await nextTick()
    expect(onLimit).toHaveBeenCalledWith('ids')
  })
})

describe('useCustomerBulkSelection — filter mode', () => {
  it('selects the whole filter, then unmarking rows excludes them', () => {
    const { selection } = setup({ total: 40 })
    selection.pageSelection.value = { 0: true, 1: true, 2: true }
    selection.selectAllFilter()
    expect(selection.mode.value).toBe('filter')
    expect(selection.count.value).toBe(40)
    expect(selection.pageSelection.value).toEqual({ 0: true, 1: true, 2: true })

    selection.pageSelection.value = { 0: true, 2: true }
    expect(selection.count.value).toBe(39)
    expect(selection.toSelection()).toEqual({
      mode: 'filter',
      filter: { city: 'Monterrey' },
      excludeIds: ['b'],
    })
    // Marking it again takes it out of excludeIds.
    selection.pageSelection.value = { 0: true, 1: true, 2: true }
    expect(selection.toSelection()).toEqual({ mode: 'filter', filter: { city: 'Monterrey' }, excludeIds: [] })
  })

  it('caps excludeIds at 1,000 and reports it', async () => {
    const ids = Array.from({ length: 1_001 }, (_, i) => `id-${i}`)
    const { selection, onLimit } = setup({ ids, total: 5_000 })
    selection.selectAllFilter()
    selection.pageSelection.value = {}
    const body = selection.toSelection()
    expect(body?.mode).toBe('filter')
    expect(body && body.mode === 'filter' ? body.excludeIds.length : 0).toBe(1_000)
    await nextTick()
    expect(onLimit).toHaveBeenCalledWith('exclude')
  })

  it('«Quitar selección» (page marks emptied, then clear()) never reports the exclude limit', async () => {
    const ids = Array.from({ length: 1_001 }, (_, i) => `id-${i}`)
    const { selection, onLimit } = setup({ ids, total: 5_000 })
    selection.selectAllFilter()
    // AppDataTable empties the page marks and then emits clear-selection, in the same tick.
    selection.pageSelection.value = {}
    selection.clear()
    await nextTick()
    expect(onLimit).not.toHaveBeenCalled()
    expect(selection.count.value).toBe(0)
    expect(selection.mode.value).toBe('ids')
  })

  it('a row of the filter mode on a new page is marked unless excluded', () => {
    const { selection, rows } = setup({ total: 6 })
    selection.selectAllFilter()
    rows.value = rowsOf('d', 'e', 'f')
    expect(selection.pageSelection.value).toEqual({ 0: true, 1: true, 2: true })
  })
})

describe('useCustomerBulkSelection — clearing and missing ids', () => {
  it('clears on a filter change', async () => {
    const { selection, filter } = setup({ total: 40 })
    selection.pageSelection.value = { 0: true }
    filter.value = { city: 'Saltillo' }
    await nextTick()
    expect(selection.count.value).toBe(0)
    expect(selection.toSelection()).toBeNull()
  })

  it('removes missing ids from the ids selection but never from excludeIds', () => {
    const { selection } = setup({ total: 40 })
    selection.pageSelection.value = { 0: true, 1: true }
    selection.removeIds(['a'])
    expect(selection.toSelection()).toEqual({ mode: 'ids', customerIds: ['b'] })

    selection.selectAllFilter()
    selection.pageSelection.value = { 0: true }
    // Taking an id out of excludeIds would re-include a customer the user unmarked.
    selection.removeIds(['b'])
    expect(selection.toSelection()).toEqual({ mode: 'filter', filter: { city: 'Monterrey' }, excludeIds: ['b', 'c'] })
  })

  it('clear() empties everything', () => {
    const { selection } = setup({ total: 40 })
    selection.selectAllFilter()
    selection.clear()
    expect(selection.mode.value).toBe('ids')
    expect(selection.count.value).toBe(0)
    expect(selection.pageSelection.value).toEqual({})
  })
})
