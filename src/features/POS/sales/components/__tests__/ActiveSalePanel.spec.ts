import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ActiveSalePanel from '../ActiveSalePanel.vue'
import type { ApplicablePromotion, Sale } from '../../interfaces/sale.types'

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

function mountPanel(
  activeDraft: Sale | null,
  isCustomerMutationPending = false,
  promoOverrides: {
    applicablePromotions?: ApplicablePromotion[]
    isLoadingPromotions?: boolean
    appliedManualPromotionIds?: string[]
  } = {},
) {
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
      // C.4: optional promo data — tests pass these explicitly when needed.
      applicablePromotions: promoOverrides.applicablePromotions,
      isLoadingPromotions: promoOverrides.isLoadingPromotions ?? false,
      appliedManualPromotionIds: promoOverrides.appliedManualPromotionIds ?? [],
    },
    global: {
      stubs: {
        SalesTabsStrip: { template: '<div />' },
        SaleItemRow: { template: '<div />' },
        // B.2: stub forwards emits so we can test remove-order-promo / charge-click propagation.
        SaleTotalsFooter: {
          name: 'SaleTotalsFooter',
          emits: ['charge-click', 'remove-order-promo'],
          props: ['sale', 'isChargePending'],
          template:
            '<div data-testid="sale-totals-footer-stub" :data-sale-id="sale?.id" @click="$emit(\'charge-click\')" />',
        },
        GlobalDiscountModal: { template: '<div />' },
        ConfirmModal: { template: '<div />' },
        // C.4: stub forwards apply/remove emits so tests can verify the
        // accordion's event bubbling reaches ActiveSalePanel's parent emits.
        PromocionesDisponiblesAccordion: {
          name: 'PromocionesDisponiblesAccordion',
          emits: ['apply', 'remove'],
          props: ['promotions', 'loading', 'appliedIds'],
          template:
            '<div data-testid="promociones-accordion-stub" '
            + ':data-loading="loading" '
            + ':data-applied-count="(appliedIds ?? []).length">'
            + '<button data-testid="accordion-apply-btn" @click="$emit(\'apply\', \'promo-test-id\')">apply</button>'
            + '<button data-testid="accordion-remove-btn" @click="$emit(\'remove\', \'promo-test-id\')">remove</button>'
            + '</div>',
        },
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

// ── B.2: SaleTotalsFooter prop + event wiring ────────────────────────────────

describe('ActiveSalePanel B.2 — SaleTotalsFooter wiring', () => {
  it('passes the activeDraft to SaleTotalsFooter (not just items)', () => {
    const draft = makeDraft({ subtotalCents: 10000, discountCents: 1500, totalCents: 8500 })
    const wrapper = mountPanel(draft)

    const footer = wrapper.findComponent({ name: 'SaleTotalsFooter' })
    expect(footer.exists()).toBe(true)
    const passedSale = footer.props('sale') as Sale
    expect(passedSale).toBeDefined()
    expect(passedSale.id).toBe('sale-1')
    expect(passedSale.subtotalCents).toBe(10000)
    expect(passedSale.discountCents).toBe(1500)
    expect(passedSale.totalCents).toBe(8500)
  })

  it('forwards remove-order-promo up to the parent (activeSalePanel emits it)', async () => {
    const draft = makeDraft({
      appliedOrderPromotion: {
        promotionId: 'promo-order-uuid',
        discountType: 'amount',
        discountValue: 500,
        discountAmountCents: 500,
        discountTitle: 'Cupón Test',
      },
    })
    const wrapper = mountPanel(draft)

    await wrapper.get('[data-testid="sale-totals-footer-stub"]').trigger('click')
    // The stub currently fires charge-click on click — use $emit directly to test
    // the order-promo path without rewriting the stub DOM for every event.
    const footer = wrapper.findComponent({ name: 'SaleTotalsFooter' })
    footer.vm.$emit('remove-order-promo', 'promo-order-uuid')
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('remove-order-promo')
    expect(emitted).toBeTruthy()
    expect(emitted).toHaveLength(1)
    expect(emitted![0]).toEqual(['promo-order-uuid'])
  })

  it('forwards remove-order-promo with the right payload from the footer stub', () => {
    const draft = makeDraft({
      appliedOrderPromotion: {
        promotionId: 'promo-other',
        discountType: 'percentage',
        discountValue: 10,
        discountAmountCents: 1000,
        discountTitle: 'Black Friday',
      },
    })
    const wrapper = mountPanel(draft)

    const footer = wrapper.findComponent({ name: 'SaleTotalsFooter' })
    // Direct emit on the stub vm (the child stub doesn't actually render a button).
    footer.vm.$emit('remove-order-promo', 'promo-other')

    const emitted = wrapper.emitted('remove-order-promo')
    expect(emitted).toBeTruthy()
    expect(emitted![0]).toEqual(['promo-other'])
  })

  it('still forwards charge-click to the parent (preserved behavior)', async () => {
    const draft = makeDraft()
    const wrapper = mountPanel(draft)

    await wrapper.get('[data-testid="sale-totals-footer-stub"]').trigger('click')

    expect(wrapper.emitted('charge-click')).toBeTruthy()
  })

  it('does not render SaleTotalsFooter when there is no active draft', () => {
    const wrapper = mountPanel(null)
    expect(wrapper.findComponent({ name: 'SaleTotalsFooter' }).exists()).toBe(false)
  })
})

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

// ── C.4: PromocionesDisponiblesAccordion wiring ─────────────────────────────

describe('ActiveSalePanel C.4 — PromocionesDisponiblesAccordion wiring', () => {
  const samplePromotions: ApplicablePromotion[] = [
    { id: 'promo-a', title: '2x1 Aspirinas', type: 'PRODUCT_DISCOUNT' },
    { id: 'promo-b', title: '10% en subtotal', type: 'ORDER_DISCOUNT' },
  ]

  it('does NOT mount the accordion when applicablePromotions is undefined or empty', () => {
    const wrapperEmpty = mountPanel(makeDraft(), false, { applicablePromotions: [] })
    expect(wrapperEmpty.find('[data-testid="promociones-accordion-stub"]').exists()).toBe(false)

    const wrapperUndef = mountPanel(makeDraft(), false, {})
    expect(wrapperUndef.find('[data-testid="promociones-accordion-stub"]').exists()).toBe(false)
  })

  it('mounts the accordion ABOVE SaleTotalsFooter and passes the promotions, loading, and appliedIds props', () => {
    const wrapper = mountPanel(makeDraft(), false, {
      applicablePromotions: samplePromotions,
      isLoadingPromotions: false,
      appliedManualPromotionIds: ['promo-a'],
    })

    const accordion = wrapper.findComponent({ name: 'PromocionesDisponiblesAccordion' })
    expect(accordion.exists()).toBe(true)

    // Prop pass-through contract.
    expect(accordion.props('promotions')).toEqual(samplePromotions)
    expect(accordion.props('loading')).toBe(false)
    expect(accordion.props('appliedIds')).toEqual(['promo-a'])

    // Mount-order contract: accordion must come BEFORE the totals footer
    // in the rendered DOM so the seller sees promos above the totals row.
    const accordionNode = wrapper.find('[data-testid="promociones-accordion-stub"]').element
    const footerNode = wrapper.find('[data-testid="sale-totals-footer-stub"]').element
    const docOrder = accordionNode.compareDocumentPosition(footerNode)
    // Node.DOCUMENT_POSITION_FOLLOWING === 4 → accordion precedes footer.
    expect(docOrder & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('passes isLoadingPromotions=true through to the accordion when the query is fetching', () => {
    const wrapper = mountPanel(makeDraft(), false, {
      applicablePromotions: samplePromotions,
      isLoadingPromotions: true,
      appliedManualPromotionIds: [],
    })

    const accordion = wrapper.findComponent({ name: 'PromocionesDisponiblesAccordion' })
    expect(accordion.props('loading')).toBe(true)
  })

  it('re-emits the accordion\'s `apply` event upward as `apply-manual-promo` with the promotionId', async () => {
    const wrapper = mountPanel(makeDraft(), false, { applicablePromotions: samplePromotions })

    const accordion = wrapper.findComponent({ name: 'PromocionesDisponiblesAccordion' })
    accordion.vm.$emit('apply', 'promo-test-id')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('apply-manual-promo')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['promo-test-id'])
  })

  it('re-emits the accordion\'s `remove` event upward as `remove-manual-promo` with the promotionId', async () => {
    const wrapper = mountPanel(makeDraft(), false, { applicablePromotions: samplePromotions })

    const accordion = wrapper.findComponent({ name: 'PromocionesDisponiblesAccordion' })
    accordion.vm.$emit('remove', 'promo-test-id')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('remove-manual-promo')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['promo-test-id'])
  })
})
