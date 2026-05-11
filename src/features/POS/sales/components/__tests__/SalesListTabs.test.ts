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
})
