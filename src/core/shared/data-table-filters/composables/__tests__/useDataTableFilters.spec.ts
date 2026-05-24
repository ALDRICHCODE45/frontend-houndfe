import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'
import { useDataTableFilters } from '../useDataTableFilters'
import type { FiltersAdapter } from '../adapterTypes'

const schema = defineFiltersSchema([
  filter.multiEnum({ id: 'paymentMethod', label: 'Método', param: 'paymentMethod', options: [{ label: 'Tarjeta débito', value: 'CARD_DEBIT' }] }),
  filter.numericRange({ id: 'total', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax' }),
])

function createAdapter(initial = schema.defaults()): FiltersAdapter {
  let value = { ...initial }
  let cb: ((s: Record<string, unknown>) => void) | undefined
  return {
    read: () => ({ ...value }),
    write: vi.fn((next) => { value = { ...next } }),
    watch: (nextCb) => { cb = nextCb; return () => { cb = undefined } },
    _emit: (next: Record<string, unknown>) => cb?.(next),
  } as FiltersAdapter & { _emit: (next: Record<string, unknown>) => void }
}

describe('useDataTableFilters', () => {
  it('initializes merged state and debounced write dedup', async () => {
    vi.useFakeTimers()
    const adapter = createAdapter({ paymentMethod: ['CARD_DEBIT'] })
    const filters = useDataTableFilters(schema, adapter, { debounceMs: 50 })
    expect(filters.state.value.paymentMethod).toEqual(['CARD_DEBIT'])
    filters.setFieldValue('total', { min: 10 })
    await nextTick()
    vi.advanceTimersByTime(60)
    expect(adapter.write).toHaveBeenCalledTimes(1)
    filters.setFieldValue('total', { min: 10 })
    await nextTick()
    vi.advanceTimersByTime(60)
    expect(adapter.write).toHaveBeenCalledTimes(1)
  })

  it('clearAll and clearFilter behave as expected', () => {
    const adapter = createAdapter({ paymentMethod: ['CARD_DEBIT'], total: { min: 1 } })
    const filters = useDataTableFilters(schema, adapter)
    filters.clearFilter('paymentMethod')
    expect(filters.state.value.paymentMethod).toEqual([])
    filters.clearAll()
    expect(filters.state.value).toEqual(schema.defaults())
    expect(adapter.write).toHaveBeenCalled()
  })

  it('external adapter updates state without write loop', () => {
    const adapter = createAdapter()
    const filters = useDataTableFilters(schema, adapter)
    ;(adapter as FiltersAdapter & { _emit: (next: Record<string, unknown>) => void })._emit({ ...schema.defaults(), paymentMethod: ['CARD_DEBIT'] })
    expect(filters.state.value.paymentMethod).toEqual(['CARD_DEBIT'])
  })
})
