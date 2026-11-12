import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogListingSort from '../CatalogListingSort.vue'

const menu = (wrapper: ReturnType<typeof mount>) => wrapper.getComponent({ name: 'SelectMenu' })

describe('CatalogListingSort', () => {
  it('offers exactly Novedades, Precio menor and Precio mayor, never «Relevancia»', () => {
    const wrapper = mount(CatalogListingSort, { props: { modelValue: 'newest' } })
    // The system select, never the browser's native one.
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.findAll('option')).toHaveLength(0)
    expect(menu(wrapper).props('items')).toEqual([
      { value: 'newest', label: 'Novedades' },
      { value: 'price_asc', label: 'Precio menor' },
      { value: 'price_desc', label: 'Precio mayor' },
    ])
    expect(menu(wrapper).props('valueKey')).toBe('value')
    // Three options need no search box.
    expect(menu(wrapper).props('searchInput')).toBe(false)
    expect(wrapper.text()).not.toContain('Relevancia')
    const trigger = wrapper.get('button[role="combobox"], button[aria-haspopup="listbox"]')
    expect(wrapper.get(`label[for="${trigger.attributes('id')}"]`).text()).toContain('Ordenar por')
    expect(trigger.text()).toContain('Novedades')
  })

  it('reflects the current order and relays only a known choice', async () => {
    const wrapper = mount(CatalogListingSort, { props: { modelValue: 'price_desc' } })
    expect(menu(wrapper).props('modelValue')).toBe('price_desc')
    expect(wrapper.get('button[aria-haspopup="listbox"]').text()).toContain('Precio mayor')
    menu(wrapper).vm.$emit('update:modelValue', 'price_asc')
    menu(wrapper).vm.$emit('update:modelValue', 'relevance')
    menu(wrapper).vm.$emit('update:modelValue', null)
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('update:modelValue')).toEqual([['price_asc']])
  })

  it('keeps the catalog look hooks: a 44px trigger and its own popup and option classes', () => {
    const wrapper = mount(CatalogListingSort, { props: { modelValue: 'newest' } })
    expect(menu(wrapper).props('ui')).toMatchObject({
      base: expect.stringContaining('catalog-sort-trigger'),
      content: expect.stringContaining('catalog-sort-popup'),
      item: expect.stringContaining('catalog-sort-option'),
    })
  })
})
