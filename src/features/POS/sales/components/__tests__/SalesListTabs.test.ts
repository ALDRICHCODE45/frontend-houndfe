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
    expect(wrapper.text()).toContain('Pagos Pendientes')
    expect(wrapper.text()).toContain('(4)')
    expect(wrapper.text()).toContain('No Entregadas (2)')
  })

  it('hides the pending-payments badge when count is zero (REQ-NEW-8 explicit)', () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 5,
          pendingPayments: 0,
          notDelivered: 2,
        },
      },
    })

    // Tab is still rendered (selectable), but no badge number is shown
    expect(wrapper.find('[data-testid="sales-tab-pending-payments"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="sales-tab-pending-payments-badge"]').exists()).toBe(false)
  })

  it('emits a paymentStatus payload when the pending-payments tab is clicked', async () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 12,
          pendingPayments: 4,
          notDelivered: 2,
        },
      },
    })

    await wrapper.get('[data-testid="sales-tab-pending-payments"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([[{ paymentStatus: 'PARTIAL,CREDIT' }]])
  })

  it('emits a deliveryStatus payload when the not-delivered tab is clicked', async () => {
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

    expect(wrapper.emitted('change')).toEqual([[{ deliveryStatus: 'PENDING' }]])
  })

  it('emits a clear-all payload when Todas is clicked', async () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 12,
          pendingPayments: 4,
          notDelivered: 2,
        },
      },
    })

    await wrapper.get('[data-testid="sales-tab-all"]').trigger('click')

    expect(wrapper.emitted('change')).toEqual([
      [{ deliveryStatus: undefined, paymentStatus: undefined }],
    ])
  })

  it('renders 3 quick filter buttons with whitespace-nowrap to prevent text wrapping in mobile toolbars', () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 5,
          pendingPayments: 1,
          notDelivered: 2,
        },
      },
    })

    const buttons = wrapper.findAll('button[data-testid^="sales-tab-"]')
    expect(buttons).toHaveLength(3)
    buttons.forEach((btn) => {
      expect(btn.classes()).toContain('whitespace-nowrap')
    })
  })
})