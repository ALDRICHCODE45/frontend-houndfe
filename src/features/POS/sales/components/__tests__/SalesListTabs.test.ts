import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SalesListTabs from '../SalesListTabs.vue'

describe('SalesListTabs', () => {
  it('renders counts for available tabs', () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 12,
          pendingPayments: 4,
          notDelivered: 2,
        },
      },
    })

    expect(wrapper.text()).toContain('Todas (12)')
    expect(wrapper.text()).toContain('No Entregadas (2)')
  })

  it('emits selected filter payload on click', async () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 12,
          pendingPayments: 4,
          notDelivered: 2,
        },
      },
    })

    await wrapper.get('[data-testid="sales-tab-pending-delivery"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([['PENDING']])
  })

  it('renders quick filter buttons with whitespace-nowrap to prevent text wrapping in mobile toolbars', () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 5,
          pendingPayments: 1,
          notDelivered: 2,
        },
      },
    })

    const buttons = wrapper.findAll('[data-testid^="sales-tab-"]')
    expect(buttons).toHaveLength(2)
    buttons.forEach((btn) => {
      expect(btn.classes()).toContain('whitespace-nowrap')
    })
  })
})
