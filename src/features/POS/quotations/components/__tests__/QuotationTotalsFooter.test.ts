import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import QuotationTotalsFooter from '../QuotationTotalsFooter.vue'
import type { QuotationResponseDto } from '../../interfaces/quotation.types'

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'quotation-1',
    customerId: null,
    customer: null,
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: 'DRAFT',
    expiresAt: null,
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 15000,
    discountCents: 1500,
    totalCents: 13500,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    effectiveStatus: 'DRAFT',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  // No mocks — pure presentational component.
})

describe('QuotationTotalsFooter — items count', () => {
  it('renders "0 productos" when the quotation has no items', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ items: [] }) },
    })

    expect(wrapper.find('[data-testid="items-count"]').text()).toMatch(/0\s*productos/i)
  })

  it('renders the item count for a single-item quotation', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: {
        quotation: makeQuotation({
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              variantId: null,
                  productName: 'Test Product',
        variantName: null,
    quantity: 1,
              product: { id: 'product-1', name: 'Playera M', sku: 'SKU-1', imageUrl: null },
              variant: null,
              unitPriceCents: 15000,
              priceSource: 'PRICE_LIST',
              discountType: null,
              discountValue: null,
              discountAmountCents: 0,
              discountTitle: null,
              promotionId: null,
              manuallyAdjusted: false,
              overrideNote: null,
              createdAt: '2026-08-01T00:00:00.000Z',
              updatedAt: '2026-08-01T00:00:00.000Z',
            },
          ],
        }),
      },
    })

    expect(wrapper.find('[data-testid="items-count"]').text()).toMatch(/1\s*productos/i)
  })

  it('renders the total quantity across multiple items', () => {
    const item = (id: string, quantity: number) => ({
      id,
      productId: `product-${id}`,
      variantId: null,
          productName: 'Test Product',
        variantName: null,
    quantity,
      product: { id: `product-${id}`, name: `Item ${id}`, sku: `SKU-${id}`, imageUrl: null },
      variant: null,
      unitPriceCents: 100,
      priceSource: 'PRICE_LIST' as const,
      discountType: null,
      discountValue: null,
      discountAmountCents: 0,
      discountTitle: null,
      promotionId: null,
      manuallyAdjusted: false,
      overrideNote: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    })

    const wrapper = mount(QuotationTotalsFooter, {
      props: {
        quotation: makeQuotation({
          items: [item('a', 2), item('b', 3)],
        }),
      },
    })

    expect(wrapper.find('[data-testid="items-count"]').text()).toMatch(/2\s*productos/i)
    expect(wrapper.find('[data-testid="items-count"]').text()).toMatch(/5\s*unidades/i)
  })
})

describe('QuotationTotalsFooter — totals', () => {
  it('renders the subtotal formatted as MXN currency', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ subtotalCents: 15000 }) },
    })

    expect(wrapper.find('[data-testid="subtotal-amount"]').text()).toBe('$150.00')
  })

  it('renders the discount formatted as MXN currency', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ discountCents: 1500 }) },
    })

    // The discount row prepends a minus sign in the template (mirrors
    // SaleTotalsFooter); the underlying formatCentsMXN value is `$15.00`.
    expect(wrapper.find('[data-testid="discount-amount"]').text()).toBe('-$15.00')
  })

  it('shows the discount with a leading minus sign', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ discountCents: 1500 }) },
    })

    const text = wrapper.find('[data-testid="discount-amount"]').text()
    expect(text.trim().startsWith('-')).toBe(true)
  })

  it('hides the discount row when there are no discounts', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ discountCents: 0 }) },
    })

    expect(wrapper.find('[data-testid="discount-row"]').exists()).toBe(false)
  })

  it('renders the total prominently with formatCentsMXN', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ totalCents: 13500 }) },
    })

    expect(wrapper.find('[data-testid="total-amount"]').text()).toBe('$135.00')
  })

  it('marks the total as visually prominent via the data-testid testid', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation() },
    })

    // The total element carries the `data-testid="total-amount"` — tests confirm
    // the label hierarchy reads "Total" before the formatted amount.
    const total = wrapper.find('[data-testid="total-amount"]')
    expect(total.exists()).toBe(true)
    // Ancestor of the total element must contain the word "TOTAL" or "Total".
    const html = wrapper.html()
    expect(/total/i.test(html)).toBe(true)
  })

  it('renders every monetary value through formatCentsMXN (es-MX locale)', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: {
        quotation: makeQuotation({
          subtotalCents: 123456,
          discountCents: 12345,
          totalCents: 111111,
        }),
      },
    })

    // es-MX formats thousands with comma and 2 decimals.
    expect(wrapper.find('[data-testid="subtotal-amount"]').text()).toBe('$1,234.56')
    expect(wrapper.find('[data-testid="discount-amount"]').text()).toMatch(/^\-\$123\.45$/)
    expect(wrapper.find('[data-testid="total-amount"]').text()).toBe('$1,111.11')
  })
})

// T-UI-22/23 — REQ-UI-009 RESUMEN sidebar refactor.
// The footer grows from a compact 4-line strip into the full Coco RESUMEN
// card: title, context subtitle, subtotal / descuentos / IVA 16% / TOTAL,
// full-width send CTA, save-draft secondary, validity notice.
//
// These tests pin the spec-level additions so future tweaks can't silently
// drop any of them.
describe('QuotationTotalsFooter — RESUMEN sidebar (T-UI-22/23 / REQ-UI-009)', () => {
  it('renders the "RESUMEN" title in the header', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation() },
    })
    expect(wrapper.find('[data-testid="summary-title"]').text()).toBe('RESUMEN')
  })

  it('renders the context subtitle (N productos · M unidades · lista [name])', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: {
        quotation: makeQuotation(),
        priceListName: 'Mayoreo',
      },
    })
    const context = wrapper.find('[data-testid="summary-context"]')
    expect(context.exists()).toBe(true)
    expect(context.text()).toContain('0 productos')
    expect(context.text()).toContain('0 unidades')
    expect(context.text()).toContain('lista Mayoreo')
  })

  it('omits the price-list segment when priceListName is not provided', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation() },
    })
    const context = wrapper.find('[data-testid="summary-context"]')
    expect(context.exists()).toBe(true)
    expect(context.text()).not.toContain('lista')
  })

  it('renders the IVA 16% row computed from totalCents × 0.16', () => {
    // totalCents = 33500 → IVA = 5360 ($53.60) per REQ-UI-009 scenario
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ totalCents: 33500 }) },
    })
    const iva = wrapper.find('[data-testid="summary-iva-row"]')
    expect(iva.exists()).toBe(true)
    expect(iva.text()).toContain('IVA 16%')
    expect(iva.text()).toContain('$53.60')
  })

  it('renders IVA 16% as 0 when totalCents is 0', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ totalCents: 0 }) },
    })
    const iva = wrapper.find('[data-testid="summary-iva-row"]')
    expect(iva.exists()).toBe(true)
    expect(iva.text()).toContain('$0.00')
  })

  it('renders the full-width "Enviar cotización" CTA when editable', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation(), editable: true },
    })
    const cta = wrapper.find('[data-testid="summary-send-btn"]')
    expect(cta.exists()).toBe(true)
    expect(cta.text()).toContain('Enviar cotización')
    // The CTA must be full-width (w-full on the button itself).
    expect(cta.classes()).toContain('w-full')
  })

  it('emits "send" when the CTA is clicked', async () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation(), editable: true },
    })
    await wrapper.get('[data-testid="summary-send-btn"]').trigger('click')
    expect(wrapper.emitted('send')).toBeDefined()
    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('renders the "Guardar borrador" outlined secondary button', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation(), editable: true },
    })
    const secondary = wrapper.find('[data-testid="summary-save-draft-btn"]')
    expect(secondary.exists()).toBe(true)
    expect(secondary.text()).toContain('Guardar borrador')
  })

  it('emits "save-draft" when the secondary button is clicked', async () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation(), editable: true },
    })
    await wrapper.get('[data-testid="summary-save-draft-btn"]').trigger('click')
    expect(wrapper.emitted('save-draft')).toBeDefined()
    expect(wrapper.emitted('save-draft')).toHaveLength(1)
  })

  it('hides both CTAs when editable=false (non-DRAFT quotation)', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation(), editable: false },
    })
    expect(wrapper.find('[data-testid="summary-send-btn"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="summary-save-draft-btn"]').exists()).toBe(false)
  })

  it('renders the validity notice when expiresAt is set', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: {
        quotation: makeQuotation({ expiresAt: '2026-09-15T00:00:00.000Z' }),
        editable: true,
      },
    })
    const validity = wrapper.find('[data-testid="summary-validity-notice"]')
    expect(validity.exists()).toBe(true)
    expect(validity.text()).toContain('Válida hasta')
  })

  it('omits the validity notice when expiresAt is null', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ expiresAt: null }), editable: true },
    })
    expect(wrapper.find('[data-testid="summary-validity-notice"]').exists()).toBe(false)
  })

  it('renders the discount row with blue (info) accent color', () => {
    const wrapper = mount(QuotationTotalsFooter, {
      props: { quotation: makeQuotation({ discountCents: 1500 }) },
    })
    const discountRow = wrapper.find('[data-testid="discount-row"]')
    // The discount text class is the Coco info-blue color.
    const discountAmount = wrapper.find('[data-testid="discount-amount"]')
    expect(discountAmount.classes().join(' ')).toMatch(/text-\[var\(--coco-info\)\]/)
  })
})
