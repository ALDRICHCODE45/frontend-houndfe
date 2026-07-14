import { describe, it, expect } from 'vitest'
import SaleDetailItemsList from '../SaleDetailItemsList.vue'
import SaleItemBadges from '../SaleItemBadges.vue'
import { mountWithUApp } from '@/test/mountWithUApp'

describe('SaleDetailItemsList', () => {
  it('renders one individual card per item', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: 'Talla M',
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 3,
            discountCents: 0,
            subtotalCents: 51000,
          },
          {
            productName: 'Camisa',
            variantName: 'XL',
            imageUrl: null,
            unitPriceCents: 25000,
            quantity: 1,
            discountCents: 0,
            subtotalCents: 25000,
          },
        ],
      },
    })

    const cards = wrapper.findAll('[data-testid^="item-card-"]')
    expect(cards).toHaveLength(2)
  })

  it('does NOT apply hover background or border-color transitions on item cards', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: 'Talla M',
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 3,
            discountCents: 0,
            subtotalCents: 51000,
          },
        ],
      },
    })

    const card = wrapper.get('[data-testid="item-card-0"]')
    const classes = card.classes()
    // The previous "hover:bg-elevated" produced an ugly grey block hover on a
    // non-interactive row. Item cards are not clickable, so they must NOT have
    // any hover state.
    expect(classes.some((c) => c.startsWith('hover:'))).toBe(false)
  })

  it('applies typographic hierarchy to name, subtitle, quantity, and subtotal', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: 'Talla M',
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 3,
            discountCents: 0,
            subtotalCents: 51000,
          },
        ],
      },
    })

    const name = wrapper.get('[data-testid="item-name-0"]')
    const subtitle = wrapper.get('[data-testid="item-subtitle-0"]')
    const quantity = wrapper.get('[data-testid="item-quantity-0"]')
    const subtotal = wrapper.get('[data-testid="item-subtotal-0"]')

    expect(name.classes()).toEqual(expect.arrayContaining(['text-base', 'font-semibold', 'text-highlighted']))
    expect(subtitle.classes()).toEqual(expect.arrayContaining(['text-sm', 'text-muted']))
    expect(quantity.classes()).toEqual(expect.arrayContaining(['text-sm', 'text-muted', 'tabular-nums']))
    expect(subtotal.classes()).toEqual(expect.arrayContaining(['text-right', 'font-semibold', 'tabular-nums']))
  })

  it('renders image when imageUrl is a non-empty string', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: 'Talla M',
            imageUrl: 'https://example.com/jean.jpg',
            unitPriceCents: 17000,
            quantity: 2,
            discountCents: 0,
            subtotalCents: 34000,
          },
        ],
      },
    })

    const avatar = wrapper.get('[data-testid="item-image-0"]')
    expect(avatar.attributes('src')).toBe('https://example.com/jean.jpg')
    expect(avatar.attributes('alt')).toBe('Jean Recto - Talla M')
    expect(wrapper.text()).toContain('Jean Recto')
  })

  it('renders fallback icon when imageUrl is null', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 2,
            discountCents: 0,
            subtotalCents: 34000,
          },
        ],
      },
    })

    const avatar = wrapper.get('[data-testid="item-image-0"]')
    // UAvatar with icon renders as an SVG element
    expect(avatar.element.tagName.toLowerCase()).toBe('svg')
    expect(avatar.attributes('data-slot')).toBe('icon')
    expect(avatar.attributes('src')).toBeUndefined()
    expect(wrapper.text()).toContain('Jean Recto')
  })

  it('renders fallback icon when imageUrl is empty string', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Camisa',
            variantName: 'XL',
            imageUrl: '',
            unitPriceCents: 25000,
            quantity: 1,
            discountCents: 0,
            subtotalCents: 25000,
          },
        ],
      },
    })

    const avatar = wrapper.get('[data-testid="item-image-0"]')
    expect(avatar.element.tagName.toLowerCase()).toBe('svg')
    expect(avatar.attributes('data-slot')).toBe('icon')
    expect(avatar.attributes('src')).toBeUndefined()
    expect(wrapper.text()).toContain('Camisa')
  })

  it('renders quantity as clean text with × prefix', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Jean Recto',
            variantName: 'Talla M',
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 3,
            discountCents: 0,
            subtotalCents: 51000,
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('× 3')
    expect(wrapper.text()).toContain('Jean Recto')
    expect(wrapper.text()).toContain('$170.00')
    expect(wrapper.text()).toContain('$510.00')
  })

  it('shows DESCUENTO badge and strikethrough pre-discount price when discountType is set', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Croqueta',
            variantName: 'Normal',
            imageUrl: null,
            unitPriceCents: 63000,
            quantity: 2,
            discountCents: 14000,
            subtotalCents: 126000,
            priceSource: 'default',
            discountType: 'percentage',
            discountValue: 10,
            discountAmountCents: 14000,
            prePriceCentsBeforeDiscount: 70000,
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('DESCUENTO -10%')
    // Strikethrough pre-discount unit price ($700.00) appears in subtitle.
    const preDiscount = wrapper.get('[data-testid="item-pre-discount-price-0"]')
    expect(preDiscount.classes()).toContain('line-through')
    expect(preDiscount.text()).toContain('$700.00')
    // Strikethrough pre-discount line total ($1,400.00) appears under subtotal.
    const lineOriginal = wrapper.get('[data-testid="item-line-original-0"]')
    expect(lineOriginal.classes()).toContain('line-through')
    expect(lineOriginal.text()).toContain('$1,400.00')
    // Final unit price shown unstruck.
    expect(wrapper.text()).toContain('$630.00')
  })

  it('shows PRECIO MANUAL badge and strikethrough catalog price when priceSource is custom', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Croqueta',
            variantName: 'Extra Grande',
            imageUrl: null,
            unitPriceCents: 90000,
            quantity: 2,
            discountCents: 0,
            subtotalCents: 180000,
            originalPriceCents: 80000,
            priceSource: 'custom',
          },
        ],
      },
    })

    expect(wrapper.text()).toContain('PRECIO MANUAL')
    const original = wrapper.get('[data-testid="item-original-price-0"]')
    expect(original.classes()).toContain('line-through')
    expect(original.text()).toContain('$800.00')
    expect(wrapper.text()).toContain('$900.00')
    // Custom override does NOT generate a line discount strikethrough.
    expect(wrapper.find('[data-testid="item-line-original-0"]').exists()).toBe(false)
  })

  it('renders no badges and no strikethroughs when item is plain', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Ibuprofeno 400mg',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 20000,
            quantity: 1,
            discountCents: 0,
            subtotalCents: 20000,
            priceSource: 'default',
          },
        ],
      },
    })

    expect(wrapper.text()).not.toContain('DESCUENTO')
    expect(wrapper.text()).not.toContain('PRECIO MANUAL')
    expect(wrapper.text()).not.toContain('PRECIO LISTA')
    expect(wrapper.find('[data-testid="item-original-price-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="item-pre-discount-price-0"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="item-line-original-0"]').exists()).toBe(false)
  })

  // ── B.3 — BXGY reward badge forwarded from item.rewardKind ────────────────

  it('surfaces the GRATIS reward badge on a line with rewardKind === "buy_x_get_y"', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
             discountCents: 0,
             subtotalCents: 0,
             rewardKind: 'buy_x_get_y',
             rewardDiscountPercent: 100,
           },

        ],
      },
    })

     const rewardBadge = wrapper.find('[data-testid="sale-item-reward-badge"]')
     expect(rewardBadge.exists()).toBe(true)
     expect(rewardBadge.text()).toContain('GRATIS')
     const badges = wrapper.findComponent(SaleItemBadges)
     expect(badges.props('rewardDiscountPercent')).toBe(100)
     // Backend-provided NET subtotal must render verbatim — client MUST NOT recompute.
     expect(wrapper.get('[data-testid="item-subtotal-0"]').text()).toContain('$0.00')
   })

   it('renders a partial reward percent on the confirmed detail surface', () => {
     const wrapper = mountWithUApp(SaleDetailItemsList, {
       props: {
         items: [
           {
             productName: 'Vitamina C',
             variantName: '1000mg',
             imageUrl: null,
             unitPriceCents: 12000,
             quantity: 1,
             discountCents: 0,
             subtotalCents: 6000,
             rewardKind: 'buy_x_get_y',
             rewardDiscountPercent: 50,
           },
         ],
       },
     })

     const rewardBadge = wrapper.find('[data-testid="sale-item-reward-badge"]')
     expect(rewardBadge.text()).toContain('-50%')
     expect(rewardBadge.text()).not.toContain('GRATIS')
     expect(wrapper.findComponent(SaleItemBadges).props('rewardDiscountPercent')).toBe(50)
   })

   it('does NOT render a reward badge when the confirmed detail percent is null', () => {
     const wrapper = mountWithUApp(SaleDetailItemsList, {
       props: {
         items: [
           {
             productName: 'Vitamina C',
             variantName: null,
             imageUrl: null,
             unitPriceCents: 12000,
             quantity: 1,
             discountCents: 0,
             subtotalCents: 12000,
             rewardKind: 'buy_x_get_y',
             rewardDiscountPercent: null,
           },
         ],
       },
     })

     expect(wrapper.find('[data-testid="sale-item-reward-badge"]').exists()).toBe(false)
     expect(wrapper.findComponent(SaleItemBadges).props('rewardDiscountPercent')).toBeNull()
   })


  it('does NOT render a reward badge on a line without rewardKind', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Vitamina C',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 12000,
            quantity: 1,
            discountCents: 0,
            subtotalCents: 12000,
            priceSource: 'default',
          },
        ],
      },
    })

    expect(wrapper.find('[data-testid="sale-item-reward-badge"]').exists()).toBe(false)
  })

  it('forwards rewardKind only on the reward line, not on sibling lines', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Vitamina C',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 12000,
            quantity: 2,
            discountCents: 0,
             subtotalCents: 0,
             rewardKind: 'buy_x_get_y',
             rewardDiscountPercent: 100,
           },

          {
            productName: 'Paracetamol',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 8000,
            quantity: 1,
            discountCents: 0,
            subtotalCents: 8000,
            priceSource: 'default',
          },
        ],
      },
    })

    expect(wrapper.findAll('[data-testid="sale-item-reward-badge"]')).toHaveLength(1)
  })

  // ── bxgy-promotion-followups REQ-8 — promotionId forwarded to badges ─────

  it('forwards promotionId to SaleItemBadges + renders the promo-name chip with non-empty discountTitle (no remove button on confirmed-sale surface)', () => {
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Camisa',
            variantName: 'XL',
            imageUrl: null,
            unitPriceCents: 20000,
            quantity: 1,
            discountCents: 5000,
            subtotalCents: 15000,
            discountTitle: 'Black Friday 2x1',
            promotionId: 'promo-abc',
          },
        ],
      },
    })

    // Parent MUST forward the line promotionId to the badge child.
    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.exists()).toBe(true)
    expect(badges.props('promotionId')).toBe('promo-abc')
    expect(badges.props('discountTitle')).toBe('Black Friday 2x1')

    // Chip with the promo title renders — badge group + chip testid present.
    expect(wrapper.find('[data-testid="sale-item-badge-group"]').exists()).toBe(true)
    const chip = wrapper.find('[data-testid="sale-item-promo-badge"]')
    expect(chip.exists()).toBe(true)
    expect(chip.text()).toContain('Black Friday 2x1')

    // Critical: confirmed-sale surface MUST NOT render the remove button.
    // Only the draft context (SaleItemRow) sets `removable=true`.
    expect(wrapper.find('[data-testid="sale-item-remove-promo"]').exists()).toBe(false)
  })

  it('forwards promotionId to SaleItemBadges when discountTitle is empty, with no remove button on the confirmed-sale surface', () => {
    // Note: with an empty discountTitle, SaleItemBadges renders a fallback
    // "Promoción" chip (its `v-if="hasPromotion"` gate is independent of
    // `discountTitle`). That rendering decision lives in the locked child.
    // At the SaleDetailItemsList boundary we MUST still forward promotionId
    // (the parent MUST NOT silently swallow it based on title presence),
    // and the confirmed-sale surface MUST NOT render a remove control.
    const wrapper = mountWithUApp(SaleDetailItemsList, {
      props: {
        items: [
          {
            productName: 'Camisa',
            variantName: 'XL',
            imageUrl: null,
            unitPriceCents: 20000,
            quantity: 1,
            discountCents: 5000,
            subtotalCents: 15000,
            discountTitle: '',
            promotionId: 'promo-abc',
          },
        ],
      },
    })

    // Forwarding always happens (no parent-side gate on discountTitle).
    const badges = wrapper.findComponent(SaleItemBadges)
    expect(badges.exists()).toBe(true)
    expect(badges.props('promotionId')).toBe('promo-abc')

    // Critical: confirmed-sale surface MUST NOT render the remove button.
    expect(wrapper.find('[data-testid="sale-item-remove-promo"]').exists()).toBe(false)
  })
})
