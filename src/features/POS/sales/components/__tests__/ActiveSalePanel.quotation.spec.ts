// T2 (quotation-sale-conversion, S1 + S3): the POS «Pedido» flow is a visible,
// keyboard-reachable «Pasar a cotización» action in the cart header. The
// panel only shows it and emits; SalesView owns the permission and the dialog.

import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import ActiveSalePanel from '../ActiveSalePanel.vue'
import type { Sale, SaleItem } from '../../interfaces/sale.types'

const ITEM: SaleItem = {
  id: 'item-1',
  productId: 'prod-1',
  variantId: null,
  productName: 'Aspirina',
  variantName: null,
  quantity: 1,
  unitPriceCents: 1000,
  unitPriceCurrency: 'MXN',
}

function makeDraft(items: SaleItem[]): Sale {
  return {
    id: 'sale-1',
    userId: 'user-1',
    status: 'DRAFT',
    items,
    customer: null,
    shippingAddress: null,
    createdAt: 'x',
    updatedAt: 'x',
  }
}

function mountPanel(
  options: { items?: SaleItem[]; canConvertToQuotation?: boolean; mobileSheet?: boolean; isMutating?: boolean } = {},
) {
  const draft = makeDraft(options.items ?? [ITEM])
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const buttonStub = {
    props: ['label', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\', $event)"><slot />{{ label }}</button>',
  }
  return mount(ActiveSalePanel, {
    props: {
      drafts: [draft],
      activeDraft: draft,
      activeTabId: draft.id,
      isLoadingList: false,
      isMutating: options.isMutating ?? false,
      mobileSheet: options.mobileSheet ?? false,
      canConvertToQuotation: options.canConvertToQuotation,
      onSubmitPriceOverride: vi.fn(async () => undefined),
      onApplyDiscount: vi.fn(async () => undefined),
      onRemoveDiscount: vi.fn(async () => undefined),
      onRemoveItem: vi.fn(async () => undefined),
      onApplyGlobalDiscount: vi.fn(async () => undefined),
      onRemoveGlobalDiscount: vi.fn(async () => undefined),
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        SaleItemRow: { template: '<div />' },
        SaleTotalsFooter: { template: '<div />' },
        GlobalDiscountModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
        PriceListSelector: { template: '<div />' },
        PromocionesDisponiblesAccordion: { template: '<div />' },
        UTooltip: { template: '<div><slot /></div>' },
        UDropdownMenu: { template: '<div><slot /></div>' },
        Tooltip: { template: '<div><slot /></div>' },
        DropdownMenu: { template: '<div><slot /></div>' },
        UButton: buttonStub,
        Button: buttonStub,
        USkeleton: { template: '<div />' },
        UIcon: { template: '<i />' },
        Icon: { template: '<i />' },
      },
    },
  })
}

const trigger = (wrapper: ReturnType<typeof mountPanel>) =>
  wrapper.find('[data-testid="sale-to-quotation-trigger"]')

describe('ActiveSalePanel — «Pasar a cotización»', () => {
  it('is hidden without the permission (create:Quotation + delete:Sale)', () => {
    expect(trigger(mountPanel()).exists()).toBe(false)
    expect(trigger(mountPanel({ canConvertToQuotation: false })).exists()).toBe(false)
  })

  it('replaces the disabled «Pedido» tab', () => {
    const wrapper = mountPanel({ canConvertToQuotation: true })
    expect(wrapper.text()).not.toContain('Pedido')
    expect(wrapper.find('[data-testid="cart-type-toggle"] [data-testid="sale-to-quotation-trigger"]').exists()).toBe(
      true,
    )
  })

  it('is a real button that emits convert-to-quotation for a draft with items', async () => {
    const wrapper = mountPanel({ canConvertToQuotation: true })
    const button = trigger(wrapper)

    expect(button.element.tagName).toBe('BUTTON')
    expect(button.text()).toBe('Pasar a cotización')
    expect(button.attributes('aria-disabled')).toBeUndefined()
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(wrapper.emitted('convert-to-quotation')).toEqual([[]])
  })

  it('stays focusable but disabled with the reason on an empty draft', async () => {
    const wrapper = mountPanel({ canConvertToQuotation: true, items: [] })
    const button = trigger(wrapper)

    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.attributes('aria-disabled')).toBe('true')
    const reasonId = button.attributes('aria-describedby')
    expect(reasonId).toBeTruthy()
    expect(wrapper.find(`#${reasonId}`).text()).toBe('Agrega productos para pasar la venta a cotización.')
    await button.trigger('click')
    expect(wrapper.emitted('convert-to-quotation')).toBeUndefined()
  })

  it('is disabled while the cart is saving a change', async () => {
    const wrapper = mountPanel({ canConvertToQuotation: true, isMutating: true })
    expect(trigger(wrapper).attributes('aria-disabled')).toBe('true')
    await trigger(wrapper).trigger('click')
    expect(wrapper.emitted('convert-to-quotation')).toBeUndefined()
  })

  it('is reachable in the mobile sheet too, without the desktop toggle', async () => {
    const wrapper = mountPanel({ canConvertToQuotation: true, mobileSheet: true })

    expect(wrapper.find('[data-testid="cart-type-toggle"]').exists()).toBe(false)
    await trigger(wrapper).trigger('click')
    expect(wrapper.emitted('convert-to-quotation')).toEqual([[]])
  })
})
