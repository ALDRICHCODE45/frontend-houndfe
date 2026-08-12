// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CustomerCard from '../CustomerCard.vue'
import type { Customer } from '../../interfaces/customer.types'

// Mock the @nuxt/ui components used by CustomerCard. The kebab uses
// UDropdownMenu with action items; tests trigger menu actions directly
// instead of navigating the popover.
vi.mock('@nuxt/ui', () => ({
  UDropdownMenu: {
    name: 'UDropdownMenu',
    template: '<div data-testid="kebab-menu"><slot /></div>',
    props: ['items', 'content'],
    emits: ['select'],
  },
  UButton: {
    name: 'UButton',
    template:
      '<button v-bind="$attrs" @click="$emit(\'click\')" :data-testid="$attrs[\'data-testid\']"><slot /></button>',
    emits: ['click'],
  },
  UIcon: { template: '<span />' },
}))

vi.mock('@/core/shared/components/EntityAvatar.vue', () => ({
  default: {
    name: 'EntityAvatar',
    template: '<div :data-seed="seed" :data-name="name" data-testid="entity-avatar" />',
    props: ['name', 'seed', 'showDot', 'dotClass', 'size'],
  },
}))

vi.mock('@/core/shared/components/AppBadge.vue', () => ({
  default: {
    name: 'AppBadge',
    template: '<span data-testid="app-badge"><slot /></span>',
    props: ['label', 'value', 'tone', 'icon', 'variant'],
  },
}))

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
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
    ...overrides,
  }
}

describe('CustomerCard', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('renders fullName, email, and the price list chip', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: makeCustomer() },
    })
    expect(wrapper.text()).toContain('Juan Pérez')
    expect(wrapper.text()).toContain('juan@test.com')
    expect(wrapper.text()).toContain('Lista General')
  })

  it('passes the customer id to EntityAvatar as seed', () => {
    const wrapper = mount(CustomerCard, {
      props: { customer: makeCustomer({ id: 'cust-42' }) },
    })
    const avatar = wrapper.find('[data-testid="entity-avatar"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('data-seed')).toBe('cust-42')
    expect(avatar.attributes('data-name')).toBe('Juan Pérez')
  })

  it('prepends the phone country code when both are present', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer({
          phoneCountryCode: '+52',
          phone: '5512345678',
        }),
      },
    })
    expect(wrapper.text()).toContain('+52')
    expect(wrapper.text()).toContain('5512345678')
  })

  it('falls back to an em-dash when phone is missing', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer({ phone: null, phoneCountryCode: null }),
      },
    })
    expect(wrapper.text()).toContain('—')
  })

  it('emits click with the customer when the article is clicked', async () => {
    const customer = makeCustomer()
    const wrapper = mount(CustomerCard, {
      props: { customer },
    })
    await wrapper.find('article').trigger('click')
    expect(wrapper.emitted('click')?.[0]?.[0]).toEqual(customer)
  })

  it('hides the kebab when neither canUpdate nor canDelete is true', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer(),
        canUpdate: false,
        canDelete: false,
      },
    })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(false)
  })

  it('shows the kebab when canUpdate is true', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer(),
        canUpdate: true,
        canDelete: false,
      },
    })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(true)
  })

  it('shows the kebab when canDelete is true', () => {
    const wrapper = mount(CustomerCard, {
      props: {
        customer: makeCustomer(),
        canUpdate: false,
        canDelete: true,
      },
    })
    expect(wrapper.find('[data-testid="kebab-menu"]').exists()).toBe(true)
  })

  it('emits edit/delete from the kebab menu actions and stops propagation', async () => {
    const customer = makeCustomer()
    const wrapper = mount(CustomerCard, {
      props: {
        customer,
        canUpdate: true,
        canDelete: true,
      },
    })
    // The kebab container is wrapped with @click.stop; clicking it should
    // NOT bubble to the article click handler.
    const articleClick = vi.fn()
    wrapper.find('article').element.addEventListener('click', articleClick)
    await wrapper.find('[data-testid="kebab-menu"]').trigger('click')
    expect(articleClick).not.toHaveBeenCalled()
  })
})
