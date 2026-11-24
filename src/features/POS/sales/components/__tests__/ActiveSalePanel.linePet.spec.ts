/** Handoff 27 §5: the line pet picker exists only on a draft with a customer. */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActiveSalePanel from '../ActiveSalePanel.vue'
import { makePet } from '@/features/POS/customers/pets/__tests__/pet.fixture'
import type { Sale } from '../../interfaces/sale.types'

const draft: Sale = {
  id: 'sale-1',
  userId: 'user-1',
  status: 'DRAFT',
  items: [
    {
      id: 'item-1',
      productId: 'prod-1',
      variantId: null,
      productName: 'Croquetas',
      variantName: null,
      quantity: 1,
      unitPriceCents: 10000,
      unitPriceCurrency: 'MXN',
      pet: null,
    },
  ],
  customer: null,
  shippingAddress: null,
  createdAt: '2026-11-23T10:00:00Z',
  updatedAt: '2026-11-23T10:00:00Z',
}

const pets = [makePet({ id: 'p1', name: 'Bruno' })]

function mountPanel(activeDraft: Sale) {
  return mount(ActiveSalePanel, {
    props: {
      drafts: [activeDraft],
      activeDraft,
      activeTabId: activeDraft.id,
      isLoadingList: false,
      isMutating: false,
      customerPets: pets,
      onSetItemPet: vi.fn(async () => undefined),
      onSubmitPriceOverride: vi.fn(async () => undefined),
      onApplyDiscount: vi.fn(async () => undefined),
      onRemoveDiscount: vi.fn(async () => undefined),
      onRemoveItem: vi.fn(async () => undefined),
      onApplyGlobalDiscount: vi.fn(async () => undefined),
      onRemoveGlobalDiscount: vi.fn(async () => undefined),
    },
    global: {
      stubs: {
        SaleItemRow: {
          name: 'SaleItemRow',
          props: ['pets', 'onSetPet'],
          template:
            '<div data-testid="row" :data-pets="(pets ?? []).length" :data-can-set="typeof onSetPet" />',
        },
        SaleTotalsFooter: true,
        PriceListSelector: true,
        PromocionesDisponiblesAccordion: true,
        GlobalDiscountModal: true,
        ConfirmModal: true,
        UButton: true,
        UIcon: true,
        USkeleton: true,
        UTooltip: { template: '<div><slot /></div>' },
        Tooltip: { template: '<div><slot /></div>' },
        UDropdownMenu: { template: '<div><slot /></div>' },
        DropdownMenu: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('ActiveSalePanel — line pets', () => {
  it('hands the customer pets and the pet setter to each line when the sale has a customer', () => {
    const wrapper = mountPanel({
      ...draft,
      customer: { id: 'c1', firstName: 'Ana', lastName: null },
    })

    const row = wrapper.get('[data-testid="row"]')
    expect(row.attributes('data-pets')).toBe('1')
    expect(row.attributes('data-can-set')).toBe('function')
  })

  it('offers no pets on the lines of a sale without customer', () => {
    const wrapper = mountPanel(draft)

    expect(wrapper.get('[data-testid="row"]').attributes('data-pets')).toBe('0')
  })
})
