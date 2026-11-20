import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReservedStockLabel, { hasReservedStock, reservedStockText } from '../ReservedStockLabel.vue'

describe('ReservedStockLabel', () => {
  it('shows available and reserved separately', () => {
    const wrapper = mount(ReservedStockLabel, { props: { available: 3, reserved: 2 } })
    expect(wrapper.get('[data-testid="reserved-stock"]').text()).toBe('Disponible 3 · Apartado 2')
  })

  it('uses the warning token for the reserved part, never red', () => {
    const wrapper = mount(ReservedStockLabel, { props: { available: 0, reserved: 5 } })
    const html = wrapper.html()
    expect(html).toContain('text-(--hf-warning)')
    expect(html).not.toMatch(/danger|red-|error/)
    expect(wrapper.text()).not.toMatch(/sin stock/i)
  })

  it('formats the owner copy «Disponible 3 · Apartado 2»', () => {
    expect(reservedStockText(3, 2)).toBe('Disponible 3 · Apartado 2')
  })

  it.each([
    [undefined, false],
    [null, false],
    [0, false],
    [1, true],
    [2, true],
  ])('hasReservedStock(%s) is %s', (value, expected) => {
    expect(hasReservedStock(value)).toBe(expected)
  })
})
