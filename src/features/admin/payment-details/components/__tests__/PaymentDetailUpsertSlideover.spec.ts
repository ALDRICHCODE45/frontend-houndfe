// @ts-nocheck — component mount with Nuxt UI stubs; assertions use testids/text
// and emitted payloads, not deep type contracts.
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentDetailUpsertSlideover from '../PaymentDetailUpsertSlideover.vue'
import type { PaymentDetailTableRow } from '../../interfaces/payment-detail.types'

/**
 * PaymentDetailUpsertSlideover — sdd payment-details-admin S4 (design.md §10.2)
 *
 * These tests MOUNT the real component (verify-phase remediation):
 *   - REQ-PD-003: NO `isActive` control is ever rendered in create or edit mode
 *     (no toggle, no checkbox, no field named isActive).
 *   - REQ-PD-002: create submit emits a parsed payload with ONLY the 4 account
 *     fields (no isActive, no tenantId).
 *   - REQ-PD-003: edit mode prefills the 4 fields from the row and emits an edit
 *     payload with ONLY the 4 fields.
 */

// Nuxt UI registers each component under BOTH the U* name and the unprefixed
// alias (mirrors QuotationPriceOverrideModal.test.ts). The UForm stub forwards
// submit with the live `state` prop so onSubmit emits create/edit.
const stubs = {
  USlideover: {
    name: 'USlideover',
    template: '<div data-testid="slideover"><slot name="body" /><slot name="footer" /></div>',
    props: ['open', 'title', 'description', 'side', 'inset'],
  },
  Slideover: {
    name: 'Slideover',
    template: '<div data-testid="slideover"><slot name="body" /><slot name="footer" /></div>',
    props: ['open', 'title', 'description', 'side', 'inset'],
  },
  UForm: {
    name: 'UForm',
    template:
      '<form data-testid="form" @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
    props: ['schema', 'state'],
    emits: ['submit'],
  },
  Form: {
    name: 'Form',
    template:
      '<form data-testid="form" @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
    props: ['schema', 'state'],
    emits: ['submit'],
  },
  UFormField: {
    name: 'UFormField',
    template: '<div data-testid="form-field" :data-name="name"><label>{{ label }}</label><slot /></div>',
    props: ['label', 'name'],
  },
  FormField: {
    name: 'FormField',
    template: '<div data-testid="form-field" :data-name="name"><label>{{ label }}</label><slot /></div>',
    props: ['label', 'name'],
  },
  UInput: {
    name: 'UInput',
    template:
      '<input data-testid="input" :data-name="name" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'name', 'type', 'placeholder', 'maxlength'],
    emits: ['update:modelValue'],
  },
  Input: {
    name: 'Input',
    template:
      '<input data-testid="input" :data-name="name" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'name', 'type', 'placeholder', 'maxlength'],
    emits: ['update:modelValue'],
  },
  UButton: {
    name: 'UButton',
    template: '<button data-testid="button" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
  Button: {
    name: 'Button',
    template: '<button data-testid="button" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
}

function makeRow(overrides: Partial<PaymentDetailTableRow> = {}): PaymentDetailTableRow {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'AFIRME',
    beneficiary: 'HUN F.E. COMERCIALIZADORA SA DE CV',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

function mountSlideover(props: Record<string, unknown>) {
  return mount(PaymentDetailUpsertSlideover as never, {
    props: { open: true, ...props },
    global: { stubs },
  })
}

describe('PaymentDetailUpsertSlideover — REQ-PD-003: isActive is NEVER a control', () => {
  it('create mode renders NO isActive toggle/checkbox/field', () => {
    const wrapper = mountSlideover({ mode: 'create' })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"][name="isActive"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('isActive')
  })

  it('edit mode renders NO isActive toggle/checkbox/field', () => {
    const wrapper = mountSlideover({ mode: 'edit', paymentDetail: makeRow() })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"][name="isActive"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('isActive')
  })

  it('renders exactly 4 input fields (bankName, beneficiary, clabe, accountNumber)', () => {
    const wrapper = mountSlideover({ mode: 'create' })
    const inputs = wrapper.findAll('[data-testid="input"]')
    expect(inputs).toHaveLength(4)
    const fieldNames = wrapper.findAll('[data-testid="form-field"]').map((f) => f.attributes('data-name'))
    expect(fieldNames.sort()).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
  })
})

describe('PaymentDetailUpsertSlideover — REQ-PD-002: create emits only the 4 fields', () => {
  it('submitting create emits `create` with a payload that has exactly the 4 fields', async () => {
    const wrapper = mountSlideover({ mode: 'create' })
    const fieldNames = wrapper.findAll('[data-testid="form-field"]').map((f) => f.attributes('data-name'))
    const inputs = wrapper.findAll('[data-testid="input"]')
    const values = {
      bankName: 'AFIRME',
      beneficiary: 'HUN F.E. COMERCIALIZADORA SA DE CV',
      clabe: '012180001234567890',
      accountNumber: '1234567890',
    }
    for (let i = 0; i < inputs.length; i++) {
      const name = fieldNames[i]
      if (name && name in values) {
        await inputs[i].setValue(values[name])
      }
    }

    // Trigger the UForm submit; the stub forwards { data: state } with the
    // component's live reactive state.
    await wrapper.find('[data-testid="form"]').trigger('submit')

    const createEvents = wrapper.emitted('create')
    expect(createEvents).toBeTruthy()
    expect(createEvents).toHaveLength(1)
    const payload = createEvents![0]![0]
    expect(Object.keys(payload).sort()).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
    expect(payload).not.toHaveProperty('isActive')
    expect(payload).not.toHaveProperty('tenantId')
  })
})

describe('PaymentDetailUpsertSlideover — REQ-PD-003: edit prefills and emits only the 4 fields', () => {
  it('edit mode prefills the 4 fields from the row', async () => {
    const row = makeRow({
      bankName: 'BBVA',
      beneficiary: 'BBVA SA',
      clabe: '012290001234567890',
      accountNumber: '0987654321',
    })
    const wrapper = mountSlideover({ mode: 'edit', paymentDetail: row })
    const fieldNames = wrapper.findAll('[data-testid="form-field"]').map((f) => f.attributes('data-name'))
    const inputs = wrapper.findAll('[data-testid="input"]')
    const values = {}
    for (let i = 0; i < inputs.length; i++) {
      values[fieldNames[i]] = inputs[i].element.value
    }
    expect(values).toEqual({
      bankName: 'BBVA',
      beneficiary: 'BBVA SA',
      clabe: '012290001234567890',
      accountNumber: '0987654321',
    })
  })

  it('submitting edit emits `edit` with exactly the 4 fields (no isActive/tenantId)', async () => {
    const row = makeRow()
    const wrapper = mountSlideover({ mode: 'edit', paymentDetail: row })
    await wrapper.find('[data-testid="form"]').trigger('submit')

    const editEvents = wrapper.emitted('edit')
    expect(editEvents).toBeTruthy()
    expect(editEvents).toHaveLength(1)
    const payload = editEvents![0]![0]
    expect(Object.keys(payload).sort()).toEqual(['accountNumber', 'bankName', 'beneficiary', 'clabe'])
    expect(payload).not.toHaveProperty('isActive')
    expect(payload).not.toHaveProperty('tenantId')
  })
})
