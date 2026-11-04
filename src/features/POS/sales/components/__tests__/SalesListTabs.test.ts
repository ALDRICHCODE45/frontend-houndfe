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
    expect(wrapper.text()).toContain('Pagos pendientes')
    expect(wrapper.text()).toContain('(4)')
    expect(wrapper.text()).toContain('No entregadas (2)')
  })

  it('writes every tab label in sentence case', () => {
    const wrapper = mount(SalesListTabs, {
      props: { counts: { all: 1, pendingPayments: 1, notDelivered: 1 } },
    })

    expect(wrapper.text()).not.toMatch(/Pagos Pendientes|No Entregadas/)
  })

  it('hides every count when showCounts is off (nothing to count yet)', () => {
    const wrapper = mount(SalesListTabs, {
      props: { counts: { all: 4, pendingPayments: 2, notDelivered: 1 }, showCounts: false },
    })

    expect(wrapper.text()).not.toMatch(/\(\d+\)/)
    expect(wrapper.find('[data-testid="sales-tab-pending-payments-badge"]').exists()).toBe(false)
  })

  it('gives the active tab a visible selected state, the others none', async () => {
    const wrapper = mount(SalesListTabs, {
      props: { counts: { all: 5, pendingPayments: 1, notDelivered: 2 }, active: 'pending-payments' },
    })
    const active = () =>
      wrapper
        .findAll('button[data-testid^="sales-tab-"]')
        .filter((btn) => btn.attributes('data-active') === 'true')
        .map((btn) => btn.attributes('data-testid'))

    expect(active()).toEqual(['sales-tab-pending-payments'])
    await wrapper.setProps({ active: 'all' })
    expect(active()).toEqual(['sales-tab-all'])
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

  it('carries the feature-owned sales-status-tab hook on every quick tab', () => {
    const wrapper = mount(SalesListTabs, {
      props: {
        counts: {
          all: 12,
          pendingPayments: 4,
          notDelivered: 2,
        },
      },
    })

    const buttons = wrapper.findAll('button[data-testid^="sales-tab-"]')
    expect(buttons).toHaveLength(3)
    buttons.forEach((btn) => {
      expect(btn.classes()).toContain('sales-status-tab')
    })
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

  it('marks the active quick tab with aria-pressed (Todas by default)', async () => {
    const wrapper = mount(SalesListTabs, {
      props: { counts: { all: 5, pendingPayments: 1, notDelivered: 2 } },
    })
    const pressed = () =>
      wrapper
        .findAll('button[data-testid^="sales-tab-"]')
        .map((btn) => [btn.attributes('data-testid'), btn.attributes('aria-pressed')])

    expect(pressed()).toEqual([
      ['sales-tab-all', 'true'],
      ['sales-tab-pending-payments', 'false'],
      ['sales-tab-pending-delivery', 'false'],
    ])

    await wrapper.setProps({ active: 'pending-delivery' })
    expect(pressed()).toEqual([
      ['sales-tab-all', 'false'],
      ['sales-tab-pending-payments', 'false'],
      ['sales-tab-pending-delivery', 'true'],
    ])
  })
})
