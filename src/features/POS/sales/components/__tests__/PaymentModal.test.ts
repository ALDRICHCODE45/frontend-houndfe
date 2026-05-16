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

    expect(wrapper.text()).toContain('Asigná un cliente para registrar una venta con deuda')
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

  it('allows up to 4 payment entries (one per supported method) and toggles them on/off', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    // Each tile toggles ONE entry of its method. There are 4 supported methods.
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_credit"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-method="transfer"]').trigger('click')

    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(4)
  })

  it('adds and removes payment entries via toggle on method tiles', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(2)

    // Click an already-selected tile to deselect it (toggle off)
    await wrapper.get('[data-method="card_debit"]').trigger('click')
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

    // Initially no entries, so no reference fields
    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(false)

    // Click card_credit - creates entry 0 with reference field
    await wrapper.get('[data-method="card_credit"]').trigger('click')
    expect(wrapper.find('[data-testid="payment-reference-0"]').exists()).toBe(true)

    // Click transfer - creates entry 1 with reference field
    await wrapper.get('[data-method="transfer"]').trigger('click')
    expect(wrapper.find('[data-testid="payment-reference-1"]').exists()).toBe(true)
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

    // Click card_debit to create entry 0 (requires reference)
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('0')
    
    // Click transfer to create entry 1 (also requires reference)  
    await wrapper.get('[data-method="transfer"]').trigger('click')
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

    // Add a cash entry first
    await wrapper.get('[data-method="cash"]').trigger('click')
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

    // Add a cash entry first
    await wrapper.get('[data-testid="add-payment-entry"]').trigger('click')
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

    // Add a cash entry for single payment test
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const singleSubmit = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(singleSubmit).toBeDefined()
    const singlePayload = singleSubmit?.payload
    expect(singlePayload).toMatchObject({ method: 'cash', amountCents: 15000 })
    expect(singlePayload).not.toHaveProperty('payments')

    // Add a second method to make it a multi-payment (sum must equal total = $150 = 15000 cents)
    await wrapper.get('[data-method="card_debit"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('50')
    await wrapper.get('[data-testid="payment-amount-1"]').setValue('100')
    // card_debit requires reference
    await wrapper.get('[data-testid="payment-reference-1"]').setValue('AUTH-123')
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

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')

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

    await wrapper.get('[data-method="cash"]').trigger('click')
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

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')
    const cta = wrapper.get('[data-testid="assign-customer-cta"]')
    await cta.trigger('click')

    expect(wrapper.emitted('request-assign-customer')).toBeTruthy()
  })

  it('allows pure-credit (empty payments) when customer is assigned', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-2', firstName: 'Lin', lastName: null },
      },
      global: { stubs },
    })

    // No method selected = pure debt for the full total
    expect(wrapper.findAll('[data-testid^="payment-entry-"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="confirm-charge"]').text()).toContain('Deuda $150.00')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })

  it('includes optional dueDate in the charge payload when provided', async () => {
    const dueDateStub = {
      props: ['modelValue', 'placeholder', 'disabled', 'minIso', 'testid'],
      emits: ['update:modelValue'],
      template: '<input :data-testid="testid" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    }

    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: {
        stubs: { ...stubs, DateFieldPopover: dueDateStub },
      },
    })

    // Add a partial payment (so the sale will end with debt)
    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('100')

    // Expand the optional dueDate section
    await wrapper.get('[data-testid="expand-due-date"]').trigger('click')

    // Pick a due date far in the future (safe across clocks)
    await wrapper.get('[data-testid="due-date-input"]').setValue('2099-12-31')

    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')
    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect(submitted?.payload).toMatchObject({ dueDate: '2099-12-31' })
  })

  it('omits dueDate from the payload when input is empty', async () => {
    const wrapper = mount(PaymentModal, {
      props: {
        open: true,
        totalCents: 15000,
        saleId: 'sale-1',
        customer: { id: 'c-1', firstName: 'Ada', lastName: null },
      },
      global: { stubs },
    })

    await wrapper.get('[data-method="cash"]').trigger('click')
    await wrapper.get('[data-testid="payment-amount-0"]').setValue('150')
    await wrapper.get('[data-testid="confirm-charge"]').trigger('click')

    const submitted = wrapper.emitted('submit')?.[0]?.[0] as PaymentModalSubmitEvent | undefined
    expect(submitted).toBeDefined()
    expect(submitted?.payload).not.toHaveProperty('dueDate')
  })
})
