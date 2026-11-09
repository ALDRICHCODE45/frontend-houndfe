import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogFacetFilters from '../CatalogFacetFilters.vue'

const stubs = {
  UIcon: defineComponent({
    props: { name: String },
    setup: (props) => () => h('span', { 'data-icon': props.name }),
  }),
}

const facets = [
  {
    code: 'animal.target',
    label: 'Especie',
    options: [
      { code: 'ani.dom.cat', label: 'Gato', count: 2 },
      { code: 'ani.dom.dog', label: 'Perro', count: 1 },
    ],
  },
  {
    code: 'food.format',
    label: 'Formato del alimento',
    options: [{ code: 'food.format.kibble', label: 'Croquetas', count: 0 }],
  },
]

const mountFilters = (selected: string[] = []) =>
  mount(CatalogFacetFilters, { props: { facets, selected }, global: { stubs } })

describe('CatalogFacetFilters', () => {
  it('renders one labelled group of toggle chips per definition, in server order, with counts', () => {
    const wrapper = mountFilters()
    const root = wrapper.get('[data-testid="catalog-facet-filters"]')
    expect(root.attributes('aria-label')).toBe('Filtrar por características')
    const groups = wrapper.findAll('[role="group"][data-facet]')
    expect(groups.map((group) => group.attributes('data-facet'))).toEqual([
      'animal.target',
      'food.format',
    ])
    const label = wrapper.get(`#${groups[0]!.attributes('aria-labelledby')}`)
    expect(label.text()).toBe('Especie')
    const chips = groups[0]!.findAll('button')
    expect(chips.map((chip) => chip.text())).toEqual(['Gato 2', 'Perro 1'])
    expect(chips.map((chip) => chip.attributes('aria-label'))).toEqual([
      'Especie: Gato, 2 productos',
      'Especie: Perro, 1 producto',
    ])
    expect(chips.every((chip) => chip.attributes('aria-pressed') === 'false')).toBe(true)
    expect(chips.every((chip) => chip.attributes('type') === 'button')).toBe(true)
    expect(wrapper.find('[data-testid="catalog-facet-check"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Limpiar filtros')
    // No classic checkboxes.
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('marks selected chips with aria-pressed and a check, names them by the group and offers one clear', async () => {
    const wrapper = mountFilters(['animal.target:ani.dom.dog', 'food.format:food.format.kibble'])
    const pressed = wrapper.findAll('button[aria-pressed="true"]')
    expect(pressed.map((chip) => chip.text())).toEqual(['Perro 1', 'Croquetas 0'])
    for (const chip of pressed) expect(chip.find('[data-testid="catalog-facet-check"]').exists()).toBe(true)
    expect(
      wrapper.get('button[aria-label="Especie: Gato, 2 productos"]').attributes('aria-pressed'),
    ).toBe('false')
    // The active choice stays readable next to its definition even when the chip row scrolls.
    expect(wrapper.get('[data-facet="animal.target"] [data-testid="catalog-facet-active"]').text()).toBe(
      'Perro',
    )
    expect(wrapper.find('[data-facet="food.format"] [data-testid="catalog-facet-active"]').text()).toBe(
      'Croquetas',
    )
    const clear = wrapper.findAll('button').find((button) => button.text() === 'Limpiar filtros (2)')!
    expect(clear).toBeDefined()
    expect(clear.attributes('aria-pressed')).toBeUndefined()
    await clear.trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
    expect(wrapper.emitted('toggle')).toBeUndefined()
  })

  it('emits the exact facet token of the toggled chip', async () => {
    const wrapper = mountFilters(['animal.target:ani.dom.dog'])
    await wrapper.get('button[aria-label="Especie: Gato, 2 productos"]').trigger('click')
    await wrapper.get('button[aria-label="Especie: Perro, 1 producto"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([
      ['animal.target:ani.dom.cat'],
      ['animal.target:ani.dom.dog'],
    ])
    expect(wrapper.emitted('clear')).toBeUndefined()
  })

  it('renders nothing without facets or selection', () => {
    const wrapper = mount(CatalogFacetFilters, {
      props: { facets: [], selected: [] },
      global: { stubs },
    })
    expect(wrapper.find('[data-testid="catalog-facet-filters"]').exists()).toBe(false)
  })

  it('keeps the clear action when a selection is active but no definition came back', async () => {
    const wrapper = mount(CatalogFacetFilters, {
      props: { facets: [], selected: ['animal.target:ani.dom.cat'] },
      global: { stubs },
    })
    const clear = wrapper.findAll('button').find((button) => button.text() === 'Limpiar filtros (1)')
    expect(clear).toBeDefined()
    await clear!.trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })
})
