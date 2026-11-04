import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CustomerMobileCard from '../CustomerMobileCard.vue'
import type { Customer } from '../../interfaces/customer.types'

const customer: Customer = {
  id: 'cust-secret-id',
  firstName: 'Juan',
  lastName: 'Pérez',
  fullName: 'Juan Pérez',
  phoneCountryCode: '+52',
  phone: '5512345678',
  email: 'juan@test.com',
  globalPriceListId: 'pl-1',
  globalPriceListName: 'Lista General',
  comments: null,
  createdAt: '2024-01-15T00:00:00.000Z',
  updatedAt: '2024-01-15T00:00:00.000Z',
}
const actions = [
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Eliminar…', destructive: true },
]

function mountCard(props: Record<string, unknown> = {}) {
  return mount(CustomerMobileCard, { props: { customer, actions, openable: true, ...props } })
}

describe('CustomerMobileCard', () => {
  it('shows the name as the primary text, the email as the secondary line and never the id', () => {
    const wrapper = mountCard()
    expect(wrapper.get('.hf-row-primary').text()).toBe('Juan Pérez')
    expect(wrapper.get('.hf-row-secondary').text()).toBe('juan@test.com')
    expect(wrapper.text()).not.toContain('cust-secret-id')
  })

  it('shows the phone and the price list in the footer, with an em dash for a missing phone', () => {
    const wrapper = mountCard()
    expect(wrapper.get('.customer-card-footer').text()).toContain('+52 55 1234 5678')
    expect(wrapper.get('.customer-card-footer').text()).toContain('Lista General')
    const bare = mountCard({ customer: { ...customer, phone: null, globalPriceListName: null, email: null } })
    expect(bare.get('.customer-card-footer').text()).toBe('—')
    expect(bare.find('.hf-row-secondary').exists()).toBe(false)
  })

  it('uses a neutral initials avatar, not a per-person color', () => {
    const wrapper = mountCard()
    expect(wrapper.getComponent({ name: 'EntityAvatar' }).text()).toBe('JP')
  })

  it('names the row in the ⋮ trigger and forwards the chosen action with the customer', async () => {
    const wrapper = mountCard()
    expect(wrapper.get('button[aria-haspopup="menu"]').attributes('aria-label')).toBe('Acciones de Juan Pérez')
    wrapper.getComponent({ name: 'RowActionsMenu' }).vm.$emit('select', 'edit')
    expect(wrapper.emitted('action')![0]).toEqual(['edit', customer])
  })

  it('opens from the whole card or the name button, but not from the menu', async () => {
    const wrapper = mountCard()
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
    await wrapper.get('button[aria-haspopup="menu"]').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('is read-only without openable: plain-text name and no click-through', async () => {
    const wrapper = mountCard({ openable: false })
    expect(wrapper.find('button.hf-row-primary').exists()).toBe(false)
    await wrapper.get('article').trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('renders no ⋮ when the role has no actions', () => {
    const wrapper = mountCard({ actions: [] })
    expect(wrapper.find('button[aria-haspopup="menu"]').exists()).toBe(false)
  })
})
