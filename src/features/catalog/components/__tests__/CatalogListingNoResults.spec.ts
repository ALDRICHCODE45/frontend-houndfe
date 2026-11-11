import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogListingNoResults from '../CatalogListingNoResults.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
const categories = [
  { id: 'acc', name: 'Accesorios', count: 9 },
  { id: 'dog', name: 'Alimento para perro', count: 6 },
  { id: 'hyg', name: 'Higiene y cuidado', count: 5 },
  { id: 'toy', name: 'Juguetes', count: 4 },
]
const mountState = (props: Record<string, unknown>) =>
  mount(CatalogListingNoResults, {
    props: { search: '', filterLabels: [], categories: [], selectedCategoryId: null, ...props },
    global: { stubs },
  })
const labels = (wrapper: ReturnType<typeof mountState>) =>
  wrapper.findAll('button').map((button) => button.text())

describe('CatalogListingNoResults', () => {
  it('names the search and the filter, and offers both ways out', async () => {
    const wrapper = mountState({ search: 'croqueta de salmón', filterLabels: ['Perros'] })
    expect(wrapper.get('[data-testid="catalog-no-results"] h3').text()).toBe(
      'No encontramos «croqueta de salmón» en Perros',
    )
    expect(wrapper.text()).toContain('Prueba con otras palabras o quita un filtro.')
    expect(labels(wrapper)).toEqual(['Limpiar todo', 'Quitar «Perros»'])
    await wrapper.findAll('button')[0]!.trigger('click')
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('clear-all')).toHaveLength(1)
    expect(wrapper.emitted('remove-filter')).toHaveLength(1)
  })

  it('offers «Quitar búsqueda» when the search sits on several filters', async () => {
    const wrapper = mountState({ search: 'collar', filterLabels: ['Perros', 'Cachorro'] })
    expect(wrapper.get('h3').text()).toBe('No encontramos «collar» con estos filtros')
    expect(labels(wrapper)).toEqual(['Limpiar todo', 'Quitar búsqueda'])
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('clear-search')).toHaveLength(1)
  })

  it('reads a search alone and a filter alone in plain words', () => {
    expect(mountState({ search: 'collar' }).get('h3').text()).toBe('No encontramos «collar»')
    expect(labels(mountState({ search: 'collar' }))).toEqual(['Limpiar búsqueda'])
    const filtered = mountState({ filterLabels: ['Perros'] })
    expect(filtered.get('h3').text()).toBe('No hay productos en Perros')
    expect(labels(filtered)).toEqual(['Limpiar todo'])
  })

  it('suggests the real categories with their counts, never the current one', async () => {
    const wrapper = mountState({
      search: 'collar',
      categories,
      selectedCategoryId: 'acc',
    })
    const suggestions = wrapper.get('[aria-label="Explora por categoría"]')
    expect(suggestions.findAll('button').map((button) => button.text())).toEqual([
      'Alimento para perro · 6',
      'Higiene y cuidado · 5',
      'Juguetes · 4',
    ])
    await suggestions.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('select-category')).toEqual([['dog']])
    expect(mountState({ search: 'collar' }).find('[aria-label="Explora por categoría"]').exists()).toBe(
      false,
    )
  })

  it('never offers WhatsApp without a real number', () => {
    const wrapper = mountState({ search: 'collar', categories })
    expect(wrapper.html()).not.toMatch(/whatsapp|wa\.me/i)
  })
})
