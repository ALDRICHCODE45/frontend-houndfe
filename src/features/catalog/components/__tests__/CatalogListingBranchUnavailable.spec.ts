import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogListingBranchUnavailable from '../CatalogListingBranchUnavailable.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
const branches = [
  { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: 'Av. Juárez 120', phone: null },
  { id: 'b-2', name: 'Sucursal Sur', slug: 'sur', address: null, phone: null },
]

describe('CatalogListingBranchUnavailable', () => {
  it('says the branch has no catalog and lets the visitor pick a published one', async () => {
    const wrapper = mount(CatalogListingBranchUnavailable, {
      props: { branches },
      global: { stubs },
    })
    expect(wrapper.get('h3').text()).toBe('Esta sucursal aún no publica su catálogo')
    expect(wrapper.text()).toContain('Puedes ver el catálogo de otra sucursal.')
    const rows = wrapper.findAll('[role="group"][aria-label="Sucursales"] button')
    expect(rows.map((row) => row.attributes('aria-pressed'))).toEqual(['true', 'false'])
    expect(rows[0]!.text()).toContain('Av. Juárez 120')
    // No invented counts, addresses or WhatsApp.
    expect(wrapper.text()).not.toMatch(/productos|Dirección|WhatsApp/)

    await rows[1]!.trigger('click')
    expect(rows[1]!.attributes('aria-pressed')).toBe('true')
    const go = wrapper.findAll('button').find((button) => button.text().startsWith('Ver catálogo'))!
    expect(go.text()).toBe('Ver catálogo de Sucursal Sur')
    await go.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['sur']])
  })
})
