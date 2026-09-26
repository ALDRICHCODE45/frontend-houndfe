import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import LoginOtpForm from '../LoginOtpForm.vue'

const UForm = defineComponent({
  props: ['state', 'schema'],
  emits: ['submit'],
  setup(_, { slots, emit }) {
    return () =>
      h(
        'form',
        {
          onSubmit: (e: Event) => {
            e.preventDefault()
            emit('submit')
          },
        },
        slots.default?.(),
      )
  },
})
const UInput = defineComponent({
  props: ['modelValue'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        value: props.modelValue,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value),
      })
  },
})
const UButton = defineComponent({
  props: ['loading'],
  setup(_, { slots }) {
    return () => h('button', {}, slots.default?.())
  },
})
function render(props = {}) {
  return mount(LoginOtpForm, {
    props: {
      loading: false,
      error: null,
      restartRequired: false,
      resendSeconds: 0,
      expiresSeconds: 600,
      retrySeconds: 0,
      ...props,
    },
    global: {
      stubs: {
        UForm,
        Form: UForm,
        UInput,
        Input: UInput,
        UButton,
        Button: UButton,
        FormField: { template: '<label><slot /></label>' },
        Alert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
      },
    },
  })
}

describe('LoginOtpForm', () => {
  it('emits a trimmed string code preserving zeros and exposes autocomplete', async () => {
    const wrapper = render()
    const input = wrapper.get('input')
    expect(input.attributes('autocomplete')).toBe('one-time-code')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('type')).toBe('text')
    await input.setValue(' 001234 ')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('verify')).toEqual([['001234']])
  })

  it.each(['12345', '1234567', '１２３４５６', '12 3456'])(
    'does not submit invalid code %s',
    async (code) => {
      const wrapper = render()
      await wrapper.get('input').setValue(code)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.emitted('verify')).toBeUndefined()
    },
  )

  it('disables actions during loading or server cooldown, but permits restart', async () => {
    const wrapper = render({ loading: true, resendSeconds: 30, retrySeconds: 20 })
    await wrapper.get('input').setValue('001234')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('verify')).toBeUndefined()
    expect(wrapper.get('[data-test="resend"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-test="restart"]').trigger('click')
    expect(wrapper.emitted('restart')).toHaveLength(1)
    await wrapper.setProps({ loading: false, resendSeconds: 0, retrySeconds: 0 })
    await wrapper.get('[data-test="resend"]').trigger('click')
    expect(wrapper.emitted('resend')).toHaveLength(1)
  })

  it('shows a generic restart-only error when the handle is unusable', () => {
    const wrapper = render({ restartRequired: true, error: 'Vuelve a iniciar sesión.' })
    expect(wrapper.text()).toContain('Vuelve a iniciar sesión.')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('[data-test="resend"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="restart"]').exists()).toBe(true)
  })
})
