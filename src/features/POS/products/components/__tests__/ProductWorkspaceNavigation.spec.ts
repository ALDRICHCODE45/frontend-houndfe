import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductWorkspaceNavigation from '../ProductWorkspaceNavigation.vue'

const source = readFileSync(resolve(__dirname, '../ProductWorkspaceNavigation.vue'), 'utf8')

describe('ProductWorkspaceNavigation', () => {
  it('lists the four tasks and marks the active one', () => {
    const wrapper = mount(ProductWorkspaceNavigation, { props: { activeTask: 'presentations' } })
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([
      'Identidad',
      'Presentaciones',
      'Contenido',
      'Revisar',
    ])
    expect(wrapper.get('[data-task="presentations"]').attributes('aria-current')).toBe('page')
  })

  it('gives every tab its own horizontal padding so long labels never touch at 390', () => {
    // Four equal `minmax(0, 1fr)` columns left "Presentaciones" and "Contenido" touching.
    expect(source).not.toMatch(/grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
    expect(source).toMatch(/\.product-task-button\s*\{[^}]*padding:\s*12px 8px/)
  })

  it('adds the Inventario task last when asked', () => {
    const wrapper = mount(ProductWorkspaceNavigation, { props: { activeTask: 'inventory', showInventory: true } })
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([
      'Identidad',
      'Presentaciones',
      'Contenido',
      'Revisar',
      'Inventario',
    ])
    expect(wrapper.get('[data-task="inventory"]').attributes('aria-current')).toBe('page')
  })

  it('does not list Inventario by default', () => {
    const wrapper = mount(ProductWorkspaceNavigation, { props: { activeTask: 'identity' } })
    expect(wrapper.find('[data-task="inventory"]').exists()).toBe(false)
  })

  it('is one scrolling strip, not a fixed-column grid, so five tasks fit at 390', () => {
    expect(source).not.toMatch(/repeat\(4,/)
    expect(source).toMatch(/grid-auto-flow:\s*column/)
    expect(source).toMatch(/overflow-x:\s*auto/)
  })

  describe('scroll cue', () => {
    function measure(nav: HTMLElement, sizes: { scrollWidth: number; clientWidth: number; scrollLeft: number }) {
      Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: sizes.scrollWidth })
      Object.defineProperty(nav, 'clientWidth', { configurable: true, value: sizes.clientWidth })
      nav.scrollLeft = sizes.scrollLeft
    }

    it('flags more tasks off-screen at the end, then at the start once scrolled', async () => {
      const wrapper = mount(ProductWorkspaceNavigation, {
        props: { activeTask: 'identity', showInventory: true },
        attachTo: document.body,
      })
      const nav = wrapper.get('nav')
      measure(nav.element, { scrollWidth: 460, clientWidth: 358, scrollLeft: 0 })
      await nav.trigger('scroll')
      expect(nav.attributes('data-more')).toBe('true')
      expect(nav.attributes('data-less')).toBe('false')

      measure(nav.element, { scrollWidth: 460, clientWidth: 358, scrollLeft: 102 })
      await nav.trigger('scroll')
      expect(nav.attributes('data-more')).toBe('false')
      expect(nav.attributes('data-less')).toBe('true')
      wrapper.unmount()
    })

    it('draws the fade from those flags', () => {
      expect(source).toMatch(/\[data-more='true'\]\s*\{[^}]*mask-image/)
      expect(source).toMatch(/\[data-less='true'\]\s*\{[^}]*mask-image/)
    })
  })
})
