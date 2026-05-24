import { describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { ref } from 'vue'
import DataTableFilters from '../DataTableFilters.vue'
import type { FilterDefinition } from '../types'

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof import('@vueuse/core')>('@vueuse/core')
  return {
    ...actual,
    useBreakpoints: () => ({ greaterOrEqual: () => ref(true) }),
  }
})

const schema: FilterDefinition[] = [
  { kind: 'multi-text', id: 'folio', label: 'Folio', param: 'folio' },
  { kind: 'multi-enum', id: 'paymentStatus', section: 'Estado', label: 'Estado', param: 'paymentStatus', options: [{ label: 'Pagada', value: 'PAID' }] },
]

describe('DataTableFilters', () => {
  function mountComponent() {
    return shallowMount(DataTableFilters, {
      props: { schema, modelValue: { folio: [], paymentStatus: [] } },
    })
  }

  it('renders trigger actions', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="open-filters"]').element).toBeTruthy()
    expect(wrapper.find('[data-testid="clear-filters"]').element).toBeTruthy()
  })

  it('renders folio schema without identification section header', () => {
    const wrapper = shallowMount(DataTableFilters, { props: { schema, modelValue: { folio: ['12'], paymentStatus: [] } }, global: { stubs: { USlideover: true } } })
    expect(wrapper.text()).not.toContain('Identificación')
  })

  it('tracks active chips from model value', () => {
    const wrapper = shallowMount(DataTableFilters, { props: { schema, modelValue: { folio: ['12'], paymentStatus: ['PAID'] } }, global: { stubs: { USlideover: true } } })
    const chipsProp = wrapper.findComponent({ name: 'DataTableFiltersChips' }).props('chips') as Array<unknown>
    expect(chipsProp.length).toBe(2)
  })

  it('passes desktop slideover side without inset and without width override', () => {
    const wrapper = mountComponent()
    const html = wrapper.html()

    expect(html).toContain('side="right"')
    expect(html).not.toContain('inset="true"')
    expect(html).not.toContain('max-w-md')
  })
})
