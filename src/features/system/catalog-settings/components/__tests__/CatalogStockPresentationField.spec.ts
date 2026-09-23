// CatalogStockPresentationField.spec.ts — DOM interaction tests for the WU3B
// stock-presentation default field (REQ-8). The closed four-mode set emits a
// null quantity outside CUSTOM_QUANTITY; CUSTOM_QUANTITY preserves literal 0.
//
// U8 pins the customer-facing copy: the four labels, the honest mode
// explanations, and the selected-mode preview come from the shared
// catalog-settings-local `stockPresentationUi` module. Presentation copy is
// public-display policy only; operational stock stays the sellability
// authority, and the assertions below keep that claim honest.

import { describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogStockPresentationField from '../CatalogStockPresentationField.vue'
import type { CatalogStockPresentationDefaultDto } from '../../interfaces/catalog-settings.types'

function mountField(
  stockDefault: CatalogStockPresentationDefaultDto = {
    mode: 'SYSTEM_STATUS',
    customQuantity: null,
  },
  disabled = false,
) {
  return mountWithUApp(CatalogStockPresentationField, {
    attachTo: document.body,
    props: { stockDefault, disabled },
  })
}

async function selectRenderedMode(wrapper: ReturnType<typeof mountField>, label: string) {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })

  try {
    await wrapper.find('[data-testid="stock-mode-select"]').trigger('click')
    await nextTick()
    const options = [...document.body.querySelectorAll<HTMLElement>('[role="option"]')]
    const option = options.reverse().find((element) => element.textContent?.trim() === label)
    expect(option).toBeDefined()
    await new DOMWrapper(option!).trigger('click')
    await nextTick()
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
}

describe('CatalogStockPresentationField — closed mode set (REQ-8)', () => {
  it('renders the four documented customer-facing modes in the opened menu', async () => {
    const wrapper = mountField()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })

    try {
      await wrapper.find('[data-testid="stock-mode-select"]').trigger('click')
      await nextTick()
      expect(
        [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map((option) =>
          option.textContent?.trim(),
        ),
      ).toEqual([
        'Estado detallado',
        'Solo disponibilidad',
        'Mostrar cantidad fija',
        'No mostrar stock',
      ])
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

  it('changing to a non-custom mode emits that mode with a null quantity', async () => {
    const wrapper = mountField()

    try {
      await selectRenderedMode(wrapper, 'Solo disponibilidad')
      expect(wrapper.emitted('change')).toEqual([
        [{ mode: 'ABSTRACT_STATUS', customQuantity: null }],
      ])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('explains the detailed mode as operational status without publishing quantities', () => {
    const wrapper = mountField({ mode: 'SYSTEM_STATUS', customQuantity: null })
    const preview = wrapper.find('[data-testid="stock-mode-preview"]')

    expect(preview.exists()).toBe(true)
    expect(preview.text()).toContain('Estado detallado')
    expect(preview.text()).toContain(
      'Muestra Disponible, Pocas piezas o Agotado según las existencias reales, sin publicar cantidades.',
    )
    expect(preview.text()).toContain('Disponible · Pocas piezas · Agotado')
  })

  it('suppresses low-stock disclosure copy in the availability-only preview', () => {
    const wrapper = mountField({ mode: 'ABSTRACT_STATUS', customQuantity: null })
    const preview = wrapper.find('[data-testid="stock-mode-preview"]').text()

    expect(preview).toContain('Solo disponibilidad')
    expect(preview).toContain(
      'Muestra solo Disponible o Agotado, sin revelar cuándo queda poco stock.',
    )
    expect(preview).toContain('Disponible · Agotado')
    expect(preview).not.toContain('Pocas piezas')
  })

  it('states that the fixed quantity is display-only and never unlocks sales', () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 3 })
    const preview = wrapper.find('[data-testid="stock-mode-preview"]').text()

    expect(preview).toContain('Mostrar cantidad fija')
    expect(preview).toContain(
      'Muestra siempre la cantidad definida como dato informativo; no cambia las existencias y la venta sigue bloqueada si no hay stock real.',
    )
    // Public storefront wording: the catalog renders `${quantity} unidades`.
    expect(preview).toContain('3 unidades')
  })

  it('keeps the hidden preview free of stock text while noting operational validation', () => {
    const wrapper = mountField({ mode: 'HIDDEN', customQuantity: null })
    const preview = wrapper.find('[data-testid="stock-mode-preview"]').text()

    expect(preview).toContain('No mostrar stock')
    expect(preview).toContain(
      'No muestra ningún texto de stock en el catálogo; las validaciones de venta siguen usando las existencias reales.',
    )
    expect(preview).toContain('Sin texto de stock')
  })

  it('preserves custom 0 literally and changes quantity through the rendered input', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })

    try {
      expect(wrapper.text()).toContain('Mostrar 0')
      expect(wrapper.text()).toContain('Cantidad a mostrar')
      expect(wrapper.find('[data-testid="stock-mode-preview"]').text()).toContain('0 unidades')
      const input = wrapper.find('[data-testid="stock-quantity-input"]')
      await input.setValue('5')
      expect(wrapper.emitted('change')).toEqual([[{ mode: 'CUSTOM_QUANTITY', customQuantity: 5 }]])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('keeps CUSTOM_QUANTITY when the rendered quantity input changes to 0', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 2 })

    try {
      await wrapper.find('[data-testid="stock-quantity-input"]').setValue('0')
      expect(wrapper.emitted('change')).toEqual([[{ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }]])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('disables every rendered control when disabled is passed', () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }, true)

    try {
      expect(wrapper.find('[data-testid="stock-mode-select"]').attributes('disabled')).toBeDefined()
      expect(
        wrapper.find('[data-testid="stock-quantity-input"]').attributes('disabled'),
      ).toBeDefined()
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })
})
