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

  it('names the selected branch and MXN, never a sample address, hours or WhatsApp', () => {
    const wrapper = mount(CatalogFooter, { props: { branchName: 'Sucursal Centro' } })
    expect(wrapper.text()).toContain(
      'Catálogo de Sucursal Centro. Precios en pesos mexicanos (MXN).',
    )
    expect(wrapper.get('[data-testid="catalog-footer-branch"]').text()).toBe('Sucursal Centro')
    expect(wrapper.text()).not.toMatch(/Av\.|Abierto|WhatsApp|ejemplo|próximamente|pendientes/)
    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })
})
