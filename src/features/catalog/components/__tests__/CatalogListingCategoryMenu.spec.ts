import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import CatalogListingCategoryMenu from '../CatalogListingCategoryMenu.vue'

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }
const categories = [
  { id: 'cat-food', name: 'Alimento para gato', count: 7 },
  { id: 'dog-food', name: 'Alimento para perro', count: 6 },
]
type MenuProps = {
  categories: typeof categories
  allTotal: number | null
  selectedId: string | null
  state: 'populated' | 'loading' | 'server'
  contextMismatch: boolean
  combinedError: boolean
}
const baseProps: MenuProps = {
  categories,
  allTotal: 38,
  selectedId: null,
  state: 'populated',
  contextMismatch: false,
  combinedError: false,
}
const mountMenu = (props: Partial<MenuProps> = {}) =>
  mount(CatalogListingCategoryMenu, {
    attachTo: document.body,
    props: { ...baseProps, ...props },
    global: { stubs },
  })
const trigger = (wrapper: ReturnType<typeof mountMenu>) =>
  wrapper.get('button[aria-expanded]')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('CatalogListingCategoryMenu', () => {
  it('is one closed «Categorías» button until the visitor opens it', async () => {
    const wrapper = mountMenu()
    expect(trigger(wrapper).text()).toContain('Categorías')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="catalog-category-menu"]').exists()).toBe(false)

    await trigger(wrapper).trigger('click')
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
    const panel = wrapper.get('[data-testid="catalog-category-menu"]')
    expect(trigger(wrapper).attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(
      panel.findAll('button').map((button) => button.text().replace(/\s+/g, ' ')),
    ).toEqual(['Todas las categorías 38', 'Alimento para gato 7', 'Alimento para perro 6'])
  })

  it('marks the current category, emits the choice and closes', async () => {
    const wrapper = mountMenu({ selectedId: 'dog-food' })
    await trigger(wrapper).trigger('click')
    const buttons = wrapper.findAll('[data-testid="catalog-category-menu"] button')
    expect(buttons.map((button) => button.attributes('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ])
    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['cat-food']])
    expect(wrapper.find('[data-testid="catalog-category-menu"]').exists()).toBe(false)

    await trigger(wrapper).trigger('click')
    await wrapper.findAll('[data-testid="catalog-category-menu"] button')[0]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([['cat-food'], [null]])
  })

  it('closes on Escape and returns focus to its trigger', async () => {
    const wrapper = mountMenu()
    await trigger(wrapper).trigger('click')
    await wrapper.get('[data-testid="catalog-category-menu"]').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(wrapper.find('[data-testid="catalog-category-menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger(wrapper).element)
  })

  it('says when categories failed and offers their own Reintentar', async () => {
    const wrapper = mountMenu({ categories: [], allTotal: null, state: 'server' })
    await trigger(wrapper).trigger('click')
    const panel = wrapper.get('[data-testid="catalog-category-menu"]')
    expect(panel.text()).toContain('No pudimos cargar las categorías')
    await panel.get('[data-testid="catalog-retry-categories"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('never offers categories from another price list', async () => {
    const wrapper = mountMenu({ contextMismatch: true })
    await trigger(wrapper).trigger('click')
    const panel = wrapper.get('[data-testid="catalog-category-menu"]')
    expect(panel.text()).toContain('Las categorías no coinciden con la lista de precios actual.')
    expect(panel.text()).not.toContain('Alimento para gato')
  })

  it('stays quiet when the listing below already shows the failure', async () => {
    const wrapper = mountMenu({ categories: [], allTotal: null, state: 'server', combinedError: true })
    await trigger(wrapper).trigger('click')
    expect(wrapper.find('[data-testid="catalog-retry-categories"]').exists()).toBe(false)
  })
})
