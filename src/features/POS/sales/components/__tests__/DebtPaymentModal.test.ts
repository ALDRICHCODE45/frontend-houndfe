import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DebtPaymentModal from '../DebtPaymentModal.vue'

type DebtPaymentSubmitEvent = {
  saleId: string
  method: 'cash' | 'card_credit' | 'card_debit' | 'transfer'
  amountCents: number
  reference?: string
}

const modalStub = {
  template: '<div><slot name="body" /><slot name="footer" /></div>',
}

const buttonStub = {
  props: ['disabled', 'loading'],
  template: '<button :disabled="disabled"><slot /></button>',
}

const inputNumberStub = {
  props: ['modelValue', 'max', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :max="max" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
}

const inputStub = {
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const selectStub = {
  props: ['modelValue', 'items', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
}

const formFieldStub = {
  props: ['label', 'error', 'help'],
  template: '<label><span>{{ label }}</span><slot /><p v-if="error">{{ error }}</p><p v-if="help">{{ help }}</p></label>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UInputNumber: inputNumberStub,
  InputNumber: inputNumberStub,
  UInput: inputStub,
  Input: inputStub,
  USelect: selectStub,
  Select: selectStub,
  UFormField: formFieldStub,
  FormField: formFieldStub,
}

describe('DebtPaymentModal', () => {
  it('shows only non-credit payment methods', () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 25000 },
      global: { stubs },
    })

    const html = wrapper.html()
    expect(html).toContain('Efectivo')
    expect(html).toContain('Tarjeta crédito')
    expect(html).toContain('Tarjeta débito')
    expect(html).toContain('Transferencia')
    expect(html).not.toContain('Crédito')
  })

  it('caps entered amount to debtCents and shows current debt', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 25000 },
      global: { stubs },
    })

    await wrapper.get('[data-testid="debt-payment-amount"]').setValue('300')
    await wrapper.get('[data-testid="submit-debt-payment"]').trigger('click')

    const payload = wrapper.emitted('submit')?.[0]?.[0] as DebtPaymentSubmitEvent | undefined
    expect(payload).toBeDefined()
    if (!payload) throw new Error('Missing submit event payload')
    expect(payload.amountCents).toBe(25000)
    expect(wrapper.text()).toContain('$250.00')
  })

  it('shows and requires reference for card/transfer methods only', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 25000 },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="debt-payment-reference"]').exists()).toBe(false)

    await wrapper.get('[data-testid="debt-payment-method"]').setValue('card_debit')
    expect(wrapper.find('[data-testid="debt-payment-reference"]').exists()).toBe(true)

    await wrapper.get('[data-testid="submit-debt-payment"]').trigger('click')
    expect(wrapper.text()).toContain('Ingresá la referencia')
  })

  it('emits loading state while submitting', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 25000, isSubmitting: true },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="submit-debt-payment"]').attributes('disabled')).toBeDefined()
  })

  it('renders success and error feedback messages', async () => {
    const wrapper = mount(DebtPaymentModal, {
      props: { open: true, saleId: 'sale-1', debtCents: 25000, externalError: 'Error al cobrar deuda' },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Error al cobrar deuda')

    await wrapper.get('[data-testid="debt-payment-amount"]').setValue('250')
    await wrapper.get('[data-testid="submit-debt-payment"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
