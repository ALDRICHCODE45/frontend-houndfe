/**
 * ProductSummaryPanel — identity, the four figures and the readiness checklist.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSummaryPanel from '../ProductSummaryPanel.vue'

const props = {
  name: 'Collar ajustable',
  imageUrl: null,
  isProduct: true,
  sellInPos: true,
  includeInOnlineCatalog: false,
  priceCents: 129900,
  costCents: 80000,
  marginPercent: 38,
  stockTotal: 25,
  checklist: [
    { label: 'Nombre del producto', done: true, disabled: false },
    { label: 'Imágenes disponibles después de crear', done: false, disabled: true },
  ],
  completedItems: 1,
  applicableItems: 1,
  completionPercent: 100,
}

describe('ProductSummaryPanel', () => {
  it('is a labelled aside with the four figures', () => {
    const wrapper = mount(ProductSummaryPanel, { props })
    expect(wrapper.get('aside').attributes('aria-label')).toBe('Resumen operativo del producto')
    expect(wrapper.get('[data-summary="price"]').text()).toBe('$1,299.00')
    expect(wrapper.get('[data-summary="cost"]').text()).toBe('$800.00')
    expect(wrapper.get('[data-summary="stock"]').text()).toBe('25')
    expect(wrapper.text()).toContain('38%')
    expect(wrapper.text()).toContain('Producto')
    expect(wrapper.text()).toContain('POS')
    expect(wrapper.text()).not.toContain('Online')
    wrapper.unmount()
  })

  it('reads a dash for unknown margin and stock, and a negative margin in danger text', () => {
    const unknown = mount(ProductSummaryPanel, {
      props: { ...props, marginPercent: null, stockTotal: null },
    })
    expect(unknown.get('[data-summary="stock"]').text()).toBe('—')
    expect(unknown.text()).toContain('—')
    unknown.unmount()
    const negative = mount(ProductSummaryPanel, { props: { ...props, marginPercent: -5 } })
    expect(negative.find('.text-error').exists()).toBe(true)
    negative.unmount()
  })

  it('speaks each checklist item state and keeps no permanent help paragraph', () => {
    const wrapper = mount(ProductSummaryPanel, { props })
    const items = wrapper.findAll('li')
    expect(items[0]!.text()).toContain(': Completo')
    expect(items[1]!.text()).toContain(': Después de crear')
    expect(wrapper.text()).toContain('1/1')
    expect(wrapper.text()).not.toContain('No indica elegibilidad')
    expect(wrapper.find('progress').attributes('value')).toBe('100')
    wrapper.unmount()
  })

  it('shows the product image or the "Sin imagen" fallback', () => {
    const withImage = mount(ProductSummaryPanel, { props: { ...props, imageUrl: '/img/collar.png' } })
    expect(withImage.get('img').attributes('src')).toBe('/img/collar.png')
    withImage.unmount()
    const without = mount(ProductSummaryPanel, { props })
    expect(without.text()).toContain('Sin imagen')
    without.unmount()
  })
})
