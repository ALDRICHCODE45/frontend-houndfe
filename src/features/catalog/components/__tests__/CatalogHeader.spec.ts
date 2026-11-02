import { readFileSync } from 'node:fs'
import { DOMWrapper, mount } from '@vue/test-utils'
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
      /\.catalog-branch-overlay[\s\S]*?\.catalog-detail-overlay\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--catalog-title\) 45%, transparent\)/,
    )
    expect(catalogCss).toMatch(
      /\.catalog-detail-preview-overlay\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--catalog-title\) 70%, transparent\)/,
    )
    expect(catalogCss).toMatch(
      /\.catalog-detail-retry\s*\{[^}]*background:\s*var\(--catalog-action\);[^}]*color:\s*var\(--catalog-on-action\)/,
    )
  })

  it('uses the full project brand and retains only real catalog controls', () => {
    const wrapper = mount(CatalogHeader, {
      props: {
        branches: [],
        state: 'populated',
        selectedBranch: null,
        priceContextOptions: [],
        priceContextsState: 'populated',
        selectedPriceListId: null,
      },
    })
    expect(wrapper.get('img').attributes('src')).toBe('/hounfeLogos/primary.png')
    expect(wrapper.get('img').attributes('alt')).toBe('HoundFe')
    expect(wrapper.find('[aria-label="Explorar sucursales"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Lista de precios"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Buscar en el catálogo"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Ver carrito"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No disponible')
    wrapper.unmount()
  })
})
