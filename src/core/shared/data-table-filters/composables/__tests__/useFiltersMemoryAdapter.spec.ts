import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'
import { useFiltersMemoryAdapter } from '../useFiltersMemoryAdapter'

const schema = defineFiltersSchema([filter.multiText({ id: 'folio', label: 'Folio', param: 'folio' })])

describe('useFiltersMemoryAdapter', () => {
  it('reads writes and watches state', async () => {
    const adapter = useFiltersMemoryAdapter(schema, { folio: ['1'] })
    expect(adapter.read().folio).toEqual(['1'])
    let watched: unknown
    const stop = adapter.watch((state) => { watched = state.folio })
    adapter.write({ folio: ['2'] })
    await nextTick()
    expect(watched).toEqual(['2'])
    stop()
  })
})
