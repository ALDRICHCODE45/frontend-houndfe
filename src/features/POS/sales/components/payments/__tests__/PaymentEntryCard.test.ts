import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentEntryCard from '../PaymentEntryCard.vue'
import type { PaymentEntry } from '../../../interfaces/sale.types'

const stubs = {
  UBadge: {
    props: ['label'],
    template: '<span>{{ label }}</span>',
  },
  UButton: {
    props: ['disabled'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  UFormField: {
    props: ['label', 'error'],
    template: '<label><span>{{ label }}</span><slot /><p v-if="error">{{ error }}</p></label>',
  },
  UInputNumber: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<div><input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" /></div>',
  },
  UInput: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}

function createEntry(entry: Partial<PaymentEntry> = {}): PaymentEntry {
  return {
    method: 'cash',
    amountCents: 1000,
    ...entry,
  }
}

describe('PaymentEntryCard', () => {
  it('renders method label, amount input and remove button', () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry(),
        index: 0,
        remaining: 5000,
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Efectivo')
    expect(wrapper.get('[data-testid="payment-entry-amount-0"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="payment-entry-remove-0"]').exists()).toBe(true)
  })

  it('shows reference input when method is not cash', () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry({ method: 'card_credit', reference: '' }),
        index: 1,
        remaining: 5000,
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="payment-entry-reference-1"]').exists()).toBe(true)
  })

  it('emits update(index, { amountCents }) when amount changes', async () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry({ amountCents: 1000 }),
        index: 0,
        remaining: 5000,
      },
      global: { stubs },
    })

    wrapper.getComponent({ name: 'InputNumber' }).vm.$emit('update:modelValue', 25)

    expect(wrapper.emitted('update')).toEqual([[0, { amountCents: 2500 }]])
  })

  it('emits update(index, { reference }) when reference changes', async () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry({ method: 'transfer', reference: '' }),
        index: 2,
        remaining: 5000,
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-entry-reference-2"]').setValue('REF-22')

    expect(wrapper.emitted('update')).toEqual([[2, { reference: 'REF-22' }]])
  })

  it('emits remove(index) when remove button is clicked', async () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry(),
        index: 3,
        remaining: 5000,
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-entry-remove-3"]').trigger('click')

    expect(wrapper.emitted('remove')).toEqual([[3]])
  })

  it('shows inline validation errors', () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry({ method: 'transfer' }),
        index: 0,
        remaining: 5000,
        validation: {
          amountCents: 'Monto inválido',
          reference: 'Referencia requerida',
        },
      },
      global: { stubs },
    })

    expect(wrapper.text()).toContain('Monto inválido')
    expect(wrapper.text()).toContain('Referencia requerida')
  })

  it('disables inputs and remove button when disabled=true', () => {
    const wrapper = mount(PaymentEntryCard, {
      props: {
        entry: createEntry({ method: 'transfer' }),
        index: 0,
        remaining: 5000,
        disabled: true,
      },
      global: { stubs },
    })

    expect(wrapper.get('[data-testid="payment-entry-remove-0"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="payment-entry-reference-0"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="payment-entry-amount-0"]').attributes('disabled')).toBeDefined()
  })
})
