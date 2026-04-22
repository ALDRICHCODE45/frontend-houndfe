import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSearchResultItem from '../ProductSearchResultItem.vue'
import type { SearchableProduct } from '../../interfaces/sale.types'

describe('ProductSearchResultItem.vue', () => {
  const simpleProduct: SearchableProduct = {
    id: 'prod-1',
    name: 'Paracetamol 500mg',
    imageUrl: null,
    priceCents: 4998,
    stock: 120,
    sellInPos: true,
    hasVariants: false,
    variantCount: 0,
  }

  const variantProduct: SearchableProduct = {
    id: 'prod-2',
    name: 'Ibuprofeno',
    imageUrl: 'https://example.com/img.jpg',
    priceCents: 8500,
    stock: 350,
    sellInPos: true,
    hasVariants: true,
    variantCount: 3,
  }

  it('renders product name', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    expect(wrapper.text()).toContain('Paracetamol 500mg')
  })

  it('renders formatted price', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    expect(wrapper.text()).toContain('$49.98')
  })

  it('shows placeholder icon when image is null', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    const icon = wrapper.find('[data-testid="placeholder-icon"]')
    expect(icon.exists()).toBe(true)
  })

  it('shows stock badge for simple product', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    expect(wrapper.text()).toContain('120 unidades')
  })

  it('shows variant stock badge for variant product', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: variantProduct },
    })

    expect(wrapper.text()).toContain('350 unidades en 3 variantes')
  })

  it('emits select event when clicked', async () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    await wrapper.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([simpleProduct])
  })

  it('has hover cursor pointer class', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    expect(wrapper.classes()).toContain('cursor-pointer')
  })

  it('has transition classes for hover effect', () => {
    const wrapper = mount(ProductSearchResultItem, {
      props: { product: simpleProduct },
    })

    expect(wrapper.classes()).toContain('transition-colors')
    expect(wrapper.classes()).toContain('duration-150')
  })
})
