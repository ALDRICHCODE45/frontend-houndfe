import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogListingHeading from '../CatalogListingHeading.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }

describe('CatalogListingHeading', () => {
  it('titles the catalog with the real total, MXN and the branch', () => {
    const wrapper = mount(CatalogListingHeading, {
      props: { total: 38, branchName: 'Sucursal Centro' },
      global: { stubs },
    })
    expect(wrapper.get('h2').text()).toContain('Nuestro catálogo')
    expect(wrapper.text()).toContain('Encuentra lo que necesitas')
    const total = wrapper.get('[data-testid="catalog-result-total"]')
    expect(total.text()).toBe('38 productos')
    expect(total.attributes('role')).toBe('status')
    expect(wrapper.get('.catalog-listing-context').text()).toBe('Precios en MXN · Sucursal Centro')
  })

  it('withholds the total until a response exists and keeps a real one or zero', () => {
    const none = mount(CatalogListingHeading, {
      props: { total: null, branchName: null },
      global: { stubs },
    })
    expect(none.find('[data-testid="catalog-result-total"]').exists()).toBe(false)
    expect(none.get('.catalog-listing-context').text()).toBe('Precios en MXN')
    const one = mount(CatalogListingHeading, {
      props: { total: 1, branchName: null },
      global: { stubs },
    })
    expect(one.get('[data-testid="catalog-result-total"]').text()).toBe('1 producto')
    const zero = mount(CatalogListingHeading, {
      props: { total: 0, branchName: null },
      global: { stubs },
    })
    expect(zero.get('[data-testid="catalog-result-total"]').text()).toBe('0 productos')
  })
})
