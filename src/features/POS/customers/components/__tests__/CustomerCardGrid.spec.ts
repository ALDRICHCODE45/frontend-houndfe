import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import CustomerCardGrid from '../CustomerCardGrid.vue'
import CustomerCard from '../CustomerCard.vue'
import type { Customer } from '../../interfaces/customer.types'

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div data-testid="entity-avatar" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

const UIconStub = defineComponent({
  name: 'UIcon',
  props: ['name'],
  template: '<span aria-hidden="true" />',
})

vi.mock('@nuxt/ui/components/Icon.vue', () => ({
  default: {
    name: 'UIcon',
    template: '<span aria-hidden="true" />',
    props: ['name'],
  },
}))

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    firstName: 'Juan',
    lastName: 'Pérez',
    fullName: 'Juan Pérez',
    phoneCountryCode: null,
    phone: null,
    email: 'juan@test.com',
    globalPriceListId: null,
    globalPriceListName: null,
    comments: null,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('CustomerCardGrid', () => {
  it('renders one card per customer', () => {
    const wrapper = mount(CustomerCardGrid, {
      props: {
        customers: [makeCustomer({ id: 'a' }), makeCustomer({ id: 'b' })],
      },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.findAll('article').length).toBe(2)
  })

  it('shows 8 skeleton placeholders when loading', () => {
    const wrapper = mount(CustomerCardGrid, {
      props: {
        customers: [],
        loading: true,
      },
      global: { stubs: { UIcon: UIconStub } },
    })
    const skeleton = wrapper.find('[data-testid="card-grid-skeleton"]')
    expect(skeleton.exists()).toBe(true)
    expect(skeleton.findAll('[data-testid="card-skeleton"]').length).toBe(8)
  })

  it('shows the empty state with an icon and message when there are no customers', () => {
    const wrapper = mount(CustomerCardGrid, {
      props: {
        customers: [],
        empty: 'No se encontraron clientes',
      },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.text()).toContain('No se encontraron clientes')
    expect(wrapper.find('[data-testid="card-grid-empty"]').exists()).toBe(true)
  })

  it('falls back to the default empty message when none is provided', () => {
    const wrapper = mount(CustomerCardGrid, {
      props: { customers: [] },
      global: { stubs: { UIcon: UIconStub } },
    })
    expect(wrapper.text()).toContain('No se encontraron clientes')
  })

  it('forwards card-click to the parent', async () => {
    const customer = makeCustomer({ id: 'a' })
    const wrapper = mount(CustomerCardGrid, {
      props: { customers: [customer] },
      global: { stubs: { UIcon: UIconStub } },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('card-click')?.[0]?.[0]).toEqual(customer)
  })

  it('forwards edit and delete from a card exactly once each', () => {
    const customer = makeCustomer({ id: 'a' })
    const wrapper = mount(CustomerCardGrid, {
      props: { customers: [customer], canUpdate: true, canDelete: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    const card = wrapper.getComponent(CustomerCard)
    card.vm.$emit('edit', customer)
    card.vm.$emit('delete', customer)
    expect(wrapper.emitted('edit')?.length).toBe(1)
    expect(wrapper.emitted('delete')?.length).toBe(1)
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual(customer)
    expect(wrapper.emitted('delete')?.[0]?.[0]).toEqual(customer)
  })

  // ── S4: grid forwarding parity ─────────────────────────────────────────────

  it('forwards canReadSales to the inner CustomerCard', () => {
    const customer = makeCustomer({ id: 'a' })
    const wrapper = mount(CustomerCardGrid, {
      props: { customers: [customer], canReadSales: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    const card = wrapper.getComponent(CustomerCard)
    expect(card.props('canReadSales')).toBe(true)
  })

  it('emits view-history exactly once with the customer from the card', async () => {
    const customer = makeCustomer({ id: 'a' })
    const wrapper = mount(CustomerCardGrid, {
      props: { customers: [customer], canReadSales: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    const card = wrapper.getComponent(CustomerCard)
    card.vm.$emit('view-history', customer)
    expect(wrapper.emitted('view-history')?.length).toBe(1)
    expect(wrapper.emitted('view-history')?.[0]?.[0]).toEqual(customer)
  })

  it('forwards card-click unchanged when canReadSales is true', async () => {
    const customer = makeCustomer({ id: 'a' })
    const wrapper = mount(CustomerCardGrid, {
      props: { customers: [customer], canReadSales: true },
      global: { stubs: { UIcon: UIconStub } },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('card-click')?.[0]?.[0]).toEqual(customer)
  })
})
