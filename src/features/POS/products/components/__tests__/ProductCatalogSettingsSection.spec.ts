// ProductCatalogSettingsSection.spec.ts — U6 composition and interaction coverage.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductCatalogSettingsSection from '@/features/POS/products/components/ProductCatalogSettingsSection.vue'

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
  it('renders one section card with visible title and control labels, without a purpose paragraph', () => {
    const wrapper = mountSection()

    const section = wrapper.find('[data-testid="catalog-settings-section"]')
    expect(section.exists()).toBe(true)
    expect(section.classes()).toContain('hf-section-card')
    expect(wrapper.findAll('.hf-section-card')).toHaveLength(1)
    expect(wrapper.findAllComponents({ name: 'Card' })).toHaveLength(0)
    expect(wrapper.text()).toContain('Catálogo online')
    expect(wrapper.text()).not.toContain('Controla la visibilidad de precios y stock')
    expect(wrapper.text()).toContain('Ocultar precios')
    expect(wrapper.text()).toContain('Los precios no serán visibles en el catálogo en línea')
    expect(wrapper.text()).toContain('Stock en catálogo')
    expect(wrapper.text()).toContain('Contextos públicos soportados')
  })

  it('shows the supportsAll indicator read-only only when the server reports it', () => {
    expect(mountSection().find('[data-testid="supports-all-note"]').exists()).toBe(false)
    const all = mountSection({ supportsAllCatalogPriceLists: true })
    // T8 D10: «all» means no context is chosen (backend: empty list), so the note must
    // explain the all-off rows instead of contradicting them.
    const note = all.get('[data-testid="supports-all-note"]').text()
    expect(note).toBe(
      'Ningún contexto elegido: el producto se muestra en todos los contextos públicos de la sucursal. Enciende uno o más para limitarlo.',
    )
    expect(note).not.toContain('Soporta todos')
  })

  it('renders public contexts as one list of switch rows and emits the per-ID toggle intent', async () => {
    const wrapper = mountSection({ supportedCatalogPriceListIds: ['pl_a'] })
    const list = wrapper.find('[data-testid="context-list"]')
    const toggle = wrapper.find('[data-testid="context-toggle"]')

    expect(list.element.tagName).toBe('UL')
    expect(list.classes()).toContain('product-switch-list')
    expect(list.classes()).not.toContain('sm:grid-cols-2')
    expect(list.find('li').classes()).toContain('min-w-0')
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('true')

    await toggle.trigger('click')
    expect(wrapper.emitted('toggle-context')).toEqual([['pl_a']])
  })

  it('labels every context switch and explains only the catalog-default row', () => {
    const wrapper = mountSection({
      contexts: [
        { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
        { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
      ],
      supportedCatalogPriceListIds: ['pl_a'],
    })

    const rows = wrapper.findAll('[data-testid="context-list"] > li')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Lista A')
    expect(rows[0]!.text()).toContain('Lista predeterminada del catálogo')
    expect(rows[1]!.text()).toContain('Lista B')
    expect(rows[1]!.text()).not.toContain('Lista predeterminada del catálogo')
    expect(
      wrapper
        .findAll('[data-testid="context-list"] .hf-switch-row__label')
        .map((label) => label.text()),
    ).toEqual(['Lista A', 'Lista B'])
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
      'Configura los contextos públicos de la sucursal en Sistema > Catálogo online para habilitar esta selección',
    )
    expect(
      wrapper.find('[data-testid="hide-price-switch"]').attributes('aria-disabled'),
    ).toBeUndefined()
    expect(
      wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled'),
    ).toBeUndefined()
  })

  it.each([
    {
      name: 'pending',
      state: { settingsLoading: true },
      note: 'settings-loading-note',
      copy: 'Cargando contextos públicos de la sucursal',
    },
    {
      name: 'failed',
      state: { settingsError: true },
      note: 'settings-error-note',
      copy: 'No se pudieron cargar los contextos públicos de la sucursal',
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
        wrapper.find('[data-testid="hide-price-switch"]').attributes('aria-disabled'),
      ).toBeUndefined()
      expect(
        wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled'),
      ).toBeUndefined()
    },
  )

  it('accepted-empty contexts state keeps the disabled labeled control without synthesizing rows', () => {
    const wrapper = mountSection({ contexts: [] })

    expect(wrapper.find('[data-testid="contexts-empty-note"]').text()).toContain(
      'La sucursal no tiene contextos públicos configurados',
    )
    expect(wrapper.find('[data-testid="context-toggle"]').exists()).toBe(false)
    const selector = wrapper.find('[data-testid="contexts-select"]')
    expect(selector.attributes('disabled')).toBeDefined()
    expect(selector.attributes('aria-label')).toBe('Contextos públicos no disponibles')
  })

  it('emits toggle-hide-price via the rendered switch row', async () => {
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

  it('disables the switch, stock select, quantity input, and context switches globally', () => {
    const wrapper = mountSection({
      disabled: true,
      onlineStockPresentation: 'CUSTOM_QUANTITY',
      onlineStockPresentationCustomQty: 0,
      supportedCatalogPriceListIds: ['pl_a'],
    })

    expect(wrapper.find('[data-testid="hide-price-switch"]').attributes('aria-disabled')).toBe('true')
    expect(wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="stock-override-qty"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="context-toggle"]').attributes('aria-disabled')).toBe('true')
  })

  it('a disabled section never emits from its switch rows', async () => {
    const wrapper = mountSection({ disabled: true, supportedCatalogPriceListIds: ['pl_a'] })

    await wrapper.find('[data-testid="hide-price-switch"]').trigger('click')
    await wrapper.find('[data-testid="context-toggle"]').trigger('click')
    expect(wrapper.emitted('toggle-hide-price')).toBeUndefined()
    expect(wrapper.emitted('toggle-context')).toBeUndefined()
  })

  it('previews the product-scope global inheritance when the stock override is null', () => {
    const wrapper = mountSection()
    const preview = wrapper.find('[data-testid="stock-override-preview"]')

    expect(preview.exists()).toBe(true)
    expect(preview.text()).toContain('Usar configuración global')
    expect(preview.text()).toContain(
      'El stock mostrado se toma de la configuración global del catálogo.',
    )
  })

  it.each([
    ['SYSTEM_STATUS', 'Estado detallado', 'Disponible · Pocas piezas · Agotado', null],
    ['ABSTRACT_STATUS', 'Solo disponibilidad', 'Disponible · Agotado', null],
    ['CUSTOM_QUANTITY', 'Mostrar cantidad fija', '4 unidades', 4],
    ['HIDDEN', 'No mostrar stock', 'Sin texto de stock', null],
  ] as const)(
    'previews the %s override with its shared label and public sample',
    (mode, label, sample, quantity) => {
      const wrapper = mountSection({
        onlineStockPresentation: mode,
        onlineStockPresentationCustomQty: quantity,
      })
      const preview = wrapper.find('[data-testid="stock-override-preview"]').text()

      expect(preview).toContain(label)
      expect(preview).toContain(sample)
    },
  )

  it('selects the rendered global-inheritance option and emits the null override pair', async () => {
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
        (element) => element.textContent?.trim() === 'Usar configuración global',
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

// T6e (S1–S3): the section sits on the design system like its ProductDetailView siblings.
describe('ProductCatalogSettingsSection — design system structure', () => {
  const source = readFileSync(
    'src/features/POS/products/components/ProductCatalogSettingsSection.vue',
    'utf8',
  )
  const template = source.slice(source.indexOf('<template>'), source.lastIndexOf('</template>'))

  it('has no UCard or USwitch left in its template', () => {
    expect(template).not.toMatch(/<UCard\b/)
    expect(template).not.toMatch(/<USwitch\b/)
  })

  it('titles the section card «Catálogo online» as a 16px/600 heading', () => {
    const wrapper = mountSection()
    expect(wrapper.get('.hf-section-card__title').text()).toBe('Catálogo online')
    expect(wrapper.get('.hf-section-card__title').element.tagName).toBe('H2')
  })

  it('renders every on/off row as a whole-row switch with its label and description inside', () => {
    const wrapper = mountSection({
      contexts: [
        { priceListId: 'pl_a', name: 'Lista A', isCatalogDefault: true },
        { priceListId: 'pl_b', name: 'Lista B', isCatalogDefault: false },
      ],
    })
    const switches = wrapper.findAll('[role="switch"]')
    expect(switches.map((el) => el.get('.hf-switch-row__label').text())).toEqual([
      'Ocultar precios',
      'Lista A',
      'Lista B',
    ])
    for (const el of switches) {
      expect(el.element.tagName).toBe('BUTTON')
      expect(el.classes()).toContain('hf-switch-row__button')
    }
    expect(switches[0]!.get('.hf-switch-row__desc').text()).toBe(
      'Los precios no serán visibles en el catálogo en línea',
    )
  })

  it('keeps no palette or Nuxt default color utilities in its template', () => {
    expect(template).not.toMatch(/\b(?:text|bg|border)-(?:muted|default|highlighted|elevated)\b/)
  })
})
