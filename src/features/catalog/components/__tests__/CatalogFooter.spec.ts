import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogFooter from '../CatalogFooter.vue'

describe('CatalogFooter', () => {
  it('identifies the catalog without invented policies, contacts or commerce links', () => {
    const wrapper = mount(CatalogFooter)
    expect(wrapper.element.tagName).toBe('FOOTER')
    expect(wrapper.get('img').attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(wrapper.get('img').attributes('alt')).toBe('HoundFe')
    expect(wrapper.text()).toContain('Precios y existencias por sucursal.')
    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })
})
