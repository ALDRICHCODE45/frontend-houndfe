/**
 * «Mascotas» tab of the customer card (handoff 27 §4.1): opt-in, edit mode only, labelled with
 * `activePetsCount` when the detail carries it, and the section receives the customer.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerUpsertSlideover from '../CustomerUpsertSlideover.vue'
import type { CustomerDetail } from '../../interfaces/customer.types'

const tabs = {
  props: ['modelValue', 'items'],
  template:
    '<div><span v-for="i in items" :key="i.value" data-testid="tab">{{ i.label }}</span><slot v-for="i in items" :key="i.value" name="content" v-bind="{ item: i }" /></div>',
}
const section = {
  name: 'CustomerPetsSection',
  props: ['customerId', 'activePetsCount'],
  emits: ['update:activeCount'],
  template: '<div data-testid="pets-section" :data-customer="customerId" />',
}
const base = {
  Slideover: { template: '<div><slot name="body" /><slot name="footer" /></div>' },
  Tabs: tabs,
  Form: { template: '<form><slot /></form>' },
  FormField: { template: '<label><slot /></label>' },
  Input: { template: '<input />' },
  Select: { template: '<select />' },
  Textarea: { template: '<textarea />' },
  Button: { props: ['label'], template: '<button>{{ label }}</button>' },
  Icon: { template: '<span />' },
}
const stubs = {
  ...Object.fromEntries(
    Object.entries(base).flatMap(([n, s]) => [
      [n, s],
      [`U${n}`, s],
    ]),
  ),
  AddressModal: { template: '<div />' },
  CustomerPetsSection: section,
}

const customer = {
  id: 'cust-1',
  fullName: 'Ana',
  addresses: [],
  activePetsCount: 2,
} as unknown as CustomerDetail

function mountSlideover(props: { mode: 'create' | 'edit' } & Record<string, unknown>) {
  return mount(CustomerUpsertSlideover, { props: { open: true, ...props }, global: { stubs } })
}

const lastTab = (wrapper: ReturnType<typeof mountSlideover>) =>
  wrapper.findAll('[data-testid="tab"]').reverse()[0]?.text()

describe('CustomerUpsertSlideover — Mascotas tab', () => {
  it('adds «Mascotas (N)» from activePetsCount in edit mode and mounts the section for the customer', async () => {
    const wrapper = mountSlideover({ mode: 'edit', customer, showPets: true })
    expect(wrapper.findAll('[data-testid="tab"]').map((t) => t.text())).toEqual([
      'Datos básicos',
      'Datos de facturación',
      'Mascotas (2)',
    ])
    expect(wrapper.get('[data-testid="pets-section"]').attributes('data-customer')).toBe('cust-1')

    wrapper.getComponent({ name: 'CustomerPetsSection' }).vm.$emit('update:activeCount', 3)
    await wrapper.vm.$nextTick()
    expect(lastTab(wrapper)).toBe('Mascotas (3)')
  })

  it('labels the tab without a count when the detail has no activePetsCount', () => {
    const plain = { ...customer, activePetsCount: undefined }
    const wrapper = mountSlideover({ mode: 'edit', customer: plain, showPets: true })
    expect(lastTab(wrapper)).toBe('Mascotas')
  })

  it('keeps the two tabs in create mode and when the consumer does not opt in', () => {
    for (const props of [
      { mode: 'create' as const, showPets: true },
      { mode: 'edit' as const, customer },
    ]) {
      const wrapper = mountSlideover(props)
      expect(wrapper.findAll('[data-testid="tab"]')).toHaveLength(2)
      expect(wrapper.find('[data-testid="pets-section"]').exists()).toBe(false)
    }
  })
})
