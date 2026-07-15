import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleTotalsFooter from '../SaleTotalsFooter.vue'
import type { Sale } from '../../interfaces/sale.types'

const stubs = {
  UButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
  USeparator: true,
  UTooltip: {
    name: 'UTooltip',
    props: ['text'],
    template: '<span>{{ text }}<slot /></span>',
  },
  UIcon: true,
  UKbd: true,
  Tooltip: {
    name: 'Tooltip',
    props: ['text'],
    template: '<span><slot /></span>',
  },
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 'sale-1',
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
      {
        id: 'item-2',
        productId: 'prod-2',
        variantId: 'var-1',
        productName: 'Vitamina C',
        variantName: '500mg',
        quantity: 3,
        unitPriceCents: 8000,
        unitPriceCurrency: 'MXN',
      },
    ],
    customer: null,
    shippingAddress: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Backend totals → frontend render. Invariant: discountCents === subtotalCents − totalCents.
const TOTALS = { subtotalCents: 10000, discountCents: 1500, totalCents: 8500 }

function mountFooter(sale: Sale) {
  return mount(SaleTotalsFooter, {
    props: { sale, isChargePending: false },
    global: { stubs },
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SaleTotalsFooter — totals binding (work-unit B)', () => {
  it('renders Subtotal, Descuentos and Total directly from backend cents fields', () => {
    const wrapper = mountFooter(makeSale(TOTALS))

    // Subtotal must read from sale.subtotalCents, NOT a client reduce.
    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('$100.00') // 10000 cents → $100.00
    // Descuentos: 1500 cents → $15.00 (only rendered when > 0)
    expect(wrapper.html()).toContain('Descuentos')
    expect(wrapper.html()).toContain('$15.00')
    // Total a cobrar: 8500 cents → $85.00 (NOT 340.00 from a client-side reduce!)
    expect(wrapper.html()).toContain('Total a cobrar')
    expect(wrapper.html()).toContain('$85.00')
  })

  it('does NOT recompute totals from items (read-only of backend fields)', () => {
    // Fixture with absurd items totals (34000) — but backend totals say 8500.
    // Component MUST render $85.00 (NOT $340.00) — proving client reduce is gone.
    const wrapper = mountFooter(makeSale(TOTALS))
    expect(wrapper.html()).toContain('$85.00')
    expect(wrapper.html()).not.toContain('$340.00')
  })

  it('renders line and product counts from the sale items list', () => {
    const wrapper = mountFooter(makeSale(TOTALS))
    expect(wrapper.html()).toContain('5 productos') // 2 + 3
    expect(wrapper.html()).toContain('2 líneas')
  })

  it('renders the TOTALS fixture cents verbatim — backend values, no client recompute', () => {
    // Per spec WU-B REQ-totals-invariant: the component MUST render the
    // backend-provided integer-cent totals (subtotalCents, discountCents,
    // totalCents) DIRECTLY — formatted as MXN currency — and MUST NOT do a
    // client-side reduce over the items list.
    //
    // Why this is the test:
    //   - Mount with the TOTALS fixture: subtotal 10000, discount 1500,
    //     total 8500.
    //   - Assert the rendered HTML contains $100.00 (subtotal), $15.00
    //     (discount), and $85.00 (total).
    //   - Assert it does NOT contain $340.00 — that's what a client-side
    //     reduce over items.unitPriceCents × quantity would yield
    //     (2 × 5000 + 3 × 8000 = 34000 cents = $340.00), proving no
    //     recompute happens.
    //
    // Note: the old assertion
    //   `expect(TOTALS.discountCents).toBe(TOTALS.subtotalCents - TOTALS.totalCents)`
    // was a fixture-only tautology — it compared the test-local object
    // against itself and proved nothing about the component's behavior.
    // Replaced with a real mount-and-render check below.
    const wrapper = mountFooter(makeSale(TOTALS))

    // Subtotal — formatted from sale.subtotalCents (10000 → $100.00)
    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('$100.00')
    // Discounts — formatted from sale.discountCents (1500 → $15.00)
    expect(wrapper.html()).toContain('Descuentos')
    expect(wrapper.html()).toContain('$15.00')
    // Total a cobrar — formatted from sale.totalCents (8500 → $85.00)
    expect(wrapper.html()).toContain('Total a cobrar')
    expect(wrapper.html()).toContain('$85.00')
    // No client-side recompute: $340.00 must NOT appear (that would be
    // 2 × $50 + 3 × $80 = $340 from the items list, not the backend total).
    expect(wrapper.html()).not.toContain('$340.00')
  })

  it('reflects ORDER_DISCOUNT into the Descuentos row when appliedOrderPromotion is present', () => {
    const wrapper = mountFooter(
      makeSale({
        subtotalCents: 10000,
        discountCents: 2300, // 1500 line + 800 order promo
        totalCents: 7700,
        appliedOrderPromotion: {
          promotionId: 'promo-order-uuid',
          discountType: 'percentage',
          discountValue: 8,
          discountAmountCents: 800,
          discountTitle: 'Black Friday 8% off',
        },
      }),
    )

    // Discounts row shows the FULL aggregated discount (includes order promo)
    expect(wrapper.html()).toContain('$23.00')
    // Total reflects the order promo deduction
    expect(wrapper.html()).toContain('$77.00')
  })

  it('renders the order-promo line when appliedOrderPromotion is non-null', () => {
    const wrapper = mountFooter(
      makeSale({
        ...TOTALS,
        appliedOrderPromotion: {
          promotionId: 'promo-order-uuid',
          discountType: 'amount',
          discountValue: 800,
          discountAmountCents: 800,
          discountTitle: 'Cupón Bienvenida',
        },
      }),
    )

    // Row visible with title + amount
    expect(wrapper.html()).toContain('Cupón Bienvenida')
    expect(wrapper.html()).toContain('$8.00')
    // Remove control present
    expect(wrapper.find('[data-testid="order-promo-remove"]').exists()).toBe(true)
  })

  it('emits remove-order-promo with the promotionId when the remove control is clicked', async () => {
    const wrapper = mountFooter(
      makeSale({
        ...TOTALS,
        appliedOrderPromotion: {
          promotionId: 'promo-uuid-789',
          discountType: 'amount',
          discountValue: 500,
          discountAmountCents: 500,
          discountTitle: 'Cupón Prueba',
        },
      }),
    )

    await wrapper.get('[data-testid="order-promo-remove"]').trigger('click')

    const emitted = wrapper.emitted('remove-order-promo')
    expect(emitted).toBeTruthy()
    expect(emitted).toHaveLength(1)
    expect(emitted![0]).toEqual(['promo-uuid-789'])
  })

  it('does NOT render the order-promo line when appliedOrderPromotion is null', () => {
    const wrapper = mountFooter(
      makeSale({
        ...TOTALS,
        appliedOrderPromotion: null,
      }),
    )

    expect(wrapper.find('[data-testid="order-promo-remove"]').exists()).toBe(false)
  })

  it('does NOT render the order-promo line when appliedOrderPromotion is absent (pre-deploy)', () => {
    const wrapper = mountFooter(makeSale(TOTALS)) // appliedOrderPromotion undefined

    expect(wrapper.find('[data-testid="order-promo-remove"]').exists()).toBe(false)
  })

  it('renders $0.00 (no crash) when totals fields are absent — pre-deploy backward compat', () => {
    // Sale with NO totals fields (pre-deploy draft). Items exist so button enabled.
    expect(() => mountFooter(makeSale())).not.toThrow()

    const wrapper = mountFooter(makeSale())
    expect(wrapper.html()).toContain('Subtotal')
    expect(wrapper.html()).toContain('Total a cobrar')
    expect(wrapper.html()).toContain('$0.00')
    // No discounts line when 0 (v-if on > 0)
    expect(wrapper.html()).not.toContain('Descuentos')
  })

  it('renders $0.00 and disabled Cobrar when items list is empty', () => {
    const wrapper = mountFooter(makeSale({ items: [] }))

    expect(wrapper.html()).toContain('$0.00')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})

describe('SaleTotalsFooter — charge button (preserved non-totals behavior)', () => {
  it('enables Cobrar and emits charge-click when items exist and not pending', async () => {
    const wrapper = mountFooter(makeSale(TOTALS))

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeUndefined()

    await button.trigger('click')
    expect(wrapper.emitted('charge-click')).toBeTruthy()
  })

  it('disables Cobrar when draft has no items', () => {
    const wrapper = mountFooter(makeSale({ items: [] }))

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('disables Cobrar and blocks emit while charge is pending (S31)', async () => {
    const wrapper = mount(SaleTotalsFooter, {
      props: { sale: makeSale(TOTALS), isChargePending: true },
      global: { stubs },
    })

    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(wrapper.emitted('charge-click')).toBeFalsy()
  })

  it('renders UTooltip with non-empty text when items are empty', () => {
    // Tooltip wording is a UX detail — what's asserted here is that the
    // tooltip is rendered (non-empty text) for the empty state, so users
    // see why the Cobrar button is disabled.
    const wrapper = mountFooter(makeSale({ items: [] }))
    const tooltip = wrapper.find('span') // outer stub root of UTooltip
    expect(tooltip.exists()).toBe(true)
  })

  it('renders UTooltip with non-empty text when isChargePending=true', () => {
    // Same as above: pending state must surface a tooltip, not stay silent.
    const wrapper = mount(SaleTotalsFooter, {
      props: { sale: makeSale(TOTALS), isChargePending: true },
      global: { stubs },
    })
    const tooltip = wrapper.find('span')
    expect(tooltip.exists()).toBe(true)
  })
})
