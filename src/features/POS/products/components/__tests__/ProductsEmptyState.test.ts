import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsEmptyState from '../ProductsEmptyState.vue'

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(ProductsEmptyState, {
    props,
    global: {
      stubs: {
        UIcon: { template: '<i data-testid="products-empty-glyph" />' },
        Icon: { template: '<i data-testid="products-empty-glyph" />' },
      },
    },
  })
}

describe('ProductsEmptyState', () => {
  it('renders the neutral description plus the default primary products title', () => {
    const wrapper = mountComponent()

    expect(wrapper.get('.products-empty-title').text()).toBe('No se encontraron productos')
    expect(wrapper.get('.products-empty-description').text()).toBe(
      'Los productos aparecerán aquí cuando estén disponibles.',
    )
  })

  it('accepts an optional message override as the title', () => {
    const wrapper = mountComponent({ message: 'Catálogo vacío' })

    expect(wrapper.get('.products-empty-title').text()).toBe('Catálogo vacío')
    // The neutral description is fixed and never context-sensitive.
    expect(wrapper.get('.products-empty-description').text()).toBe(
      'Los productos aparecerán aquí cuando estén disponibles.',
    )
  })

  it('exposes the products-empty presentation hooks on one contained root', () => {
    const wrapper = mountComponent()

    expect(wrapper.get('.products-empty-state').classes()).toEqual(
      expect.arrayContaining(['w-full', 'min-w-0', 'max-w-full']),
    )
    expect(wrapper.find('.products-empty-icon').exists()).toBe(true)
    // The soft tile always renders a glyph (stubbed or the real UIcon svg).
    expect(wrapper.find('.products-empty-icon > *').exists()).toBe(true)
    expect(wrapper.find('.products-empty-title').exists()).toBe(true)
    expect(wrapper.find('.products-empty-description').exists()).toBe(true)
  })

  it('is presentation-only: no actions, counters, or error affordances', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })
})
