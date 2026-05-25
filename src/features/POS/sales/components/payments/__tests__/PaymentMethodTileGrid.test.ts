import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentMethodTileGrid from '../PaymentMethodTileGrid.vue'

const stubs = {
  UButton: {
    props: ['disabled'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot name="leading" /><slot /></button>',
  },
  UIcon: {
    props: ['name'],
    template: '<span :data-icon="name" />',
  },
}

describe('PaymentMethodTileGrid', () => {
  it('renders a 2x2 grid of payment method tiles with label and icon', () => {
    const wrapper = mount(PaymentMethodTileGrid, { global: { stubs } })

    const tiles = wrapper.findAll('[data-testid^="payment-method-tile-"]')

    expect(wrapper.get('[data-testid="payment-method-grid"]').classes()).toContain('grid-cols-2')
    expect(tiles).toHaveLength(4)
    expect(wrapper.text()).toContain('Efectivo')
    expect(wrapper.text()).toContain('Tarjeta crédito')
    expect(wrapper.text()).toContain('Tarjeta débito')
    expect(wrapper.text()).toContain('Transferencia')
    expect(wrapper.findAll('[data-testid^="payment-method-icon-"]')).toHaveLength(4)
  })

  it('emits select(method) when a tile is clicked', async () => {
    const wrapper = mount(PaymentMethodTileGrid, { global: { stubs } })

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[ 'cash' ]])
  })

  it('disables all tiles and prevents emits when disabled=true', async () => {
    const wrapper = mount(PaymentMethodTileGrid, {
      props: {
        disabled: true,
      },
      global: { stubs },
    })

    const tiles = wrapper.findAll('[data-testid^="payment-method-tile-"]')
    for (const tile of tiles) {
      expect(tile.attributes('disabled')).toBeDefined()
    }

    await wrapper.get('[data-testid="payment-method-tile-cash"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('disables only methods included in disabledMethods', async () => {
    const wrapper = mount(PaymentMethodTileGrid, {
      props: {
        disabledMethods: ['transfer'],
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="payment-method-tile-transfer"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="payment-method-tile-cash"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="payment-method-tile-transfer"]').trigger('click')
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('shows max reached hint when maxReached=true', () => {
    const wrapper = mount(PaymentMethodTileGrid, {
      props: {
        maxReached: true,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Máximo 5 pagos')
  })
})
