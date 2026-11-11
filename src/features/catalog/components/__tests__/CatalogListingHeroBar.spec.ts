import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogListingHeroBar from '../CatalogListingHeroBar.vue'

describe('CatalogListingHeroBar', () => {
  it('keeps the brand line and the branch in one slim bar with a page title for screen readers', () => {
    const wrapper = mount(CatalogListingHeroBar, { props: { branchName: 'Sucursal Centro' } })
    const bar = wrapper.get('section.catalog-hero-bar')
    expect(bar.attributes('aria-label')).toBe('HoundFe, tienda en línea')
    expect(bar.text()).toContain('Todo para quienes te acompañan.')
    expect(bar.text()).toContain('Precios y disponibilidad de Sucursal Centro.')
    expect(wrapper.get('h1').text()).toBe('Catálogo en línea de HoundFe, Sucursal Centro')
    expect(wrapper.get('h1').classes()).toContain('sr-only')
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('Un perro y un gato juntos')
    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })

  it('never invents a branch line without a selected branch', () => {
    const wrapper = mount(CatalogListingHeroBar, { props: { branchName: null } })
    expect(wrapper.text()).not.toContain('Precios y disponibilidad')
    expect(wrapper.get('h1').text()).toBe('Catálogo en línea de HoundFe')
  })
})
