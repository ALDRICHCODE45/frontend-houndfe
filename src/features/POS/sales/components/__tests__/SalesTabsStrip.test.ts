import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SalesTabsStrip from '../SalesTabsStrip.vue'
import type { Sale } from '../../interfaces/sale.types'

describe('SalesTabsStrip', () => {
  const mockDrafts: Sale[] = [
    {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
      createdAt: '2026-04-21T10:00:00Z',
      updatedAt: '2026-04-21T10:00:00Z',
    },
    {
      id: 'sale-2',
      userId: 'user-1',
      status: 'DRAFT',
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          variantId: null,
          productName: 'Aspirina',
          variantName: null,
          quantity: 2,
          unitPriceCents: 5000,
          unitPriceCurrency: 'MXN',
        },
      ],
      createdAt: '2026-04-21T09:00:00Z',
      updatedAt: '2026-04-21T10:15:00Z',
    },
  ]

  it('should render tab for each draft', () => {
    const wrapper = mount(SalesTabsStrip, {
      props: { drafts: mockDrafts, activeTabId: 'sale-1' },
      global: {
        stubs: { UIcon: true, UButton: true },
      },
    })

    expect(wrapper.html()).toContain('Venta 1')
    expect(wrapper.html()).toContain('Venta 2')
  })

  it('should emit switch event when tab clicked', async () => {
    const wrapper = mount(SalesTabsStrip, {
      props: { drafts: mockDrafts, activeTabId: 'sale-1' },
      global: {
        stubs: { UIcon: true, UButton: true },
      },
    })

    const tabs = wrapper.findAll('[data-testid^="tab-"]')
    await tabs[1]!.trigger('click')

    expect(wrapper.emitted('switch')).toBeTruthy()
    expect(wrapper.emitted('switch')?.[0]).toEqual(['sale-2'])
  })

  it('should emit close event when X button clicked', async () => {
    const wrapper = mount(SalesTabsStrip, {
      props: { drafts: mockDrafts, activeTabId: 'sale-1' },
      global: {
        stubs: { UButton: true },
      },
    })

    const closeButtons = wrapper.findAll('[data-testid^="close-tab-"]')
    await closeButtons[0]!.trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')?.[0]).toEqual(['sale-1'])
  })

  it('should emit create event when + button clicked', async () => {
    const wrapper = mount(SalesTabsStrip, {
      props: { drafts: mockDrafts, activeTabId: 'sale-1' },
      global: {
        stubs: { UIcon: true },
      },
    })

    const createButton = wrapper.find('[data-testid="create-tab"]')
    await createButton.trigger('click')

    expect(wrapper.emitted('create')).toBeTruthy()
  })

  it('should apply active styles to active tab', () => {
    const wrapper = mount(SalesTabsStrip, {
      props: { drafts: mockDrafts, activeTabId: 'sale-2' },
      global: {
        stubs: { UIcon: true, UButton: true },
      },
    })

    const activeTab = wrapper.find('[data-testid="tab-sale-2"]')
    expect(activeTab.classes()).toContain('bg-default')
    expect(activeTab.classes()).toContain('shadow-sm')
  })
})
