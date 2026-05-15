import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActiveSalePanel from '../ActiveSalePanel.vue'
import type { Sale } from '../../interfaces/sale.types'

function makeDraft(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items: [],
    customer: null,
    shippingAddress: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function mountPanel(activeDraft: Sale | null, isCustomerMutationPending = false) {
  return mount(ActiveSalePanel, {
    props: {
      drafts: activeDraft ? [activeDraft] : [],
      activeDraft,
      activeTabId: activeDraft?.id ?? null,
      isLoadingList: false,
      isMutating: false,
      isCustomerMutationPending,
      onSubmitPriceOverride: vi.fn(async () => undefined),
      onApplyDiscount: vi.fn(async () => undefined),
      onRemoveDiscount: vi.fn(async () => undefined),
      onRemoveItem: vi.fn(async () => undefined),
      onApplyGlobalDiscount: vi.fn(async () => undefined),
      onRemoveGlobalDiscount: vi.fn(async () => undefined),
    },
    global: {
      stubs: {
        SalesTabsStrip: { template: '<div />' },
        SaleItemRow: { template: '<div />' },
        SaleTotalsFooter: { template: '<div />' },
        GlobalDiscountModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
        UTabs: { template: '<div />' },
        UTooltip: { template: '<div><slot /></div>' },
        UDropdownMenu: { template: '<div><slot /></div>' },
        Tooltip: { template: '<div><slot /></div>' },
        DropdownMenu: { template: '<div><slot /></div>' },
        UCard: { template: '<div><slot /></div>' },
        Card: { template: '<div><slot /></div>' },
        UButton: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        Button: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        USkeleton: { template: '<div data-testid="customer-slot-loading" />' },
        UIcon: { template: '<i />' },
      },
    },
  })
}

describe('ActiveSalePanel customer slot', () => {
  it('renders empty state with Asignar cliente trigger as inline link and opens slideover event', async () => {
    const wrapper = mountPanel(makeDraft())

    expect(wrapper.text()).toContain('Sin asignar')
    const assignButton = wrapper.get('[data-testid="assign-customer-trigger"]')
    expect(assignButton.text()).toContain('Asignar cliente')

    await assignButton.trigger('click')
    expect(wrapper.emitted('open-customer-assignment')).toHaveLength(1)
  })

  it('renders assigned customer with inline Cambiar and Quitar link actions', async () => {
    const wrapper = mountPanel(makeDraft({
      customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
      shippingAddress: {
        id: 'address-1',
        customerId: 'customer-1',
        street: 'Main St',
        exteriorNumber: '10',
        interiorNumber: null,
        zipCode: '64000',
        neighborhood: 'Centro',
        municipality: 'Monterrey',
        city: 'Monterrey',
        state: 'Nuevo León',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }))

    expect(wrapper.text()).toContain('Ada Lovelace')
    expect(wrapper.text()).toContain('Main St')

    const changeButton = wrapper.get('[data-testid="change-customer-trigger"]')
    const removeButton = wrapper.get('[data-testid="unassign-customer-trigger"]')
    
    // Should be link-style buttons, not large buttons
    expect(changeButton.text()).toContain('Cambiar')
    expect(removeButton.text()).toContain('Quitar')

    await changeButton.trigger('click')
    expect(wrapper.emitted('open-customer-assignment')).toHaveLength(1)

    await removeButton.trigger('click')
    expect(wrapper.emitted('unassign-customer')).toHaveLength(1)
  })

  it('renders loading state while assignment mutation is pending', () => {
    const wrapper = mountPanel(makeDraft({
      customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
    }), true)

    expect(wrapper.find('[data-testid="customer-slot-loading"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="change-customer-trigger"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="unassign-customer-trigger"]').attributes('disabled')).toBeDefined()
  })
})
