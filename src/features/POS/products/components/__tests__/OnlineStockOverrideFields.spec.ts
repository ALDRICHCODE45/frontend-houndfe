// OnlineStockOverrideFields.spec.ts — DOM interaction pins for the shared
// nullable product/variant stock override (REQ-13/REQ-16; reused by WU6):
// clearing emits BOTH flat stock fields as null, non-custom modes serialize a
// null quantity, CUSTOM_QUANTITY keeps the integer with 0 labeled "Mostrar 0".
//
// U8 pins the contextual inheritance copy: the product scope resolves a null
// override as "Usar configuración global" and the variant scope as
// "Usar configuración del producto". The four mode labels and the
// selected-mode preview come from the shared `stockPresentationUi` module.

import { describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import OnlineStockOverrideFields from '@/features/POS/products/components/OnlineStockOverrideFields.vue'

const mountField = (value: Record<string, unknown>, props: Record<string, unknown> = {}) =>
  mountWithUApp(OnlineStockOverrideFields, {
    attachTo: document.body,
    props: { value, inheritanceScope: 'product', ...props },
  })

async function selectRenderedMode(wrapper: ReturnType<typeof mountField>, label: string) {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })

  try {
    await wrapper.find('[data-testid="stock-override-mode"]').trigger('click')
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

async function renderedOptionLabels(wrapper: ReturnType<typeof mountField>) {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  })

  try {
    await wrapper.find('[data-testid="stock-override-mode"]').trigger('click')
    await nextTick()
    // Scope to the newest popup: earlier tests in this file leave their own
    // portal content in document.body, so a document-wide query would read it.
    const listboxes = [...document.body.querySelectorAll<HTMLElement>('[role="listbox"]')]
    const latest = listboxes[listboxes.length - 1]
    return [...(latest?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])].map((option) =>
      option.textContent?.trim(),
    )
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

describe('OnlineStockOverrideFields — shared nullable stock override', () => {
  it('renders the visible closed option set and clears through the inheritance option', async () => {
    const wrapper = mountField({ mode: 'HIDDEN', customQuantity: null })

    try {
      await selectRenderedMode(wrapper, 'Usar configuración global')
      expect(wrapper.emitted('change')).toEqual([[{ mode: null, customQuantity: null }]])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('renders the five documented customer-facing options for the product scope', async () => {
    const wrapper = mountField({ mode: null, customQuantity: null })

    expect(await renderedOptionLabels(wrapper)).toEqual([
      'Usar configuración global',
      'Estado detallado',
      'Solo disponibilidad',
      'Mostrar cantidad fija',
      'No mostrar stock',
    ])
  })

  it('renders the product inheritance option for the product scope', async () => {
    const wrapper = mountField({ mode: null, customQuantity: null })

    expect((await renderedOptionLabels(wrapper))[0]).toBe('Usar configuración global')
  })

  it('renders the variant inheritance option for the variant scope', async () => {
    const wrapper = mountField(
      { mode: null, customQuantity: null },
      { inheritanceScope: 'variant' },
    )

    expect((await renderedOptionLabels(wrapper))[0]).toBe('Usar configuración del producto')
  })

  it('explains the product override inheritance through the matching description', () => {
    const wrapper = mountField({ mode: null, customQuantity: null })
    const preview = wrapper.find('[data-testid="stock-override-preview"]')

    expect(preview.exists()).toBe(true)
    expect(preview.text()).toContain('Usar configuración global')
    expect(preview.text()).toContain(
      'El stock mostrado se toma de la configuración global del catálogo.',
    )
    expect(preview.text()).toContain('Stock según la configuración global del catálogo')
  })

  it('explains the variant override inheritance through the matching description', () => {
    const wrapper = mountField(
      { mode: null, customQuantity: null },
      { inheritanceScope: 'variant' },
    )
    const preview = wrapper.find('[data-testid="stock-override-preview"]')

    expect(preview.text()).toContain('Usar configuración del producto')
    expect(preview.text()).toContain('El stock mostrado se toma de la configuración del producto.')
    expect(preview.text()).toContain('Stock según la configuración del producto')
  })

  it('previews the selected explicit mode without claiming operational availability', () => {
    const wrapper = mountField({ mode: 'HIDDEN', customQuantity: null })
    const preview = wrapper.find('[data-testid="stock-override-preview"]').text()

    expect(preview).toContain('No mostrar stock')
    expect(preview).toContain(
      'No muestra ningún texto de stock en el catálogo; las validaciones de venta siguen usando las existencias reales.',
    )
    expect(preview).toContain('Sin texto de stock')
  })

  it.each([
    ['SYSTEM_STATUS', 'Estado detallado'],
    ['ABSTRACT_STATUS', 'Solo disponibilidad'],
    ['HIDDEN', 'No mostrar stock'],
  ] as const)('%s serializes customQuantity as null', async (mode, label) => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 4 })

    try {
      await selectRenderedMode(wrapper, label)
      expect(wrapper.emitted('change')).toEqual([[{ mode, customQuantity: null }]])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('CUSTOM_QUANTITY keeps the quantity and labels 0 literally as "Mostrar 0"', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })

    try {
      expect(wrapper.text()).toContain('Mostrar 0')
      expect(wrapper.find('[data-testid="stock-override-preview"]').text()).toContain(
        'Mostrar cantidad fija',
      )
      // Public storefront wording: the catalog renders `${quantity} unidades`.
      expect(wrapper.find('[data-testid="stock-override-preview"]').text()).toContain('0 unidades')
      const input = wrapper.find('[data-testid="stock-override-qty"]')
      expect((input.element as HTMLInputElement).value).toBe('0')
      await input.setValue('3')
      expect(wrapper.emitted('change')).toEqual([[{ mode: 'CUSTOM_QUANTITY', customQuantity: 3 }]])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('disables both rendered controls when disabled', () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 }, { disabled: true })

    try {
      expect(
        wrapper.find('[data-testid="stock-override-mode"]').attributes('disabled'),
      ).toBeDefined()
      expect(
        wrapper.find('[data-testid="stock-override-qty"]').attributes('disabled'),
      ).toBeDefined()
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })
})
