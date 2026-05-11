import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentModal from '../PaymentModal.vue'

const modalStub = {
  template: '<div><slot name="body" /><slot name="footer" /></div>',
}

const buttonStub = {
  props: ['disabled', 'loading'],
  template: '<button :disabled="disabled"><slot name="leading" /><slot /></button>',
}

const inputNumberStub = {
  props: ['modelValue', 'disabled', 'readonly'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
}

const formFieldStub = {
  props: ['label', 'help', 'error'],
  template: '<label><span>{{ label }}</span><slot /><p v-if="help">{{ help }}</p><p v-if="error">{{ error }}</p></label>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UInputNumber: inputNumberStub,
  InputNumber: inputNumberStub,
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
  URadioGroup: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}

describe('PaymentModal', () => {
  it('renders only supported payment methods', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const html = wrapper.html()
    expect(html).toContain('Efectivo')
    expect(html).toContain('Tarjeta crédito')
    expect(html).toContain('Tarjeta débito')
    expect(html).toContain('Transferencia')
    expect(html).not.toContain('Crédito')
    expect(html).not.toContain('Múltiple')
  })

  it('blocks submit with insufficient cash', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const amountInput = wrapper.find('input')
    await amountInput.setValue('100')

    const buttons = wrapper.findAll('button')
    const confirmButton = buttons[buttons.length - 1]
    await confirmButton?.trigger('click')
    expect(wrapper.html()).toContain('El monto recibido es insuficiente')
  })

  it('locks amount to total for non-cash methods', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.findAll('button')[2]?.trigger('click')
    const amountInput = wrapper.find('input')
    expect(amountInput.attributes('readonly')).toBeDefined()
    expect((amountInput.element as HTMLInputElement).value).toBe('150')
  })
})
