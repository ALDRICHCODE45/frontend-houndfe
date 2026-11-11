import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogListingSort from '../CatalogListingSort.vue'

describe('CatalogListingSort', () => {
  it('offers exactly Novedades, Precio menor and Precio mayor, never «Relevancia»', () => {
    const wrapper = mount(CatalogListingSort, { props: { modelValue: 'newest' } })
    const options = wrapper.findAll('option')
    expect(options.map((option) => [option.text(), option.attributes('value')])).toEqual([
      ['Novedades', 'newest'],
      ['Precio menor', 'price_asc'],
      ['Precio mayor', 'price_desc'],
    ])
    expect(wrapper.text()).not.toContain('Relevancia')
    const select = wrapper.get('select')
    expect(wrapper.get(`label[for="${select.attributes('id')}"]`).text()).toContain('Ordenar por')
    expect((select.element as HTMLSelectElement).value).toBe('newest')
  })

  it('reflects the current order and relays only a known choice', async () => {
    const wrapper = mount(CatalogListingSort, { props: { modelValue: 'price_desc' } })
    const select = wrapper.get('select')
    expect((select.element as HTMLSelectElement).value).toBe('price_desc')
    await select.setValue('price_asc')
    expect(wrapper.emitted('update:modelValue')).toEqual([['price_asc']])
  })
})
