import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogListingActiveFilters, {
  type CatalogActiveFilterChip,
} from '../CatalogListingActiveFilters.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
const chips: CatalogActiveFilterChip[] = [
  { kind: 'category', key: 'category', label: 'Alimento para perro' },
  { kind: 'facet', key: 'animal.target:ani.dom.dog', label: 'Perros' },
  { kind: 'search', key: 'search', label: 'croqueta de salmón' },
]

describe('CatalogListingActiveFilters', () => {
  it('renders removable chips for filters and the search, plus «Limpiar todo»', async () => {
    const wrapper = mount(CatalogListingActiveFilters, { props: { chips }, global: { stubs } })
    const group = wrapper.get('[aria-label="Filtros activos"]')
    const buttons = group.findAll('button')
    expect(buttons.map((button) => button.attributes('aria-label') ?? button.text())).toEqual([
      'Quitar filtro: Alimento para perro',
      'Quitar filtro: Perros',
      'Quitar búsqueda: croqueta de salmón',
      'Limpiar todo',
    ])
    expect(buttons[2]!.text()).toBe('“croqueta de salmón”')

    await buttons[1]!.trigger('click')
    await buttons[3]!.trigger('click')
    expect(wrapper.emitted('remove')).toEqual([[chips[1]]])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('renders nothing without an active filter', () => {
    const wrapper = mount(CatalogListingActiveFilters, { props: { chips: [] }, global: { stubs } })
    expect(wrapper.find('[aria-label="Filtros activos"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Limpiar todo')
  })
})
