import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import UInputNumber from '@nuxt/ui/runtime/components/InputNumber.vue'
import { es } from '@nuxt/ui/locale'
import { appLocale } from '../app-locale'

// T22/S18: Reka's NumberField parses with the UApp locale. Under plain `es`
// «1.5» was read as 15 (a dot is the Spanish group separator); the app locale
// is Mexican, so a dot is the decimal separator.
function mountQuantity(locale: typeof es, props: Record<string, unknown> = { step: 0.01, formatOptions: { maximumFractionDigits: 2 } }) {
  const value = ref<number | null>(null)
  const Host = defineComponent({
    setup: () => () =>
      h(UApp, { locale, toaster: null }, {
        default: () =>
          h(UInputNumber, {
            ...props,
            modelValue: value.value,
            'onUpdate:modelValue': (next: number | null) => (value.value = next),
          }),
      }),
  })
  return { wrapper: mount(Host, { attachTo: document.body }), value }
}

async function type(wrapper: ReturnType<typeof mount>, text: string) {
  const input = wrapper.get('input')
  await input.setValue(text)
  await input.trigger('blur')
}

describe('appLocale', () => {
  it('is the Spanish UI copy with the Mexican number code', () => {
    expect(appLocale.code).toBe('es-MX')
    expect(appLocale.messages).toBe(es.messages)
  })

  it.each([
    ['1.5', 1.5],
    ['70.55', 70.55],
    ['1,234.5', 1234.5],
  ])('reads %j as %d in a quantity field', async (text, expected) => {
    const { wrapper, value } = mountQuantity(appLocale)
    await type(wrapper, text)
    expect(value.value).toBe(expected)
    wrapper.unmount()
  })

  it('differs from plain es, which reads «1.5» as 15', async () => {
    const { wrapper, value } = mountQuantity(es)
    await type(wrapper, '1.5')
    expect(value.value).toBe(15)
    wrapper.unmount()
  })

  // The cart and quotation quantity steppers are integers (`:min="1"`, no
  // fraction digits): «1.5» rounds to 2 pieces instead of becoming 15.
  it.each([
    [appLocale, 2],
    [es, 15],
  ])('rounds «1.5» in an integer stepper', async (locale, expected) => {
    const { wrapper, value } = mountQuantity(locale, { min: 1 })
    await type(wrapper, '1.5')
    expect(value.value).toBe(expected)
    wrapper.unmount()
  })
})
