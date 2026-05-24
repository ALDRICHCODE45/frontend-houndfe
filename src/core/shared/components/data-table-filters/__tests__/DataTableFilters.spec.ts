import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import DataTableFilters from '../DataTableFilters.vue'
import type { FilterDefinition } from '../types'

const schema: FilterDefinition[] = [
  { kind: 'multi-text', id: 'folio', label: 'Folio', param: 'folio' },
  { kind: 'multi-enum', id: 'paymentStatus', section: 'Estado', label: 'Estado', param: 'paymentStatus', options: [{ label: 'Pagada', value: 'PAID' }] },
]

describe('DataTableFilters', () => {
  it('renders trigger actions', () => {
    const wrapper = shallowMount(DataTableFilters, { props: { schema, modelValue: { folio: [], paymentStatus: [] } } })
    expect(wrapper.find('[data-testid="open-filters"]').element).toBeTruthy()
    expect(wrapper.find('[data-testid="clear-filters"]').element).toBeTruthy()
  })

  it('renders folio schema without identification section header', () => {
    const wrapper = shallowMount(DataTableFilters, { props: { schema, modelValue: { folio: ['12'], paymentStatus: [] } } })
    expect(wrapper.text()).not.toContain('Identificación')
  })

  it('tracks active chips from model value', () => {
    const wrapper = shallowMount(DataTableFilters, { props: { schema, modelValue: { folio: ['12'], paymentStatus: ['PAID'] } } })
    const chipsProp = wrapper.findComponent({ name: 'DataTableFiltersChips' }).props('chips') as Array<unknown>
    expect(chipsProp.length).toBe(2)
  })
})
