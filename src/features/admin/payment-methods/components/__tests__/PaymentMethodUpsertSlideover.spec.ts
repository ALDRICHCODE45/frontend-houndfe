import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentMethodUpsertSlideover from '../PaymentMethodUpsertSlideover.vue'
import type {
  CreatePaymentMethodFormValues,
  UpdatePaymentMethodFormValues,
  PaymentMethodTableRow,
} from '../../interfaces/payment-method.types'

const slideoverStub = {
  template: '<div><slot /><slot name="body" /><slot name="footer" /></div>',
  props: ['open', 'title', 'description', 'side', 'inset'],
  emits: ['update:open', 'after-leave'],
}

const buttonStub = {
  props: ['disabled', 'loading', 'type', 'form'],
  template:
    '<button v-bind="$attrs" :disabled="disabled" :form="form" @click="$emit(\'click\')"><slot /></button>',
  emits: ['click'],
}

const inputStub = {
  props: ['modelValue', 'disabled', 'type'],
  emits: ['update:modelValue'],
  template: '<input :value="modelValue" :type="type" @input="$emit(\'update:modelValue\', $event.target.value)" />',
}

const selectStub = {
  props: ['modelValue', 'items', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
}

const formFieldStub = {
  props: ['label', 'help', 'error'],
  template: '<label><span>{{ label }}</span><slot /><p v-if="help">{{ help }}</p><p v-if="error">{{ error }}</p></label>',
}

const switchStub = {
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  template:
    '<button data-testid="isActive-switch" :aria-checked="modelValue" @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>',
}

const stubs = {
  USlideover: slideoverStub,
  Slideover: slideoverStub,
  UButton: buttonStub,
  Button: buttonStub,
  UInput: inputStub,
  Input: inputStub,
  UInputNumber: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" type="number" @input="$emit(\'update:modelValue\', Number($event.target.value))" />' },
  InputNumber: { props: ['modelValue'], emits: ['update:modelValue'], template: '<input :value="modelValue" type="number" @input="$emit(\'update:modelValue\', Number($event.target.value))" />' },
  USelect: selectStub,
  Select: selectStub,
  UFormField: formFieldStub,
  FormField: formFieldStub,
  UForm: { template: '<form @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>', props: ['schema', 'state'], emits: ['submit'] },
  Form: { template: '<form @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>', props: ['schema', 'state'], emits: ['submit'] },
  USwitch: switchStub,
  Switch: switchStub,
}

type SlideoverMountProps = {
  mode: 'create' | 'edit'
  open: boolean
  loading?: boolean
  paymentMethod?: PaymentMethodTableRow | null
}

function mountSlideover(props: SlideoverMountProps) {
  return mount(PaymentMethodUpsertSlideover, {
    props,
    global: { stubs },
  })
}

describe('PaymentMethodUpsertSlideover (sdd custom-payment-methods S3B, REQ-PM-002/003/008/009)', () => {
  describe('create mode', () => {
    it('emits a create payload with ONLY name + category + (optional) subtitle (REQ-PM-002)', async () => {
      const wrapper = mountSlideover({
        mode: 'create',
        open: true,
      })

      // Submit the form (the stub fires submit with state).
      const form = wrapper.find('form')
      await form.trigger('submit')

      const emitted = wrapper.emitted('create')
      expect(emitted).toBeTruthy()
      const payload = (emitted![0]![0]) as CreatePaymentMethodFormValues
      expect(payload).toEqual({ name: '', category: undefined, subtitle: '' })
      // The wire shape (per API boundary) must NOT include forbidden keys.
      const body = payload as Record<string, unknown>
      expect(body).not.toHaveProperty('isActive')
      expect(body).not.toHaveProperty('id')
      expect(body).not.toHaveProperty('tenantId')
      expect(body).not.toHaveProperty('createdAt')
      expect(body).not.toHaveProperty('updatedAt')
      expect(body).not.toHaveProperty('metadataJson')
    })

    it('does NOT render the isActive toggle in create mode (REQ-PM-002 + REQ-PM-003 reversal only applies to edit)', () => {
      const wrapper = mountSlideover({
        mode: 'create',
        open: true,
      })
      expect(wrapper.find('[data-testid="isActive-switch"]').exists()).toBe(false)
    })
  })

  describe('edit mode', () => {
    it('renders the isActive toggle in edit mode (REQ-PM-003 REVERSAL)', () => {
      const wrapper = mountSlideover({
        mode: 'edit',
        open: true,
        paymentMethod: {
          id: 'pm-1',
          tenantId: 'tenant-1',
          name: 'Mercado Pago',
          category: 'transfer',
          subtitle: 'Link',
          isActive: true,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-05-15T00:00:00.000Z',
        },
      })
      expect(wrapper.find('[data-testid="isActive-switch"]').exists()).toBe(true)
    })

    it('emits an edit payload that includes isActive (REQ-PM-003 REVERSAL pin)', async () => {
      const wrapper = mountSlideover({
        mode: 'edit',
        open: true,
        paymentMethod: {
          id: 'pm-1',
          tenantId: 'tenant-1',
          name: 'Mercado Pago',
          category: 'transfer',
          subtitle: 'Link',
          isActive: true,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-05-15T00:00:00.000Z',
        },
      })

      // Toggle isActive off (the stub inverts on click).
      const sw = wrapper.find('[data-testid="isActive-switch"]')
      await sw.trigger('click')

      const form = wrapper.find('form')
      await form.trigger('submit')

      const emitted = wrapper.emitted('edit')
      expect(emitted).toBeTruthy()
      const payload = (emitted![0]![0]) as UpdatePaymentMethodFormValues
      expect(payload.isActive).toBe(false)
      // The wire shape must NOT include forbidden keys.
      const body = payload as Record<string, unknown>
      expect(body).not.toHaveProperty('id')
      expect(body).not.toHaveProperty('tenantId')
      expect(body).not.toHaveProperty('createdAt')
      expect(body).not.toHaveProperty('updatedAt')
      expect(body).not.toHaveProperty('metadataJson')
    })

    it('prefills from the paymentMethod prop (REQ-PM-003)', () => {
      const wrapper = mountSlideover({
        mode: 'edit',
        open: true,
        paymentMethod: {
          id: 'pm-1',
          tenantId: 'tenant-1',
          name: 'Mercado Pago',
          category: 'transfer',
          subtitle: 'Link',
          isActive: true,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-05-15T00:00:00.000Z',
        },
      })

      const html = wrapper.html()
      expect(html).toContain('Mercado Pago')
      expect(html).toContain('Link')
    })

    it('exposes the category selector with exactly 4 options (REQ-PM-008 — no credit)', () => {
      const wrapper = mountSlideover({
        mode: 'edit',
        open: true,
        paymentMethod: {
          id: 'pm-1',
          tenantId: 'tenant-1',
          name: 'Mercado Pago',
          category: 'transfer',
          subtitle: 'Link',
          isActive: true,
          createdAt: '2024-01-15T00:00:00.000Z',
          updatedAt: '2024-05-15T00:00:00.000Z',
        },
      })
      // The slideover renders category as a UFormField with a USelect/options
      // wired from PAYMENT_METHOD_CATEGORY_LABELS. The stub for selectStub
      // renders an actual <select>; we assert options via category labels.
      const html = wrapper.html()
      expect(html).toContain('Efectivo')
      expect(html).toContain('Tarjeta de crédito')
      expect(html).toContain('Tarjeta de débito')
      expect(html).toContain('Transferencia')
      // credit is intentionally NOT offered.
      expect(html).not.toContain('>Crédito<')
    })
  })

  describe('form lifecycle', () => {
    it('resets the form when open flips to false (no stale fields on reopen)', async () => {
      const wrapper = mountSlideover({
        mode: 'create',
        open: true,
      })
      // Type a name.
      const input = wrapper.find('input')
      await input.setValue('Mercado Pago')
      expect(input.element.value).toBe('Mercado Pago')

      // Close the slideover.
      await wrapper.setProps({ open: false })
      // Re-open.
      await wrapper.setProps({ open: true })

      const reopenInput = wrapper.find('input')
      expect(reopenInput.element.value).toBe('')
    })
  })
})