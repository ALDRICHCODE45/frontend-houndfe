import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import HfMoneyInput from '../HfMoneyInput.vue'

function mountInput(props: Record<string, unknown> = {}) {
  return mount(HfMoneyInput, {
    attachTo: document.body,
    props: { modelValue: null, id: 'monto', 'data-testid': 'money', ...props },
  })
}

const lastModel = (wrapper: ReturnType<typeof mountInput>) => {
  const calls = wrapper.emitted<[number | null]>('update:modelValue') ?? []
  return calls[calls.length - 1]?.[0]
}

const lastValidation = (wrapper: ReturnType<typeof mountInput>) => {
  const calls = wrapper.emitted<[string | null]>('validation') ?? []
  return calls[calls.length - 1]
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('HfMoneyInput', () => {
  it('is a decimal text field with a $ prefix that receives the caller attributes', () => {
    const wrapper = mountInput()
    const input = wrapper.get('input')
    expect(input.attributes('type')).toBe('text')
    expect(input.attributes('inputmode')).toBe('decimal')
    expect(input.attributes('id')).toBe('monto')
    expect(input.attributes('data-testid')).toBe('money')
    expect(wrapper.text()).toContain('$')
  })

  it.each([
    ['70.55', 7055],
    ['70,55', 7055],
    ['1,234.50', 123450],
    ['$1 234.50', 123450],
    ['0.29', 29],
  ])('emits %j as %i cents', async (text, cents) => {
    const wrapper = mountInput()
    await wrapper.get('input').setValue(text)
    expect(lastModel(wrapper)).toBe(cents)
  })

  it('emits null when cleared', async () => {
    const wrapper = mountInput({ modelValue: 7055 })
    await wrapper.get('input').setValue('')
    expect(lastModel(wrapper)).toBeNull()
  })

  it('shows the cents as plain text', () => {
    const wrapper = mountInput({ modelValue: 123450 })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('1234.50')
  })

  it('never emits a value for invalid text and reports the parser error', async () => {
    const wrapper = mountInput()
    await wrapper.get('input').setValue('0,100')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(lastValidation(wrapper)).toEqual([
      'Escribe el monto con punto para los centavos, por ejemplo 70.55.',
    ])
  })

  it('shows the error under the field after blur, linked to the input', async () => {
    const wrapper = mountInput()
    const input = wrapper.get('input')
    await input.setValue('1.005')
    await input.trigger('blur')
    const message = wrapper.get('#monto-message')
    expect(message.text()).toBe('Usa como máximo dos decimales, por ejemplo 70.55.')
    expect(message.attributes('data-tone')).toBe('error')
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain('monto-message')
    expect((input.element as HTMLInputElement).value).toBe('1.005')
  })

  it('applies the bounds in cents', async () => {
    const wrapper = mountInput({ minCents: 1 })
    await wrapper.get('input').setValue('0')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(lastValidation(wrapper)).toEqual(['El monto mínimo es $0.01.'])
  })

  it('normalizes a valid amount to plain text on blur', async () => {
    const wrapper = mountInput()
    const input = wrapper.get('input')
    await input.setValue('1,234.5')
    await wrapper.setProps({ modelValue: 123450 })
    await input.trigger('blur')
    expect((input.element as HTMLInputElement).value).toBe('1234.50')
  })

  it('keeps the typed text while the model matches it', async () => {
    const wrapper = mountInput()
    const input = wrapper.get('input')
    await input.setValue('70,5')
    await wrapper.setProps({ modelValue: 7050 })
    expect((input.element as HTMLInputElement).value).toBe('70,5')
  })

  it('follows a model changed from outside', async () => {
    const wrapper = mountInput({ modelValue: 100 })
    await wrapper.setProps({ modelValue: 7055 })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('70.55')
  })

  it('shows an external error when the text parses', () => {
    const wrapper = mountInput({ modelValue: 100, error: 'El monto supera la deuda.' })
    expect(wrapper.get('#monto-message').text()).toBe('El monto supera la deuda.')
  })
})
