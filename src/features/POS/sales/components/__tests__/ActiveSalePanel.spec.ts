import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
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
  // pos-price-list-tiers: PriceListSelector uses useQuery for its price-
  // lists fetch. The shared QueryClient here exists only to satisfy that
  // injection — none of these tests assert on the query, so we don't seed
  // it (an empty cache is fine; the selector's UI renders regardless).
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

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
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        SalesTabsStrip: { template: '<div />' },
        // C.5: SaleItemRow stub now exposes a `remove-promo` button so we can
        // drive the per-line auto-promo veto event forwarding contract.
        SaleItemRow: {
          name: 'SaleItemRow',
          emits: ['update-qty', 'remove-promo'],
          template:
            '<div>'
            + '<button data-testid="item-remove-promo" @click="$emit(\'remove-promo\', \'line-promo-uuid\')">remove-promo</button>'
            + '</div>',
        },
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
        // pos-price-list-tiers: stub PriceListSelector so the existing
        // panel tests don't depend on the (unstubbable) UInputMenu.
        PriceListSelector: {
          name: 'PriceListSelector',
          props: ['activeDraft', 'isMutating'],
          emits: ['change-price-list', 'request-confirm'],
          template:
            '<div data-testid="price-list-selector-stub" '
            + ':data-items-count="(activeDraft?.items ?? []).length" />',
        },
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

// ── C.5: SaleItemRow per-line `remove-promo` forwarding ─────────────────────
//
// Spec §7a: per-line auto-promo veto (the remove control on the promo badge
// of a SaleItemRow) MUST route up to SalesView where it opens the same
// confirmation dialog + veto flow as the order-level `remove-order-promo`.

describe('ActiveSalePanel C.5 — SaleItemRow per-line remove-promo forwarding', () => {
  it('forwards the per-line `remove-promo` event up to the parent (ActiveSalePanel emits it)', async () => {
    // We need at least one item in the draft so the v-for over activeDraft.items
    // renders a SaleItemRow stub (otherwise there's no row to emit from).
    const draft = makeDraft({
      items: [{
        id: 'item-1',
        productId: 'prod-1',
        variantId: null,
        productName: 'A',
        variantName: null,
        quantity: 1,
        unitPriceCents: 10000,
        unitPriceCurrency: 'MXN',
        promotionId: 'line-promo-uuid',
      }],
    })
    const wrapper = mountPanel(draft)

    const item = wrapper.findComponent({ name: 'SaleItemRow' })
    expect(item.exists()).toBe(true)

    // Drive the event the way the real badge would: clicking the remove
    // control on the SaleItemBadges row re-emits as `remove-promo`.
    item.vm.$emit('remove-promo', 'line-promo-uuid')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('remove-promo')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['line-promo-uuid'])
  })
})

// ── pos-price-list-tiers: PriceListSelector + confirm dialog wiring ───────────

describe('ActiveSalePanel — PriceListSelector wiring (pos-price-list-tiers)', () => {
  // Helper that mounts the panel AND stubs PriceListSelector so we can
  // drive its emits from the test. The component's job is just to forward
  // events and show a confirm dialog; the dropdown internals are covered
  // by PriceListSelector.test.ts.
  //
  // We use `mountWithUApp` because the real ActiveSalePanel renders
  // UTooltip (which depends on UApp's TooltipProvider context).

  function mountPanelWithSelector(draft: Sale | null) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })

    return mountWithUApp(ActiveSalePanel, {
      props: {
        drafts: draft ? [draft] : [],
        activeDraft: draft,
        activeTabId: draft?.id ?? null,
        isLoadingList: false,
        isMutating: false,
        onSubmitPriceOverride: vi.fn(async () => undefined),
        onApplyDiscount: vi.fn(async () => undefined),
        onRemoveDiscount: vi.fn(async () => undefined),
        onRemoveItem: vi.fn(async () => undefined),
        onApplyGlobalDiscount: vi.fn(async () => undefined),
        onRemoveGlobalDiscount: vi.fn(async () => undefined),
        applicablePromotions: [],
        isLoadingPromotions: false,
        appliedManualPromotionIds: [],
      },
      global: {
        plugins: [[VueQueryPlugin, { queryClient }]],
        stubs: {
          SalesTabsStrip: { template: '<div />' },
          SaleItemRow: { template: '<div />' },
          SaleTotalsFooter: {
            name: 'SaleTotalsFooter',
            emits: ['charge-click', 'remove-order-promo'],
            props: ['sale', 'isChargePending'],
            template: '<div data-testid="sale-totals-footer-stub" />',
          },
          GlobalDiscountModal: { template: '<div />' },
          // ConfirmModal stub: surfaces its `open` prop + the title prop +
          // a clickable confirm button so we can drive the price-list
          // confirm flow without the real UModal.
          ConfirmModal: {
            name: 'ConfirmModal',
            props: ['open', 'title', 'description', 'confirmLabel', 'cancelLabel', 'confirmColor', 'loading'],
            emits: ['update:open', 'confirm', 'cancel'],
            template:
              '<div data-testid="confirm-modal">'
              + '<p data-testid="confirm-modal-open">{{ open }}</p>'
              + '<p data-testid="confirm-modal-title">{{ title }}</p>'
              + '<p data-testid="confirm-modal-confirm-color">{{ confirmColor }}</p>'
              + '<button data-testid="confirm-modal-confirm" @click="$emit(\'confirm\')">confirm</button>'
              + '<button data-testid="confirm-modal-cancel" @click="$emit(\'update:open\', false); $emit(\'cancel\')">cancel</button>'
              + '</div>',
          },
          PromocionesDisponiblesAccordion: { template: '<div />' },
          UTabs: { template: '<div />' },
          UTooltip: { template: '<div><slot /></div>' },
          UDropdownMenu: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          USkeleton: { template: '<div />' },
          UIcon: { template: '<i />' },
          // PriceListSelector stub: surfaces `active-draft` and `is-mutating`
          // as data attributes + a button that drives each emit. The
          // `request-confirm` button uses the itemCount to decide which
          // event is appropriate (mirrors the real component's contract).
          PriceListSelector: {
            name: 'PriceListSelector',
            props: ['activeDraft', 'isMutating'],
            emits: ['change-price-list', 'request-confirm'],
            template:
              '<div data-testid="price-list-selector-stub" '
              + ':data-items-count="(activeDraft?.items ?? []).length">'
              + '<button data-testid="pls-change-btn" @click="$emit(\'change-price-list\', \'list-mayoreo\')">change</button>'
              + '<button data-testid="pls-confirm-btn" @click="$emit(\'request-confirm\', \'list-mayoreo\')">request-confirm</button>'
              + '<button data-testid="pls-clear-btn" @click="$emit(\'change-price-list\', null)">clear</button>'
              + '</div>',
          },
        },
      },
    })
  }

  it('renders PriceListSelector in the panel when an active draft is present', () => {
    const wrapper = mountPanelWithSelector(makeDraft({ items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }] }))

    const selector = wrapper.findComponent({ name: 'PriceListSelector' })
    expect(selector.exists()).toBe(true)
    expect(selector.props('activeDraft')).toBeDefined()
  })

  it('forwards `change-price-list` from PriceListSelector up to the parent (no confirm dialog)', async () => {
    const draft = makeDraft({ items: [] })
    const wrapper = mountPanelWithSelector(draft)

    const selector = wrapper.findComponent({ name: 'PriceListSelector' })
    selector.vm.$emit('change-price-list', 'list-mayoreo')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('change-price-list')
    expect(events).toBeTruthy()
    expect(events).toHaveLength(1)
    expect(events![0]).toEqual(['list-mayoreo'])

    // The price-list ConfirmModal must NOT have opened — empty-sale flow
    // bypasses it (the parent applies immediately). We identify the
    // price-list modal by its title prop ("Cambiar lista de precios") and
    // check its `open` flag specifically.
    const priceListModal = wrapper.findAll('[data-testid="confirm-modal"]')
      .find((m) => m.text().includes('Cambiar lista de precios'))
    expect(priceListModal).toBeDefined()
    expect(priceListModal!.find('[data-testid="confirm-modal-open"]').text()).toBe('false')
  })

  it('opens the price-list ConfirmModal when `request-confirm` fires on a sale with items', async () => {
    const draft = makeDraft({
      items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }],
    })
    const wrapper = mountPanelWithSelector(draft)

    const selector = wrapper.findComponent({ name: 'PriceListSelector' })
    selector.vm.$emit('request-confirm', 'list-mayoreo')
    await wrapper.vm.$nextTick()

    // The price-list ConfirmModal is one of the ConfirmModal stubs in the
    // tree. We identify it by its title prop ("Cambiar lista de precios").
    const modal = wrapper.findAll('[data-testid="confirm-modal"]').find((m) => m.text().includes('Cambiar lista de precios'))
    expect(modal).toBeDefined()
    expect(modal!.find('[data-testid="confirm-modal-open"]').text()).toBe('true')
    expect(modal!.text()).toContain('Cambiar lista de precios')
  })

  it('emits `change-price-list` from the parent when the price-list confirm dialog is accepted', async () => {
    const draft = makeDraft({
      items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'A', variantName: null, quantity: 1, unitPriceCents: 1000, unitPriceCurrency: 'MXN' }],
    })
    const wrapper = mountPanelWithSelector(draft)

    // Open the modal via the selector's `request-confirm`.
    const selector = wrapper.findComponent({ name: 'PriceListSelector' })
    selector.vm.$emit('request-confirm', 'list-mayoreo')
    await wrapper.vm.$nextTick()

    // Locate the price-list modal by its title and click its confirm button.
    const modal = wrapper.findAll('[data-testid="confirm-modal"]')
      .find((m) => m.text().includes('Cambiar lista de precios'))
    expect(modal).toBeDefined()
    const confirmBtn = modal!.find('[data-testid="confirm-modal-confirm"]')
    await confirmBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('change-price-list')
    expect(events).toBeTruthy()
    // The id forwarded from the confirm dialog must match what the
    // selector originally requested.
    expect(events![events!.length - 1]).toEqual(['list-mayoreo'])
  })
})
