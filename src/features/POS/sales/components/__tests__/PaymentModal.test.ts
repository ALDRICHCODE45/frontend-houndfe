import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentModal from '../PaymentModal.vue'
import type { ChargeSalePayload } from '../../interfaces/sale.types'

type PaymentModalSubmitEvent = {
  saleId: string
  payload: ChargeSalePayload
  idempotencyKey: string
}

const modalStub = {
  template: '<div><slot /><slot name="content" /><slot name="body" /><slot name="footer" /></div>',
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

const inputStub = {
  props: ['modelValue', 'disabled', 'readonly'],
  emits: ['update:modelValue'],
  template:
    '<input :value="modelValue" :disabled="disabled" :readonly="readonly" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const selectStub = {
  props: ['modelValue', 'items', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<select :value="modelValue" :disabled="disabled" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
}

const formFieldStub = {
  props: ['label', 'help', 'error'],
  template: '<label><span>{{ label }}</span><slot /><p v-if="help">{{ help }}</p><p v-if="error">{{ error }}</p></label>',
}

const stubs = {
  UModal: modalStub,
  Modal: modalStub,
  USlideover: modalStub,
  Slideover: modalStub,
  UButton: buttonStub,
  Button: buttonStub,
  UInputNumber: inputNumberStub,
  InputNumber: inputNumberStub,
  UInput: inputStub,
  Input: inputStub,
  USelect: selectStub,
  Select: selectStub,
  UBadge: { template: '<span><slot /></span>' },
  Badge: { template: '<span><slot /></span>' },
  USeparator: { template: '<hr />' },
  Separator: { template: '<hr />' },
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UIcon: { template: '<span />' },
  Icon: { template: '<span />' },
  UAlert: {
    props: ['title', 'description'],
    template: '<div role="alert"><p>{{ title }}</p><p>{{ description }}</p><slot name="actions" /></div>',
  },
  URadioGroup: {
    props: ['modelValue', 'items'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
}

describe('PaymentModal', () => {
  it('opens with empty payments list (no method preselected)', () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
  })

  it('clicking an unselected method tile adds it to the payments list', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const cashButton = wrapper.get('[data-testid="add-payment-entry"]')
    await cashButton.trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('clicking a selected method tile removes it from the payments list (toggle)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const cashButton = wrapper.get('[data-testid="add-payment-entry"]')
    await cashButton.trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)

    // Click again to remove
    await cashButton.trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
  })

  it('submit with empty payments + customer assigned + total > 0 → emits submit with payments: [] (allowed, all-debt)', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'customer-1', firstName: 'Test', lastName: 'Customer' }
      },
      global: { stubs },
    })

    const submitButton = wrapper.get('[data-testid="confirm-charge"]')
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('submit') as PaymentModalSubmitEvent[][]
    expect(emitted).toHaveLength(1)
    expect(emitted[0]![0]!.payload.payments).toEqual([])
  })

  it('submit with empty payments + NO customer + total > 0 → blocked, alert visible with assign CTA', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: null
      },
      global: { stubs },
    })

    const submitButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(submitButton.attributes('disabled')).toBeDefined() // Should be disabled

    expect(wrapper.text()).toContain('Para pago parcial asigná un cliente')
  })

  it('submit with one method @ 0 → entry is filtered out before emit; if customer present, treated as all-debt', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'customer-1', firstName: 'Test', lastName: 'Customer' }
      },
      global: { stubs },
    })

    // Add a payment method with zero amount
    const cashButton = wrapper.get('[data-testid="add-payment-entry"]')
    await cashButton.trigger('click')

    const amountInput = wrapper.get('[data-testid="payment-amount-0"]')
    await amountInput.setValue(0)

    const submitButton = wrapper.get('[data-testid="confirm-charge"]')
    await submitButton.trigger('click')

    const emitted = wrapper.emitted('submit') as PaymentModalSubmitEvent[][]
    expect(emitted).toHaveLength(1)
    expect(emitted[0]![0]!.payload.payments).toEqual([]) // Zero amount filtered out
  })

  it('allows up to 5 payment entries and disables add at max', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const addButton = wrapper.get('[data-testid="add-payment-entry"]')
    await addButton.trigger('click')
    await addButton.trigger('click')
    await addButton.trigger('click')
    await addButton.trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(5)
    expect(addButton.attributes('disabled')).toBeDefined()
  })

  it('adds and removes payment entries', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="add-payment-entry"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    await wrapper.get('[data-testid="remove-payment-entry-1"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(1)
  })

  it('shows reference field only for card and transfer methods', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(false)

    await wrapper.get('[data-method="card_credit"]').trigger('click')
    expect(wrapper.find('[data-testid="payment-reference-1"]').exists()).toBe(true)

    await wrapper.get('[data-method="transfer"]').trigger('click')
    expect(wrapper.find('[data-testid="payment-reference-2"]').exists()).toBe(true)
  })

  it('requires reference for card and transfer methods', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('0')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    expect(wrapper.html()).toContain('Ingresá la referencia para tarjeta o transferencia')
  })

  it('disables submit for partial payment without customer assignment', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    const confirmButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    expect(wrapper.html()).toContain('Asigná un cliente para registrar una venta con deuda')
  })

  it('regenerates idempotency key when entry fields change', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const firstPayload = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('151')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const secondPayload = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined

    expect(firstPayload).toBeDefined()
    expect(secondPayload).toBeDefined()
    if (!firstPayload || !secondPayload) throw new Error('Missing submit event payload')
    expect(firstPayload.idempotencyKey).not.toBe(secondPayload.idempotencyKey)
  })

  it('emits payments[] payload for multi-payment and legacy for single', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const singleSubmit = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(singleSubmit).toBeDefined()
    const singlePayload = singleSubmit?.payload
    expect(singlePayload).toMatchObject({ method: 'cash', amountCents: 15000 })
    expect(singlePayload).not.toHaveProperty('payments')

    await wrapper.get('[data-testid="add-payment-entry"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('50')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('100')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const multiSubmit = wrapper.emitted('submit')?.[1]?.[0] as PaymentModalSubmitEvent | undefined
    expect(multiSubmit).toBeDefined()
    const multiPayload = multiSubmit?.payload
    expect(multiPayload).toHaveProperty('payments')
    expect(multiPayload).not.toHaveProperty('method')
    expect(multiPayload).not.toHaveProperty('amountCents')
  })

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

  it('shows partial payment guard when sum is below total', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    const amountInput = wrapper.get('[data-testid="payment-amount-0"]')
    await amountInput.setValue('100')

    const confirmButton = wrapper.get('[data-testid="confirm-charge"]')
    expect(confirmButton.attributes('disabled')).toBeDefined()
    expect(wrapper.html()).toContain('Asigná un cliente para registrar una venta con deuda')
  })

  it('allows partial payment with customer, shows debt, and emits submit', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    expect(wrapper.text()).toContain('Deuda a generar:')
    expect(wrapper.text()).toContain('$50.00')
    expect(wrapper.get('[data-testid="confirm-charge"]').text()).toContain('Deuda $50.00')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('emits request-assign-customer when partial without customer clicks CTA', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    const cta = wrapper.get('[data-testid="assign-customer-cta"]')
    await cta.trigger('click')

    expect(wrapper.emitted('request-assign-customer')).toBeTruthy()
  })

  it('allows pure-credit when customer is assigned', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-2', firstName: 'Lin', lastName: null },
      },
      global: { stubs },
    })

    await wrapper.get('[data-testid="payment-amount-0"]').setValue('0')
    expect(wrapper.get('[data-testid="confirm-charge"]').text()).toContain('Deuda $150.00')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
