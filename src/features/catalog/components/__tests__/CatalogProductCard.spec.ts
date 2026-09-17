import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import CatalogProductCard from '@/features/catalog/components/CatalogProductCard.vue'

const product = {
  id: 'product-1',
  name: 'Café molido de altura',
  slug: null,
  description: null,
  category: { id: 'coffee', name: 'Café' },
  brand: { name: 'Tostadores' },
  image: { url: 'https://example.test/cafe.jpg' },
  price: { fromPriceCents: 2599, priceCents: 2599, hidden: false },
  availability: 'available' as const,
  stockPresentation: {
    mode: 'SYSTEM_STATUS' as const,
    status: 'available' as const,
    customQuantity: null,
  },
  hasVariants: false,
  rating: null,
  featuredLabel: null,
}

const stubs = { UIcon: defineComponent({ setup: () => () => h('span') }) }

const mountCard = (overrides = {}) =>
  mount(CatalogProductCard, {
    props: { product: { ...product, ...overrides } },
    global: { stubs },
  })

describe('CatalogProductCard', () => {
  it('renders a real product image, meaningful alt text, MXN cents, and authoritative system status', () => {
    const wrapper = mountCard()

    expect(wrapper.get('img').attributes()).toMatchObject({
      src: product.image.url,
      alt: `Imagen de ${product.name}`,
    })
    expect(wrapper.text()).toContain(formatCentsMXN(2599))
    expect(wrapper.text()).toContain('Disponible')
    expect(wrapper.text()).toContain('Tostadores')
    expect(wrapper.text()).toContain('Café')
  })

  it('uses one accessible native card control and emits the exact product ID for pointer and keyboard click activation', async () => {
    const wrapper = mountCard()
    const control = wrapper.get(`button[aria-label="Ver detalles de ${product.name}"]`)

    expect(control.attributes('type')).toBe('button')
    expect(control.attributes('data-catalog-product-id')).toBe(product.id)

    await control.trigger('click')
    expect(wrapper.emitted('open-detail')).toEqual([[product.id, control.element]])

    await control.trigger('click')
    expect(wrapper.emitted('open-detail')).toEqual([
      [product.id, control.element],
      [product.id, control.element],
    ])
  })

  it('uses a neutral fallback and consult-price copy for an absent image and hidden/null price', () => {
    const wrapper = mountCard({
      image: null,
      price: { fromPriceCents: null, priceCents: null, hidden: true },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(
      wrapper.get('[data-testid="catalog-product-image-fallback"]').attributes('aria-label'),
    ).toBe(`Imagen no disponible para ${product.name}`)
    expect(wrapper.text()).toContain('Consultar precio')
    expect(wrapper.text()).not.toContain('$0')
  })

  it('keeps valid nullable availability with HIDDEN presentation neutral', () => {
    const wrapper = mountCard({
      availability: null,
      stockPresentation: { mode: 'HIDDEN', status: null, customQuantity: null },
    })

    expect(wrapper.text()).not.toMatch(/Disponible|Pocas piezas|Agotado|unidades/)
  })

  it('renders CUSTOM_QUANTITY zero without discarding it or calling it out of stock', () => {
    const wrapper = mountCard({
      availability: null,
      stockPresentation: { mode: 'CUSTOM_QUANTITY', status: null, customQuantity: 0 },
    })

    expect(wrapper.text()).toContain('0 unidades')
    expect(wrapper.text()).not.toMatch(/Disponible|Pocas piezas|Agotado/)
  })

  it('renders an aggregate CUSTOM_QUANTITY variant status when its quantity is null', () => {
    const wrapper = mountCard({
      availability: 'low_stock',
      stockPresentation: {
        mode: 'CUSTOM_QUANTITY',
        status: 'low_stock',
        customQuantity: null,
      },
    })

    expect(wrapper.text()).toContain('Pocas piezas')
    expect(wrapper.text()).not.toContain('unidades')
  })
})
