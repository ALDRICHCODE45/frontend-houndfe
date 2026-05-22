import { describe, it, expect } from 'vitest'
import SaleDetailItemsTable from '../SaleDetailItemsTable.vue'
import { mountWithUApp } from '@/test/mountWithUApp'

describe('SaleDetailItemsTable', () => {
  it('applies typographic hierarchy to name, subtitle, quantity, and subtotal', () => {
    const wrapper = mountWithUApp(SaleDetailItemsTable, {
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
    const wrapper = mountWithUApp(SaleDetailItemsTable, {
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
    const wrapper = mountWithUApp(SaleDetailItemsTable, {
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
    const wrapper = mountWithUApp(SaleDetailItemsTable, {
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
    // UAvatar with icon renders as an SVG element
    expect(avatar.element.tagName.toLowerCase()).toBe('svg')
    expect(avatar.attributes('data-slot')).toBe('icon')
    expect(avatar.attributes('src')).toBeUndefined()
    expect(wrapper.text()).toContain('Camisa')
  })

  it('renders quantity as clean text with × prefix', () => {
    const wrapper = mountWithUApp(SaleDetailItemsTable, {
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
})
