import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DataTableFilters from '../DataTableFilters.vue'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'

// mobile-tables T1 (S2a). Inside the toolbar's Filtros sheet (itself the surface) the embedded
// groups are titled sections split by a hairline, never bordered cards inside the sheet card
// (design/system.md «No nested decorative cards»). Full width, so a group never collapses to a box.
const schema = defineFiltersSchema([
  filter.multiText({ id: 'folio', label: 'Folio', param: 'folio' }),
  filter.multiEnum({ id: 'species', label: 'Especie', section: 'Mascotas', param: 'species', options: [{ label: 'Perro', value: 'DOG' }] }),
  filter.numericRange({ id: 'debt', label: 'Deuda', section: 'Deuda', minParam: 'debtMin', maxParam: 'debtMax', formatAs: 'currency' }),
])

const stubs = {
  FilterToggleChips: { template: '<div />' },
  MultiTextInputFilter: { template: '<div />' },
  NumericRangeFilter: { template: '<div />' },
}

describe('DataTableFilters embedded — sections, not nested cards', () => {
  it('renders every group full width with a hairline between groups and no card paint', () => {
    const wrapper = mount(DataTableFilters, { props: { schema, state: schema.defaults(), embedded: true }, global: { stubs } })
    const root = wrapper.get('[data-testid="data-table-filters-embedded"]')
    expect(root.classes()).toContain('w-full')
    const groups = wrapper.findAll('[data-testid^="section-group-"]')
    expect(groups).toHaveLength(3)
    for (const group of groups) {
      const classes = group.classes()
      expect(classes).not.toContain('rounded-lg')
      expect(classes).not.toContain('border')
      expect(classes).not.toContain('bg-elevated/30')
      expect(classes).toEqual(expect.arrayContaining(['w-full', 'border-t', 'border-default', 'first:border-t-0']))
    }
    // The chips still render inside their group.
    expect(wrapper.get('[data-testid="section-group-Mascotas"]').find('[data-testid="filter-chips-species"]').exists()).toBe(true)
  })
})

// mobile-tables T3 (board 03): each section says how many of its filters are active and what they
// are set to, so the sheet reads at a glance.
describe('DataTableFilters embedded — section value and count', () => {
  it('shows the active count and the summarized value beside a section title', () => {
    const state = { ...schema.defaults(), species: ['DOG'] }
    const wrapper = mount(DataTableFilters, { props: { schema, state, embedded: true }, global: { stubs } })
    const header = wrapper.get('[data-testid="section-header-Mascotas"]')
    expect(header.text()).toContain('Mascotas')
    expect(header.get('[data-testid="section-count-Mascotas"]').text()).toBe('1')
    expect(header.get('[data-testid="section-count-Mascotas"]').attributes('aria-label')).toBe('1 activo')
    expect(header.get('[data-testid="section-value-Mascotas"]').text()).toBe('Perro')
  })

  it('shows neither count nor value for a section without active filters', () => {
    const wrapper = mount(DataTableFilters, { props: { schema, state: schema.defaults(), embedded: true }, global: { stubs } })
    const header = wrapper.get('[data-testid="section-header-Deuda"]')
    expect(header.find('[data-testid="section-count-Deuda"]').exists()).toBe(false)
    expect(header.find('[data-testid="section-value-Deuda"]').exists()).toBe(false)
  })
})
