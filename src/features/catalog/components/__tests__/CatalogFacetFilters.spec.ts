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

  it('emits the exact facet tokens of the toggled chip', async () => {
    const wrapper = mountFilters(['animal.target:ani.dom.dog'])
    await wrapper.get('button[aria-label="Especie: Gato, 2 productos"]').trigger('click')
    await wrapper.get('button[aria-label="Especie: Perro, 1 producto"]').trigger('click')
    expect(wrapper.emitted('toggle')).toEqual([
      [['animal.target:ani.dom.cat']],
      [['animal.target:ani.dom.dog']],
    ])
    expect(wrapper.emitted('clear')).toBeUndefined()
  })

  describe('options that share a label within one definition (per-species codes)', () => {
    const lifeStage = [
      {
        code: 'life.stage',
        label: 'Etapa de vida',
        options: [
          { code: 'life.dog.puppy', label: 'Cachorro', count: 3 },
          { code: 'life.dog.adult', label: 'Adulto', count: 4 },
          { code: 'life.cat.adult', label: 'Adulto', count: 2 },
          { code: 'life.cat.kitten', label: 'Gatito', count: 1 },
        ],
      },
    ]
    const mountLifeStage = (selected: string[] = []) =>
      mount(CatalogFacetFilters, { props: { facets: lifeStage, selected }, global: { stubs } })

    it('shows one chip per label, where the first one came, counting the sum of its codes', () => {
      const chips = mountLifeStage().findAll('[data-facet="life.stage"] button')
      // Summed: the listing only counts per code, so a product carrying two «Adulto» codes is
      // counted twice; per-species codes are disjoint for almost every product.
      expect(chips.map((chip) => chip.text())).toEqual(['Cachorro 3', 'Adulto 6', 'Gatito 1'])
      expect(chips[1]!.attributes('aria-label')).toBe('Etapa de vida: Adulto, 6 productos')
    })

    it('selects every code of the merged chip at once', async () => {
      const wrapper = mountLifeStage()
      await wrapper.get('button[aria-label="Etapa de vida: Adulto, 6 productos"]').trigger('click')
      expect(wrapper.emitted('toggle')).toEqual([
        [['life.stage:life.dog.adult', 'life.stage:life.cat.adult']],
      ])
    })

    it('reads pressed when any of its codes is selected, names it once and counts it once', async () => {
      // A URL may carry only one of the codes (an older link, or a code of another species).
      const wrapper = mountLifeStage(['life.stage:life.cat.adult', 'life.stage:life.dog.puppy'])
      const adult = wrapper.get('button[aria-label="Etapa de vida: Adulto, 6 productos"]')
      expect(adult.attributes('aria-pressed')).toBe('true')
      expect(wrapper.get('[data-testid="catalog-facet-active"]').text()).toBe('Cachorro, Adulto')
      await adult.trigger('click')
      expect(wrapper.emitted('toggle')).toEqual([
        [['life.stage:life.dog.adult', 'life.stage:life.cat.adult']],
      ])

      const both = mountLifeStage(['life.stage:life.dog.adult', 'life.stage:life.cat.adult'])
      expect(both.get('[data-testid="catalog-facet-active"]').text()).toBe('Adulto')
      expect(both.findAll('button').some((button) => button.text() === 'Limpiar filtros (1)')).toBe(
        true,
      )
    })

    it('still counts selected tokens that no chip shows', () => {
      const wrapper = mountLifeStage([
        'life.stage:life.dog.adult',
        'life.stage:life.cat.adult',
        'food.format:food.format.kibble',
      ])
      expect(wrapper.findAll('button').some((button) => button.text() === 'Limpiar filtros (2)')).toBe(
        true,
      )
    })
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
