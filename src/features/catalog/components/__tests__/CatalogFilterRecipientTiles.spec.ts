import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogFilterRecipientTiles from '../CatalogFilterRecipientTiles.vue'

const stubs = {
  UIcon: defineComponent({
    props: { name: String },
    setup: (props) => () => h('span', { 'data-icon': props.name }),
  }),
}
const facet = {
  code: 'animal.target',
  label: 'Especie',
  options: [
    { code: 'ani.dom.dog', label: 'Perro', count: 13 },
    { code: 'ani.dom.cat', label: 'Gato', count: 12 },
    { code: 'ani.dom.bird', label: 'Aves', count: 6 },
  ],
}
const mountTiles = (props: Record<string, unknown> = {}) =>
  mount(CatalogFilterRecipientTiles, {
    props: { facet, total: 38, selected: [], ...props },
    global: { stubs },
  })
const tiles = (wrapper: ReturnType<typeof mountTiles>) => wrapper.findAll('button[aria-pressed]')

describe('CatalogFilterRecipientTiles', () => {
  it('renders nothing without the animal.target facet', () => {
    const wrapper = mountTiles({ facet: null })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('builds «Todos» from the total and one tile per facet option, labels and counts from the data', () => {
    const wrapper = mountTiles()
    expect(wrapper.get('section').attributes('aria-label')).toBe('Explorar por destinatario')
    expect(tiles(wrapper).map((tile) => tile.text().replace(/\s+/g, ' '))).toEqual([
      'Todos 38',
      'Perro 13',
      'Gato 12',
      'Aves 6',
    ])
    expect(tiles(wrapper).map((tile) => tile.attributes('aria-label'))).toEqual([
      'Todos, 38 productos',
      'Perro, 13 productos',
      'Gato, 12 productos',
      'Aves, 6 productos',
    ])
    expect(tiles(wrapper).map((tile) => tile.attributes('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ])
  })

  it('toggles the facet token of a tile and shows the pressed one with a visible check', async () => {
    const wrapper = mountTiles({ selected: ['animal.target:ani.dom.cat', 'life.stage:x'] })
    expect(tiles(wrapper).map((tile) => tile.attributes('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ])
    expect(tiles(wrapper)[2]!.find('.catalog-recipient-check').exists()).toBe(true)
    expect(tiles(wrapper)[1]!.find('.catalog-recipient-check').exists()).toBe(false)
    await tiles(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('toggle')![0]![0]).toEqual(['animal.target:ani.dom.dog'])
    await tiles(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('toggle')![1]![0]).toEqual(['animal.target:ani.dom.cat'])
  })

  it('«Todos» clears the recipient filter', async () => {
    const wrapper = mountTiles({ selected: ['animal.target:ani.dom.cat'] })
    await tiles(wrapper)[0]!.trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('omits the «Todos» count when the total is unknown', () => {
    const wrapper = mountTiles({ total: null })
    expect(tiles(wrapper)[0]!.text()).toBe('Todos')
    expect(tiles(wrapper)[0]!.attributes('aria-label')).toBe('Todos')
  })
})
