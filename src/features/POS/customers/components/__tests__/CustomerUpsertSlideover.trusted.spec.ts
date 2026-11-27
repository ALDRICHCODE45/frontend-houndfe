/**
 * customers-module T5 (handoff 32 §4): the «Cliente de confianza» switch in the customer editor.
 * Edit only, only when the loaded customer carries `isTrusted`; PATCH sends a strict boolean and
 * create never sends it (POST answers 400).
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick, type Component } from 'vue'
import CustomerUpsertSlideover from '../CustomerUpsertSlideover.vue'
import type { CustomerDetail } from '../../interfaces/customer.types'

const formStub = {
  props: ['state'],
  emits: ['submit'],
  template: '<form @submit.prevent="$emit(\'submit\', { data: state })"><slot /></form>',
}
const tabs = { template: '<div><slot name="content" v-bind="{ item: { value: \'basic\' } }" /></div>' }
const stubs: Record<string, Component> = {
  USlideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  UTabs: tabs,
  UForm: formStub,
  UFormField: { template: '<label><slot /></label>' },
  UInput: {
    props: ['modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
  USelect: { template: '<select />' },
  UTextarea: { template: '<textarea />' },
  UButton: {
    props: ['label', 'type', 'form', 'loading', 'disabled'],
    template: '<button :type="type || \'button\'" :disabled="disabled" v-bind="$attrs" @click="$emit(\'click\')">{{ label }}<slot /></button>',
  },
  UIcon: { template: '<span />' },
  AddressModal: { template: '<div />' },
}
for (const [key, stub] of Object.entries({ ...stubs })) stubs[key.slice(1)] = stub

function customer(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    id: 'c-1', firstName: 'Ana', lastName: 'López', fullName: 'Ana López', phoneCountryCode: '+52',
    phone: null, email: null, globalPriceListId: null, globalPriceListName: null, comments: null,
    businessName: null, fiscalZipCode: null, rfc: null, fiscalRegime: null, billingStreet: null,
    billingExteriorNumber: null, billingInteriorNumber: null, billingZipCode: null,
    billingNeighborhood: null, billingMunicipality: null, billingCity: null, billingState: null,
    addresses: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', ...overrides,
  }
}

const SWITCH = '[data-testid="customer-is-trusted"]'

describe('CustomerUpsertSlideover — «Cliente de confianza» (T5)', () => {
  it('edit: shows the switch with the loaded value and PATCH sends a strict boolean', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer: customer({ isTrusted: false }) },
      global: { stubs },
    })
    await nextTick()
    const row = wrapper.get(SWITCH)
    expect(row.attributes('role')).toBe('switch')
    expect(row.attributes('aria-checked')).toBe('false')
    expect(row.text()).toContain('Cliente de confianza')

    await row.trigger('click')
    expect(wrapper.get(SWITCH).attributes('aria-checked')).toBe('true')
    await wrapper.get('form').trigger('submit')
    const [payload] = wrapper.emitted('edit')![0] as [Record<string, unknown>]
    expect(payload.isTrusted).toBe(true)
    wrapper.unmount()
  })

  it('edit: turning a trusted customer off sends false (not omitted)', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer: customer({ isTrusted: true }) },
      global: { stubs },
    })
    await nextTick()
    await wrapper.get(SWITCH).trigger('click')
    await wrapper.get('form').trigger('submit')
    const [payload] = wrapper.emitted('edit')![0] as [Record<string, unknown>]
    expect(payload).toHaveProperty('isTrusted', false)
    wrapper.unmount()
  })

  it('edit without isTrusted in the response: no switch and nothing sent', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'edit', open: true, customer: customer() },
      global: { stubs },
    })
    await nextTick()
    expect(wrapper.find(SWITCH).exists()).toBe(false)
    await wrapper.get('input[value="López"]').setValue('López Ruiz')
    await wrapper.get('form').trigger('submit')
    const [payload] = wrapper.emitted('edit')![0] as [Record<string, unknown>]
    expect(payload).not.toHaveProperty('isTrusted')
    wrapper.unmount()
  })

  it('create: no switch, and the POST body never carries isTrusted', async () => {
    const wrapper = mount(CustomerUpsertSlideover, {
      props: { mode: 'create', open: true },
      global: { stubs },
    })
    await nextTick()
    expect(wrapper.find(SWITCH).exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    const [payload] = wrapper.emitted('create')![0] as [Record<string, unknown>]
    expect(payload).not.toHaveProperty('isTrusted')
    wrapper.unmount()
  })
})
