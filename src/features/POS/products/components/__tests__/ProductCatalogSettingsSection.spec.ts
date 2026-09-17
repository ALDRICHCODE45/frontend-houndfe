// ProductCatalogSettingsSection.spec.ts — U6 composition and interaction coverage.

import { describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductCatalogSettingsSection from '../ProductCatalogSettingsSection.vue'

const contexts = [{ priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true }]

const defaultProps = {
  hidePriceInOnlineCatalog: false,
  supportedCatalogPriceListIds: [] as string[],
  supportsAllCatalogPriceLists: false,
  onlineStockPresentation: null,
  onlineStockPresentationCustomQty: null,
  contexts,
  canReadSettings: true,
}

const mountSection = (props: Record<string, unknown> = {}) =>
  mountWithUApp(ProductCatalogSettingsSection, {
    props: { ...defaultProps, ...props },
  })

const mountAttachedSection = (props: Record<string, unknown> = {}) =>
  mountWithUApp(ProductCatalogSettingsSection, {
    attachTo: document.body,
    props: { ...defaultProps, ...props },
  })

describe('ProductCatalogSettingsSection — advanced Catálogo online (REQ-14/REQ-15)', () => {
  it('renders one card with visible title, purpose, and control labels', () => {
    const wrapper = mountSection()

    expect(wrapper.find('[data-testid="catalog-settings-section"]').exists()).toBe(true)
    expect(wrapper.findAllComponents({ name: 'Card' })).toHaveLength(1)
    expect(wrapper.text()).toContain('Catálogo online')
    expect(wrapper.text()).toContain(
      'Controla la visibilidad de precios y stock de este producto en el catálogo público',
    )
    expect(wrapper.text()).toContain('Ocultar precios')
    expect(wrapper.text()).toContain('Los precios no serán visibles en el catálogo en línea')
    expect(wrapper.text()).toContain('Stock en catálogo')
    expect(wrapper.text()).toContain('Contextos públicos soportados')
  })

  it('shows the supportsAll indicator read-only only when the server reports it', () => {
    expect(mountSection().find('[data-testid="supports-all-note"]').exists()).toBe(false)
    const all = mountSection({ supportsAllCatalogPriceLists: true })
    expect(all.find('[data-testid="supports-all-note"]').text()).toContain(
      'Soporta todos los contextos públicos del tenant',
    )
  })

  it('renders public contexts as a responsive grid and emits the per-ID toggle intent', async () => {
    const wrapper = mountSection({ supportedCatalogPriceListIds: ['pl_a'] })
    const list = wrapper.find('[data-testid="context-list"]')
    const toggle = wrapper.find('[data-testid="context-toggle"]')

    expect(list.classes()).toContain('grid')
    expect(list.classes()).toContain('grid-cols-1')
    expect(list.classes()).toContain('sm:grid-cols-2')
    expect(list.find('li').classes()).toContain('min-w-0')
    expect(toggle.attributes('aria-checked')).toBe('true')

    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-context')).toEqual([['pl_a']])
  })

  it('without settings-read, hides cached rows and renders a labeled disabled contexts control', () => {
    const wrapper = mountSection({
      canReadSettings: false,
      contexts,
      supportedCatalogPriceListIds: ['pl_a'],
    })

    expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
    const selector = wrapper.find('[data-testid="contexts-select"]')
    expect(selector.attributes('disabled')).toBeDefined()
    expect(selector.attributes('aria-label')).toBe('Contextos públicos no disponibles')
    expect(wrapper.find('[data-testid="contexts-gated-note"]').text()).toContain(
      'Configura los contextos públicos del tenant en Sistema > Catálogo online para habilitar esta selección',
    )
    expect(wrapper.find('[data-testid="hide-price-switch"]').attributes('disabled')).toBeUndefined()
    expect(
      wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it.each([
    {
      name: 'pending',
      state: { settingsLoading: true },
      note: 'settings-loading-note',
      copy: 'Cargando contextos públicos del tenant',
    },
    {
      name: 'failed',
      state: { settingsError: true },
      note: 'settings-error-note',
      copy: 'No se pudieron cargar los contextos públicos del tenant',
    },
  ] as const)(
    '$name settings query hides cached rows and renders a disabled labeled contexts control',
    ({ state, note, copy }) => {
      const wrapper = mountSection({ contexts, ...state })

      expect(wrapper.find(`[data-testid="${note}"]`).text()).toContain(copy)
      expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
      const selector = wrapper.find('[data-testid="contexts-select"]')
      expect(selector.attributes('disabled')).toBeDefined()
      expect(selector.attributes('aria-label')).toBe('Contextos públicos no disponibles')
      expect(
        wrapper.find('[data-testid="hide-price-switch"]').attributes('disabled'),
      ).toBeUndefined()
      expect(
        wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled'),
      ).toBeUndefined()
    },
  )

  it('accepted-empty contexts state keeps the disabled labeled control without synthesizing rows', () => {
    const wrapper = mountSection({ contexts: [] })

    expect(wrapper.find('[data-testid="contexts-empty-note"]').text()).toContain(
      'El tenant no tiene contextos públicos configurados',
    )
    expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
    const selector = wrapper.find('[data-testid="contexts-select"]')
    expect(selector.attributes('disabled')).toBeDefined()
    expect(selector.attributes('aria-label')).toBe('Contextos públicos no disponibles')
  })

  it('emits toggle-hide-price via the rendered USwitch', async () => {
    const wrapper = mountSection({ hidePriceInOnlineCatalog: false })

    await wrapper.find('[data-testid="hide-price-switch"]').trigger('click')
    expect(wrapper.emitted('toggle-hide-price')).toEqual([[true]])
  })

  it('preserves literal custom quantity 0 and normalizes negative quantity to 0', async () => {
    const wrapper = mountSection({
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
    })
    const qtyInput = wrapper.find('[data-testid="stock-override-qty"]')

    expect(wrapper.text()).toContain('Cantidad a mostrar')
    expect(wrapper.text()).toContain('Mostrar 0')
    await qtyInput.setValue('0')
    await qtyInput.setValue('-3')
    expect(wrapper.emitted('stock-change')).toEqual([
      [{ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }],
      [{ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }],
    ])
  })

  it('disables the switch, stock select, quantity input, and context checkbox globally', () => {
    const wrapper = mountSection({
      disabled: true,
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
      supportedCatalogPriceListIds: ['pl_a'],
    })

    expect(wrapper.find('[data-testid="hide-price-switch"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="stock-override-qty"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="context-toggle"]').attributes('disabled')).toBeDefined()
  })

  it('selects the rendered Predeterminado del tenant option and emits the null override pair', async () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })

    try {
      const wrapper = mountAttachedSection({
        onlineStockPresentation: 'HIDDEN',
        onlineStockPresentationCustomQty: null,
      })
      await wrapper.find('[data-testid="stock-override-mode"]').trigger('click')
      await nextTick()

      const option = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (element) => element.textContent?.trim() === 'Predeterminado del tenant',
      )
      expect(option).toBeDefined()

      await new DOMWrapper(option!).trigger('click')
      await nextTick()
      expect(wrapper.emitted('stock-change')).toEqual([[{ mode: null, customQuantity: null }]])
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        })
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
      }
    }
  })
})
