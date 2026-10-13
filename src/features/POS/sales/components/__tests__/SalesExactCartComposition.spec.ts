import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { readFileSync } from 'node:fs'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import ActiveSalePanel from '../ActiveSalePanel.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SaleItemRow from '../SaleItemRow.vue'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- Vue SFCs resolve through Vite.
// @ts-ignore -- standalone TypeScript does not load the Vue transform.
import SaleTotalsFooter from '../SaleTotalsFooter.vue'
import type { ApplicablePromotion, Sale, SaleItem } from '../../interfaces/sale.types'

/*
 * Exact cart composition contracts (T11 / unit B, S1-S5 + S8 + S10).
 *
 * The accepted v0 cart is a single 12px surface whose heading reads
 * `Tu venta` + the real count above a supporting line, whose price-list band is
 * its own divider band, whose rows are divider-separated lines (image, clean
 * name + menu, details, original/current unit price, quantity controls and the
 * actual line total) and whose totals + full-width `Cobrar` close the column.
 *
 * This spec proves the PUBLIC DOM contract of that composition and, in the same
 * file, that an omitted or unrelated `portalClass` keeps the previous
 * presentation and behavior. Mounts use stubs for the native primitives only;
 * the layout contract is asserted on the real component DOM.
 *
 * jsdom has no layout engine: rendered layout, measured contrast and touch
 * ergonomics are NOT proven here. Visual smoke remains user-owned.
 */
const ENTRY = 'hf-theme hf-ui sales-entry-portal'
const MOBILE_ENTRY = `${ENTRY} sales-pos-cart`
const UNRELATED = 'hf-theme hf-ui quotations-portal'

const callbacks = {
  onSubmitPriceOverride: vi.fn(async () => undefined),
  onApplyDiscount: vi.fn(async () => undefined),
  onRemoveDiscount: vi.fn(async () => undefined),
  onRemoveItem: vi.fn(async () => undefined),
  onApplyGlobalDiscount: vi.fn(async () => undefined),
  onRemoveGlobalDiscount: vi.fn(async () => undefined),
}

function makeItem(overrides: Partial<SaleItem> = {}): SaleItem {
  return {
    id: 'item-1',
    productId: 'prod-1',
    variantId: null,
    productName: 'Aspirina 100mg',
    variantName: null,
    quantity: 2,
    unitPriceCents: 5000,
    unitPriceCurrency: 'MXN',
    ...overrides,
  }
}

const TOTALS: Pick<Sale, 'subtotalCents' | 'discountCents' | 'totalCents'> = {
  subtotalCents: 10000,
  discountCents: 1500,
  totalCents: 8500,
}

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

// ── Panel harness ───────────────────────────────────────────────────────────

function mountPanel(options: {
  portalClass?: string
  mobileSheet?: boolean
  items?: SaleItem[]
  promotions?: ApplicablePromotion[]
  appliedIds?: string[]
} = {}) {
  const { portalClass, mobileSheet = false, items = [], promotions = [], appliedIds = [] } = options
  const draft = makeDraft({ items, ...TOTALS })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  return mount(ActiveSalePanel, {
    props: {
      drafts: [draft],
      activeDraft: draft,
      activeTabId: draft.id,
      isLoadingList: false,
      isMutating: false,
      portalClass,
      mobileSheet,
      applicablePromotions: promotions,
      isLoadingPromotions: false,
      appliedManualPromotionIds: appliedIds,
      ...callbacks,
    },
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      stubs: {
        SalesTabsStrip: { template: '<div />' },
        SaleItemRow: {
          name: 'SaleItemRow',
          props: ['mobileSheet', 'composition'],
          template: '<div data-testid="row-stub" />',
        },
        SaleTotalsFooter: {
          name: 'SaleTotalsFooter',
          props: ['sale', 'isChargePending', 'themed', 'composition'],
          emits: ['charge-click', 'clear-click', 'remove-order-promo'],
          template: '<div data-testid="footer-stub" @click="$emit(\'charge-click\')"><button v-if="composition" data-testid="summary-clear-stub" @click.stop="$emit(\'clear-click\')">Vaciar</button></div>',
        },
        GlobalDiscountModal: { template: '<div />' },
        ConfirmModal: {
          props: ['open', 'title', 'confirmLabel'],
          emits: ['confirm', 'update:open'],
          template: '<div v-if="open" role="dialog"><p>{{ title }}</p><button @click="$emit(\'update:open\', false)">Cancelar</button><button @click="$emit(\'confirm\')">{{ confirmLabel }}</button></div>',
        },
        PriceListSelector: {
          name: 'PriceListSelector',
          props: ['activeDraft', 'isMutating', 'portalClass'],
          template: '<div data-testid="price-list-selector-stub" />',
        },
        UAccordion: {
          props: ['items'],
          template: '<section><h3>{{ items[0]?.label }}</h3><slot name="body" /></section>',
        },
        Accordion: {
          props: ['items'],
          template: '<section><h3>{{ items[0]?.label }}</h3><slot name="body" /></section>',
        },
        UTabs: { template: '<div />' },
        UTooltip: { template: '<div><slot /></div>' },
        UDropdownMenu: { template: '<div><slot /></div>' },
        // Nuxt UI resolves the prefixed tags to components named `Tooltip` /
        // `DropdownMenu`, so the working stub keys are the unprefixed names.
        Tooltip: { template: '<div><slot /></div>' },
        DropdownMenu: { template: '<div><slot /></div>' },
        UButton: {
          props: ['label', 'disabled'],
          emits: ['click'],
          template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
        },
        USkeleton: { template: '<div />' },
        UIcon: { template: '<i />' },
      },
    },
  })
}

describe('Exact cart composition — promotions placement and callbacks', () => {
  const promotion: ApplicablePromotion = { id: 'manual-1', title: 'Oferta real', type: 'ORDER_DISCOUNT' }

  it.each([
    { label: 'desktop', portalClass: ENTRY, mobileSheet: false },
    { label: 'mobile', portalClass: MOBILE_ENTRY, mobileSheet: true },
  ])('puts eligible promotions in the scrolling body before customer context on $label', (options) => {
    const wrapper = mountPanel({ ...options, items: [makeItem()], promotions: [promotion] })
    const body = wrapper.get('[data-testid="cart-body"]')
    const promos = body.get('[data-testid="promociones-disponibles-accordion"]')
    const customer = wrapper.get('.sales-pos-customer-state')
    expect(wrapper.findAll('[data-testid="promociones-disponibles-accordion"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="cart-footer"]').find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(false)
    expect(promos.element.compareDocumentPosition(customer.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(body.classes()).toContain('overflow-y-auto')
  })

  it.each([undefined, UNRELATED])('retains legacy footer placement for portalClass=%s', (portalClass) => {
    const wrapper = mountPanel({ portalClass, items: [makeItem()], promotions: [promotion] })
    const footer = wrapper.get('[data-testid="cart-footer"]')
    const promos = footer.get('[data-testid="promociones-disponibles-accordion"]')
    expect(wrapper.get('[data-testid="cart-body"]').find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(false)
    expect(wrapper.get('.sales-pos-customer-state').element.compareDocumentPosition(promos.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.findAll('[data-testid="promociones-disponibles-accordion"]')).toHaveLength(1)
  })

  it('preserves real apply/remove, eligibility and loading without changing sale data', async () => {
    const wrapper = mountPanel({
      portalClass: ENTRY,
      items: [makeItem()],
      promotions: [promotion, { ...promotion, id: 'ineligible', eligible: false }],
    })
    const before = JSON.parse(JSON.stringify(wrapper.props('activeDraft')))
    const body = wrapper.get('[data-testid="cart-body"]')
    await body.get('[data-testid="promo-apply-manual-1"]').trigger('click')
    expect(wrapper.emitted('apply-manual-promo')).toEqual([['manual-1']])
    expect(wrapper.props('activeDraft')).toEqual(before)
    expect(body.get('[data-testid="promo-apply-ineligible"]').attributes('disabled')).toBeDefined()
    await body.get('[data-testid="promo-apply-ineligible"]').trigger('click')
    expect(wrapper.emitted('apply-manual-promo')).toEqual([['manual-1']])
    expect(wrapper.props('activeDraft')).toEqual(before)

    await wrapper.setProps({ appliedManualPromotionIds: ['manual-1'] })
    await body.get('[data-testid="promo-remove-manual-1"]').trigger('click')
    expect(wrapper.emitted('remove-manual-promo')).toEqual([['manual-1']])
    expect(wrapper.props('activeDraft')).toEqual(before)
    await wrapper.setProps({ isLoadingPromotions: true })
    expect(body.find('[data-testid="promociones-loading"]').exists()).toBe(true)
    expect(body.find('[data-testid="promo-apply-ineligible"]').exists()).toBe(false)
    expect(wrapper.props('activeDraft')).toEqual(before)
    await wrapper.setProps({ applicablePromotions: [] })
    expect(wrapper.find('[data-testid="promociones-disponibles-accordion"]').exists()).toBe(false)
    expect(wrapper.props('activeDraft')).toEqual(before)
  })
})

describe('Exact cart composition — root marker is exact-token only', () => {
  it('marks the panel and renders the Tu venta heading with the real counts when opted in', () => {
    const wrapper = mountPanel({
      portalClass: ENTRY,
      items: [makeItem({ quantity: 2 }), makeItem({ id: 'item-2', quantity: 3 })],
    })

    expect(wrapper.get('.sales-pos-cart-panel').classes()).toContain('sales-pos-cart-composition')

    const heading = wrapper.get('[data-testid="cart-heading"]')
    expect(heading.text()).toContain('Tu venta')
    // Real line count, not a demo literal.
    expect(wrapper.get('[data-testid="cart-heading-count"]').text()).toBe('2')
    // Real unit context in the supporting line.
    const support = wrapper.get('[data-testid="cart-heading-support"]')
    expect(support.text()).toContain('5')
    expect(support.text()).toContain('unidades')
  })

  it('keeps the exact prior presentation when the opt-in is omitted', () => {
    const wrapper = mountPanel({ items: [makeItem()] })

    const root = wrapper.get('.sales-pos-cart-panel')
    expect(root.classes()).not.toContain('sales-pos-cart-composition')
    expect(root.classes()).not.toContain('sales-pos-cart-composition-sheet')
    expect(wrapper.find('[data-testid="cart-heading"]').exists()).toBe(false)
    expect(
      wrapper.get('[data-testid="cart-header"]').classes(),
    ).not.toContain('sales-pos-price-list-band')
    expect(wrapper.findComponent({ name: 'SaleItemRow' }).props('composition')).toBeFalsy()
    expect(wrapper.findComponent({ name: 'SaleTotalsFooter' }).props('composition')).toBeFalsy()
  })

  it('does not activate the new composition for an unrelated portalClass', () => {
    const wrapper = mountPanel({ portalClass: UNRELATED, items: [makeItem()] })

    const root = wrapper.get('.sales-pos-cart-panel')
    expect(root.classes()).not.toContain('sales-pos-cart-composition')
    expect(wrapper.find('[data-testid="cart-heading"]').exists()).toBe(false)
    expect(
      wrapper.get('[data-testid="cart-header"]').classes(),
    ).not.toContain('sales-pos-price-list-band')
  })

  it('marks the mobile sheet instance too, with its own modifier', () => {
    const wrapper = mountPanel({ portalClass: MOBILE_ENTRY, mobileSheet: true, items: [makeItem()] })

    const root = wrapper.get('.sales-pos-cart-panel')
    expect(root.classes()).toContain('sales-pos-cart-composition')
    expect(root.classes()).toContain('sales-pos-cart-composition-sheet')
    expect(wrapper.find('[data-testid="cart-heading"]').exists()).toBe(true)
    // The redundant Venta/Pedido toggle stays hidden inside the mobile sheet.
    expect(wrapper.find('[data-testid="cart-type-toggle"]').exists()).toBe(false)
  })
})

describe('Exact cart composition — bands, bands order and forwarded props', () => {
  it('renders the heading, then the price-list band, then the scroll body and footer', () => {
    const wrapper = mountPanel({ portalClass: ENTRY, items: [makeItem()] })

    const heading = wrapper.get('[data-testid="cart-heading"]').element
    const band = wrapper.get('[data-testid="cart-header"]').element
    const body = wrapper.get('[data-testid="cart-body"]').element
    const footer = wrapper.get('[data-testid="cart-footer"]').element

    expect(wrapper.get('[data-testid="cart-header"]').classes()).toContain('sales-pos-price-list-band')
    // DOM order contract: heading → price-list band → rows → footer.
    expect(heading.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(band.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // The price-list control and the Venta/Pedido toggle stay reachable.
    expect(wrapper.find('[data-testid="price-list-selector-stub"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cart-type-toggle"]').exists()).toBe(true)
  })

  it('forwards the composition opt-in to the row and the totals footer', () => {
    const wrapper = mountPanel({ portalClass: ENTRY, items: [makeItem()] })

    expect(wrapper.findComponent({ name: 'SaleItemRow' }).props('composition')).toBe(true)
    expect(wrapper.findComponent({ name: 'SaleTotalsFooter' }).props('composition')).toBe(true)
  })

  it('keeps the real payload and public events wired in the composition variant', async () => {
    const wrapper = mountPanel({ portalClass: ENTRY, items: [makeItem()] })

    // The footers still receive the full backend sale, not a demo total.
    const footer = wrapper.findComponent({ name: 'SaleTotalsFooter' })
    const passedSale = footer.props('sale') as Sale
    expect(passedSale.totalCents).toBe(8500)

    footer.vm.$emit('charge-click')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('charge-click')).toHaveLength(1)

    await wrapper.get('[data-testid="assign-customer-trigger"]').trigger('click')
    expect(wrapper.emitted('open-customer-assignment')).toHaveLength(1)
  })
})

describe('Exact cart composition — cart-only adapter ownership', () => {
  const panelSource = readFileSync('src/features/POS/sales/components/ActiveSalePanel.vue', 'utf8')

  it('imports the new cart adapter from ActiveSalePanel and nowhere else', () => {
    expect(panelSource).toContain("import '../styles/sales-pos-cart.css'")
    for (const name of ['SaleItemRow', 'SaleTotalsFooter']) {
      const source = readFileSync(`src/features/POS/sales/components/${name}.vue`, 'utf8')
      expect(source, `${name} must not import the cart adapter`).not.toContain('sales-pos-cart.css')
    }
    const view = readFileSync('src/features/POS/sales/views/SalesView.vue', 'utf8')
    expect(view).not.toContain("sales-pos-cart.css'")
  })
})

// ── Cart row composition ────────────────────────────────────────────────────

const rowStubs = {
  UInputNumber: {
    name: 'UInputNumber',
    props: ['modelValue', 'min', 'disabled', 'size'],
    emits: ['update:modelValue', 'blur', 'change'],
    template:
      '<input role="spinbutton" :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', Number($event.target.value))" @blur="$emit(\'blur\')" />',
  },
  UIcon: { template: '<i />' },
  UButton: {
    props: ['label', 'disabled', 'icon', 'size', 'color', 'variant'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot />{{ label }}</button>',
  },
  UBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
  UDropdownMenu: {
    name: 'UDropdownMenu',
    props: ['items', 'ui'],
    template: '<div><slot /></div>',
  },
  // The panel/resolved component name for the prefixed tag is `DropdownMenu`.
  DropdownMenu: {
    name: 'DropdownMenu',
    props: ['items', 'ui'],
    template: '<div><slot /></div>',
  },
  UTooltip: { props: ['text'], template: '<div><slot />{{ text }}</div>' },
  Tooltip: { props: ['text'], template: '<div><slot />{{ text }}</div>' },
  PriceOverrideModal: true,
  ItemDiscountModal: true,
  ProductDetailModal: true,
  AppBadge: { props: ['label'], template: '<span>{{ label }}</span>' },
  USeparator: true,
}

function mountRow(extra: Partial<InstanceType<typeof SaleItemRow>['$props']> = {}, item = makeItem()) {
  return mount(SaleItemRow, {
    props: { item, saleId: 'sale-1', ...callbacks, ...extra },
    global: { stubs: rowStubs },
  })
}

function menuLabels(wrapper: ReturnType<typeof mountRow>): string[] {
  const menu = wrapper.findComponent({ name: 'DropdownMenu' })
  const items = (menu.props('items') ?? []) as Array<Array<{ label?: string }>>
  return items.flat().map((entry) => entry.label ?? '')
}

describe('Exact cart composition — row hierarchy', () => {
  it('keeps the nested rounded card when the composition is omitted', () => {
    const wrapper = mountRow()

    const card = wrapper.get('[data-testid="sale-item-card"]')
    expect(card.classes()).toContain('sales-pos-cart-row')
    expect(card.classes()).toContain('rounded-xl')
    expect(card.classes()).not.toContain('sales-pos-cart-row-composition')
  })

  it('turns the row into a divider line with a clean name + menu and a unit-price line', () => {
    const wrapper = mountRow(
      { composition: true },
      makeItem({
        variantName: '500mg',
        priceSource: 'price_list',
        originalPriceCents: 7000,
      }),
    )

    const card = wrapper.get('[data-testid="sale-item-card"]')
    expect(card.classes()).toContain('sales-pos-cart-row')
    expect(card.classes()).toContain('sales-pos-cart-row-composition')
    expect(card.classes()).not.toContain('rounded-xl')

    // Clean name with the item menu in the same head line.
    const head = wrapper.get('[data-testid="sale-item-head"]')
    expect(head.get('[data-testid="sale-item-name"]').text()).toContain('Aspirina 100mg')
    expect(head.findAll('[data-testid="sale-item-menu"]').length).toBe(1)
    // Exactly one item menu for the composed row (no duplicate control).
    expect(wrapper.findAllComponents({ name: 'DropdownMenu' })).toHaveLength(1)

    // Available identity only: the variant, never an invented description.
    expect(wrapper.get('[data-testid="sale-item-detail"]').text()).toContain('500mg')

    // Original + current unit price context.
    const unit = wrapper.get('[data-testid="sale-item-unit"]')
    expect(unit.get('[data-testid="sale-item-unit-strike-original"]').text()).toContain('$70.00')
    expect(unit.text()).toContain('$50.00 c/u')
  })

  it('keeps quantity controls and the actual line total on the quantity row', () => {
    const wrapper = mountRow(
      { composition: true },
      makeItem({ quantity: 2, unitPriceCents: 5000, subtotalCents: 9500 }),
    )

    const qtyRow = wrapper.get('[data-testid="sale-item-qty-row"]')
    expect(qtyRow.find('input[role="spinbutton"]').exists()).toBe(true)
    expect(qtyRow.find('[data-testid="sale-item-remove"]').exists()).toBe(true)
    // Line total reads the backend subtotal, not a local recompute.
    expect(qtyRow.get('[data-testid="sale-item-line-net"]').text()).toContain('$95.00')
  })

  it('does not move the line total into the quantity row when the composition is omitted', () => {
    const wrapper = mountRow({}, makeItem({ subtotalCents: 9500 }))

    expect(wrapper.get('[data-testid="sale-item-line-net"]').text()).toContain('$95.00')
    expect(wrapper.get('[data-testid="sale-item-qty-row"]').text()).not.toContain('$95.00')
  })
})

describe('Exact cart composition — row behavior is preserved', () => {
  it('emits update-qty from the public quantity control', async () => {
    const wrapper = mountRow({ composition: true })

    const input = wrapper.get('input[role="spinbutton"]')
    await input.setValue('5')
    await input.trigger('blur')

    expect(wrapper.emitted('update-qty')).toEqual([['item-1', 5]])
  })

  it('keeps the remove, details, price and discount menu actions', () => {
    const wrapper = mountRow({ composition: true })

    const labels = menuLabels(wrapper)
    expect(labels).toContain('Ver detalles')
    expect(labels).toContain('Cambiar precio')
    expect(labels).toContain('Agregar descuento')
    expect(labels).toContain('Eliminar producto')
  })

  it('calls the real remove callback from the row control', async () => {
    const onRemoveItem = vi.fn(async () => undefined)
    const wrapper = mountRow({ composition: true, onRemoveItem })

    await wrapper.get('[data-testid="sale-item-remove"]').trigger('click')
    expect(onRemoveItem).toHaveBeenCalledWith('item-1')
  })

  it('keeps promotion controls and emits the public remove-promo event', async () => {
    const wrapper = mountRow(
      { composition: true },
      makeItem({ promotionId: 'promo-1', discountTitle: 'Descuento local' }),
    )

    const removePromo = wrapper.get('[data-testid="sale-item-remove-promo"]')
    await removePromo.trigger('click')
    expect(wrapper.emitted('remove-promo')).toEqual([['promo-1']])
  })
})

// ── Totals footer composition ───────────────────────────────────────────────

const footerStubs = {
  UButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  USeparator: true,
  UTooltip: { props: ['text'], template: '<span>{{ text }}<slot /></span>' },
  UIcon: true,
  UKbd: true,
  Tooltip: { props: ['text'], template: '<span><slot /></span>' },
}

function mountFooter(composition: boolean, overrides: Partial<Sale> = {}) {
  const sale = makeDraft({
    items: [makeItem({ quantity: 2 }), makeItem({ id: 'item-2', quantity: 3 })],
    ...TOTALS,
    ...overrides,
  })
  return mount(SaleTotalsFooter, {
    props: { sale, composition },
    global: { stubs: footerStubs },
  })
}

describe('Exact cart composition — summary clear action', () => {
  it('places Vaciar beside the real count and requests clear without changing the sale', async () => {
    const wrapper = mountFooter(true)
    const before = JSON.parse(JSON.stringify(wrapper.props('sale')))
    const summary = wrapper.get('[data-testid="totals-summary"]')
    const count = summary.get('[data-testid="totals-count"]')
    const clear = summary.get('[data-testid="totals-clear"]')

    expect(clear.text()).toBe('Vaciar')
    expect(clear.element.parentElement).toBe(count.element.parentElement)
    expect(count.text()).toContain('2 artículos')
    expect(count.text()).toContain('5 unidades')
    await clear.trigger('click')
    expect(wrapper.emitted('clear-click')).toEqual([[]])
    expect(wrapper.emitted('charge-click')).toBeUndefined()
    expect(wrapper.props('sale')).toEqual(before)
  })

  it('keeps the legacy footer unchanged when composition is omitted', async () => {
    const wrapper = mountFooter(false)
    expect(wrapper.find('[data-testid="totals-summary"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="totals-clear"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="totals-count"]').text()).toContain('2 Artic · 5 Unidad')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('charge-click')).toEqual([[]])
    expect(wrapper.emitted('clear-click')).toBeUndefined()
  })

  it('prevents clear while the sale is mutating or empty', async () => {
    const wrapper = mountFooter(true)
    const before = JSON.parse(JSON.stringify(wrapper.props('sale')))
    await wrapper.setProps({ isChargePending: true })
    expect(wrapper.get('[data-testid="totals-clear"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="totals-clear"]').trigger('click')
    expect(wrapper.emitted('clear-click')).toBeUndefined()
    expect(wrapper.props('sale')).toEqual(before)

    await wrapper.setProps({ isChargePending: false, sale: makeDraft({ items: [], ...TOTALS }) })
    const empty = JSON.parse(JSON.stringify(wrapper.props('sale')))
    expect(wrapper.get('[data-testid="totals-clear"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="totals-clear"]').trigger('click')
    expect(wrapper.emitted('clear-click')).toBeUndefined()
    expect(wrapper.props('sale')).toEqual(empty)
  })

  it('uses the existing panel confirmation and does not clear on cancel', async () => {
    const wrapper = mountPanel({ portalClass: ENTRY, items: [makeItem()] })
    const before = JSON.parse(JSON.stringify(wrapper.props('activeDraft')))
    await wrapper.get('[data-testid="summary-clear-stub"]').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Quitar todos los productos')
    expect(wrapper.emitted('clear-items')).toBeUndefined()
    expect(wrapper.props('activeDraft')).toEqual(before)

    await wrapper.get('[role="dialog"]').findAll('button')[0]!.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('clear-items')).toBeUndefined()
    expect(wrapper.props('activeDraft')).toEqual(before)

    await wrapper.get('[data-testid="summary-clear-stub"]').trigger('click')
    const confirm = wrapper.get('[role="dialog"]').findAll('button')[1]!
    expect(confirm.text()).toBe('Quitar todos')
    await confirm.trigger('click')
    expect(wrapper.emitted('clear-items')).toEqual([[]])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.props('activeDraft')).toEqual(before)
  })
})

describe('Exact cart composition — totals footer', () => {
  it('reads the count line in the accepted wording and labels the currency when opted in', () => {
    const sale = makeDraft({
      items: [makeItem({ quantity: 2 }), makeItem({ id: 'item-2', quantity: 3 })],
      ...TOTALS,
    })
    const wrapper = mount(SaleTotalsFooter, {
      props: { sale, composition: true },
      global: { stubs: footerStubs },
    })
    expect(wrapper.classes()).toContain('sales-pos-totals-composition')
    const count = wrapper.get('[data-testid="totals-count"]').text()
    expect(count).toContain('2 artículos')
    expect(count).toContain('5 unidades')
    expect(wrapper.get('[data-testid="totals-currency"]').text()).toContain('Moneda MXN')
  })

  it('keeps the previous count wording and no extra label when the opt-in is omitted', () => {
    const wrapper = mountFooter(false)

    expect(wrapper.classes()).not.toContain('sales-pos-totals-composition')
    expect(wrapper.get('[data-testid="totals-count"]').text()).toContain('2 Artic')
    expect(wrapper.get('[data-testid="totals-count"]').text()).toContain('5 Unidad')
    expect(wrapper.find('[data-testid="totals-currency"]').exists()).toBe(false)
  })

  it('still renders the backend totals and emits charge-click in the composition variant', async () => {
    const wrapper = mountFooter(true)

    expect(wrapper.get('[data-testid="total-amount"]').text()).toContain('$85.00')
    expect(wrapper.html()).not.toContain('$340.00')

    const charge = wrapper.findAll('button').find((button) => button.text().includes('Cobrar'))!
    await charge.trigger('click')
    expect(wrapper.emitted('charge-click')).toHaveLength(1)
  })

  it('keeps Cobrar disabled without items in the composition variant', () => {
    const sale = makeDraft({ items: [], ...TOTALS })
    const wrapper = mount(SaleTotalsFooter, {
      props: { sale, composition: true },
      global: { stubs: footerStubs },
    })

    const charge = wrapper.findAll('button').find((button) => button.text().includes('Cobrar'))!
    expect(charge.attributes('disabled')).toBeDefined()
  })
})

describe('Exact cart composition — S11 sale options live in the heading', () => {
  it('places the sale options menu in the heading without a duplicate clear icon', () => {
    const wrapper = mountPanel({ portalClass: ENTRY, items: [makeItem()] })

    const heading = wrapper.get('[data-testid="cart-heading"]')
    const toolbar = heading.get('[data-testid="cart-actions-toolbar"]')
    expect(toolbar.classes()).toContain('sales-pos-cart-toolbar')
    expect(wrapper.get('[data-testid="cart-footer"]').find('[data-testid="cart-actions-toolbar"]').exists()).toBe(false)

    // Only the options trigger: "Vaciar" in the totals is the single clear action.
    const buttons = toolbar.findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.attributes('aria-label')).toBe('Opciones de venta')
    expect(wrapper.findAll('[data-testid="summary-clear-stub"]')).toHaveLength(1)
  })

  it('keeps the legacy toolbar with clear and options at the bottom when not opted in', () => {
    const wrapper = mountPanel({ items: [makeItem()] })

    const footerToolbar = wrapper.get('[data-testid="cart-footer"] [data-testid="cart-actions-toolbar"]')
    expect(footerToolbar.findAll('button')).toHaveLength(2)
    expect(wrapper.find('[data-testid="cart-heading"]').exists()).toBe(false)
  })

  it('hides the heading options while the cart is empty, like the legacy toolbar', () => {
    const wrapper = mountPanel({ portalClass: ENTRY, items: [] })

    expect(wrapper.get('[data-testid="cart-heading"]').find('[data-testid="cart-actions-toolbar"]').exists()).toBe(false)
  })
})
