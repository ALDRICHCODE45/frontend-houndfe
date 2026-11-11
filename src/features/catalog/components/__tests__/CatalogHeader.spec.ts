import { readFileSync } from 'node:fs'
import { DOMWrapper, mount, RouterLinkStub } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import CatalogHeader from '../CatalogHeader.vue'

const catalogCss = readFileSync('src/features/catalog/styles/catalog.css', 'utf8')

describe('CatalogHeader fidelity', () => {
  it.each([false, true])(
    'renders the owned branch portal under html.dark=%s and emits only selection',
    async (dark) => {
      const branch = { id: 'centre', name: 'Centro', slug: 'centro', address: null, phone: null }
      document.documentElement.classList.toggle('dark', dark)
      document.body.setAttribute('data-catalog-theme', 'light')
      const wrapper = mount(CatalogHeader, {
        attachTo: document.body,
        props: {
          branches: [branch],
          state: 'populated',
          selectedBranch: branch,
          priceContextOptions: [],
          priceContextsState: 'populated',
          selectedPriceListId: null,
        },
        global: { stubs: { RouterLink: RouterLinkStub } },
      })
      try {
        expect(document.querySelector('.catalog-branch-dialog')).toBeNull()
        await wrapper.get('[aria-label="Explorar sucursales"]').trigger('click')
        await nextTick()
        const overlay = document.querySelector('.catalog-branch-overlay')
        expect(overlay).not.toBeNull()
        expect(overlay?.className).not.toContain('coco-')
        const option = document.querySelector(
          '.catalog-branch-dialog button[aria-label="Centro"]',
        ) as HTMLElement
        expect(option.getAttribute('aria-current')).toBe('page')
        expect(option.textContent).toContain('Dirección no publicada')
        await new DOMWrapper(option).trigger('click')
        expect(wrapper.emitted('select')).toEqual([['centro']])
        expect(branch).toEqual({ id: 'centre', name: 'Centro', slug: 'centro', address: null, phone: null })
        expect(document.documentElement.classList.contains('dark')).toBe(dark)
      } finally {
        wrapper.unmount()
        document.body.removeAttribute('data-catalog-theme')
        document.documentElement.classList.remove('dark')
      }
    },
  )

  it('pairs catalog portal scrims with the always-light catalog roles', () => {
    // CSS declaration contract only; actual computed cascade/contrast needs the parent browser.
    expect(catalogCss).toMatch(
      /\.catalog-branch-overlay\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--catalog-title\) 45%, transparent\)/,
    )
    // The detail modal is retired (the product is a page now): none of its rules remain.
    expect(catalogCss).not.toContain('catalog-detail-')
  })

  const lists = [
    { priceListId: 'list-1', name: 'Público', isCatalogDefault: true },
    { priceListId: 'list-2', name: 'Mayoreo', isCatalogDefault: false },
  ]
  const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }
  const mountHeader = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
    mount(CatalogHeader, {
      props: {
        branches: [branch],
        state: 'populated',
        selectedBranch: branch,
        priceContextOptions: [],
        priceContextsState: 'populated',
        selectedPriceListId: null,
        ...props,
      },
      slots,
      global: { stubs: { RouterLink: RouterLinkStub } },
    })

  it('uses the real logo as the link home and retains only real catalog controls', () => {
    const wrapper = mountHeader()
    const home = wrapper.getComponent(RouterLinkStub)
    expect(home.props('to')).toEqual({ name: 'public-catalog', params: { branchSlug: 'centro' } })
    expect(home.attributes('aria-label')).toBe('HoundFe, ir al inicio')
    expect(wrapper.get('img').attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(wrapper.get('img').attributes('alt')).toBe('HoundFe')
    expect(wrapper.find('[aria-label="Explorar sucursales"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Buscar en el catálogo"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Ver carrito"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No disponible')
    wrapper.unmount()
  })

  it('labels the branch control with «Sucursal» and the selected name', () => {
    const wrapper = mountHeader()
    const trigger = wrapper.get('[aria-label="Explorar sucursales"]')
    expect(trigger.text()).toContain('Sucursal')
    expect(trigger.text()).toContain('Sucursal Centro')
    wrapper.unmount()
  })

  it('places the category menu and the search the view composes', () => {
    const wrapper = mountHeader(
      {},
      { categories: '<button>Categorías</button>', search: '<form role="search"></form>' },
    )
    expect(wrapper.get('.catalog-header-categories').text()).toBe('Categorías')
    expect(wrapper.find('.catalog-header-search form[role="search"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it.each([
    ['no list', []],
    ['a single list', [lists[0]]],
  ])('hides the price-list selector with %s', (_label, options) => {
    const wrapper = mountHeader({ priceContextOptions: options, selectedPriceListId: 'list-1' })
    expect(wrapper.find('[data-testid="catalog-price-context-selector"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows the discreet price-list selector only with more than one list', () => {
    const wrapper = mountHeader({ priceContextOptions: lists, selectedPriceListId: 'list-2' })
    expect(wrapper.find('[data-testid="catalog-price-context-selector"]').exists()).toBe(true)
    expect(wrapper.get('[aria-label="Lista de precios"]').text()).toContain('Mayoreo')
    wrapper.unmount()
  })

  it('keeps the selector when the only list is not the default, so the visitor can choose it', () => {
    const wrapper = mountHeader({ priceContextOptions: [lists[1]], selectedPriceListId: null })
    expect(wrapper.find('[data-testid="catalog-price-context-selector"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
