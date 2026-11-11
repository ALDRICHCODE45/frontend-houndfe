import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogListingSearch from '../CatalogListingSearch.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }

describe('CatalogListingSearch', () => {
  it('labels the header search and commits the draft only on submit', async () => {
    const wrapper = mount(CatalogListingSearch, {
      props: {
        modelValue: '',
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
      global: { stubs },
    })
    expect(wrapper.get('label[for="catalog-search"]').text()).toBe('Buscar productos o marcas')
    const input = wrapper.get<HTMLInputElement>('#catalog-search')
    expect(input.attributes('placeholder')).toBe('Buscar productos o marcas')
    await input.setValue('collar')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.get('form[role="search"]').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([['collar']])
    expect(wrapper.get('button[type="submit"]').text()).toBe('Buscar')
  })
})
