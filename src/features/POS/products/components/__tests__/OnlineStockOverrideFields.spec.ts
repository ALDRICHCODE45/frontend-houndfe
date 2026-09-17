// OnlineStockOverrideFields.spec.ts — DOM interaction pins for the shared
// nullable product/variant stock override (REQ-13/REQ-16; reused by WU6):
// clearing emits BOTH flat stock fields as null, non-custom modes serialize a
// null quantity, CUSTOM_QUANTITY keeps the integer with 0 labeled "Mostrar 0".

import { describe, expect, it } from 'vitest'
import { DOMWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import OnlineStockOverrideFields from '@/features/POS/products/components/OnlineStockOverrideFields.vue'

const mountField = (value: Record<string, unknown>, props: Record<string, unknown> = {}) =>
  mountWithUApp(OnlineStockOverrideFields, {
    attachTo: document.body,
    props: { value, ...props },
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

describe('OnlineStockOverrideFields — shared nullable stock override', () => {
  it('renders the visible closed option set and clears through the tenant-default menu option', async () => {
    const wrapper = mountField({ mode: 'HIDDEN', customQuantity: null })

    try {
      await selectRenderedMode(wrapper, 'Predeterminado del tenant')
      expect(
        [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map((option) =>
          option.textContent?.trim(),
        ),
      ).toEqual([])
      expect(wrapper.emitted('change')).toEqual([[{ mode: null, customQuantity: null }]])
    } finally {
      // mountWithUApp returns a child wrapper; the UApp root owns cleanup.
    }
  })

  it('shows the five documented menu options when opened', async () => {
    const wrapper = mountField({ mode: null, customQuantity: null })
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    })

    try {
      await wrapper.find('[data-testid="stock-override-mode"]').trigger('click')
      await nextTick()
      expect(
        [...document.body.querySelectorAll<HTMLElement>('[role="option"]')].map((option) =>
          option.textContent?.trim(),
        ),
      ).toEqual([
        'Predeterminado del tenant',
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

  it.each([
    ['SYSTEM_STATUS', 'Según estado del sistema'],
    ['ABSTRACT_STATUS', 'Según estado abstracto'],
    ['HIDDEN', 'Oculto'],
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
