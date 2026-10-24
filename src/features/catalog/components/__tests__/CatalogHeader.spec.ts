import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CatalogHeader from '../CatalogHeader.vue'

describe('CatalogHeader fidelity', () => {
  it('uses the full project brand and retains only real catalog controls', () => {
    const wrapper = mount(CatalogHeader, {
      props: {
        branches: [],
        state: 'populated',
        selectedBranch: null,
        priceContextOptions: [],
        priceContextsState: 'populated',
        selectedPriceListId: null,
      },
    })
    expect(wrapper.get('img').attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(wrapper.get('img').attributes('alt')).toBe('HoundFe')
    expect(wrapper.find('[aria-label="Explorar sucursales"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Lista de precios"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Buscar en el catálogo"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Ver carrito"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No disponible')
  })
})
