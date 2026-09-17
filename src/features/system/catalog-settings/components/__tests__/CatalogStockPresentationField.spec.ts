// CatalogStockPresentationField.spec.ts — DOM interaction tests for the WU3B
// stock-presentation default field (REQ-8). The closed four-mode set emits a
// null quantity outside CUSTOM_QUANTITY; CUSTOM_QUANTITY preserves literal 0.

import { describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import CatalogStockPresentationField from '@/features/system/catalog-settings/components/CatalogStockPresentationField.vue'
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
  it('renders the four documented modes with Spanish labels in the opened menu', async () => {
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
        'Según estado del sistema',
        'Según estado abstracto',
        'Cantidad personalizada',
        'Oculto',
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
      await selectRenderedMode(wrapper, 'Según estado abstracto')
      expect(wrapper.emitted('change')).toEqual([
        [{ mode: 'ABSTRACT_STATUS', customQuantity: null }],
      ])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('preserves custom 0 literally and changes quantity through the rendered input', async () => {
    const wrapper = mountField({ mode: 'CUSTOM_QUANTITY', customQuantity: 0 })

    try {
      expect(wrapper.text()).toContain('Mostrar 0')
      expect(wrapper.text()).toContain('Cantidad a mostrar')
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
