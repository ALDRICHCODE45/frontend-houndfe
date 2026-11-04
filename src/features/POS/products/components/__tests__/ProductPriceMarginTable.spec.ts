/**
 * ProductPriceMarginTable — price lists with margin and gain over the cost,
 * and the ⋮ menu (Precios por cantidad, Quitar last).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductPriceMarginTable, { type ProductPriceRow } from '../ProductPriceMarginTable.vue'

const rows: ProductPriceRow[] = [
  { id: 'a', name: 'Público', priceCents: 20000, removable: false },
  { id: 'b', name: 'Mayoreo', priceCents: 8000, removable: true },
]

function mountTable(props: Record<string, unknown> = {}) {
  return mount(ProductPriceMarginTable, {
    attachTo: document.body,
    props: { rows, costCents: 10000, ...props },
  })
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 50))
const menuItems = () => Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'))
const labels = () => menuItems().map((item) => (item.textContent ?? '').trim())

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProductPriceMarginTable', () => {
  it('shows margin and gain, in danger text when the price is under the cost', () => {
    const wrapper = mountTable()
    const [publico, mayoreo] = wrapper.findAll('tbody tr')
    expect(publico!.text()).toContain('50%')
    expect(publico!.text()).toContain('$100.00')
    expect(publico!.find('.text-success').exists()).toBe(true)
    expect(mayoreo!.text()).toContain('-25%')
    expect(mayoreo!.find('.text-error').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows "--" until the cost is known', () => {
    const wrapper = mountTable({ costCents: 0 })
    expect(wrapper.findAll('tbody tr')[0]!.text()).toContain('--')
    wrapper.unmount()
  })

  it('keeps the default list out of Quitar', async () => {
    const wrapper = mountTable()
    const triggers = wrapper.findAll('button[aria-haspopup="menu"]')
    expect(triggers[0]!.attributes('aria-label')).toBe('Acciones de la lista Público')
    await triggers[0]!.trigger('click')
    await tick()
    expect(labels()).toEqual(['Precios por cantidad'])
    wrapper.unmount()
  })

  it('puts Quitar last and emits it with the row id', async () => {
    const wrapper = mountTable()
    const triggers = wrapper.findAll('button[aria-haspopup="menu"]')
    expect(triggers[1]!.attributes('aria-label')).toBe('Acciones de la lista Mayoreo')
    await triggers[1]!.trigger('click')
    await tick()
    expect(labels()).toEqual(['Precios por cantidad', 'Quitar'])
    menuItems().find((item) => item.textContent?.trim() === 'Quitar')!.click()
    await tick()
    expect(wrapper.emitted('action')).toEqual([['remove', 'b']])
    wrapper.unmount()
  })

  it('emits the price in cents when the input loses focus', async () => {
    const wrapper = mountTable()
    const input = wrapper.get('input[inputmode="decimal"]')
    ;(input.element as HTMLInputElement).value = '99.5'
    await input.trigger('blur')
    expect(wrapper.emitted('update-price')).toEqual([['a', 9950]])
    wrapper.unmount()
  })
})
