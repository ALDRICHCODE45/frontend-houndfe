import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSearchResults from '../ProductSearchResults.vue'
import ProductSearchResultItem from '../ProductSearchResultItem.vue'
import type { PosCatalogItem } from '../../interfaces/sale.types'

// Stub child components
vi.mock('../ProductSearchResultItem.vue', () => ({
  default: {
    name: 'ProductSearchResultItem',
    template: '<div data-testid="result-item" @click="$emit(\'select\', item)">{{ item.name }}</div>',
    props: ['item'],
    emits: ['select'],
  },
}))

describe('ProductSearchResults.vue', () => {
  const mockResults: PosCatalogItem[] = [
    {
      id: 'prod-1',
      name: 'Product 1',
      sku: null,
      barcode: null,
      unit: null,
      hasVariants: false,
      useStock: true,
      category: null,
      brand: null,
      mainImage: null,
      images: [],
      price: {
        priceCents: 1000,
        priceDecimal: 10.0,
        priceListName: 'PUBLICO',
      },
      stock: {
        quantity: 10,
        minQuantity: 5,
      },
      variants: [],
    },
    {
      id: 'prod-2',
      name: 'Product 2',
      sku: null,
      barcode: null,
      unit: null,
      hasVariants: true,
      useStock: true,
      category: null,
      brand: null,
      mainImage: null,
      images: [],
      price: {
        priceCents: 2000,
        priceDecimal: 20.0,
        priceListName: 'PUBLICO',
      },
      stock: {
        quantity: 20,
        minQuantity: 5,
      },
      variants: [],
    },
  ]

  it('shows idle state when no query entered', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: [],
        isLoading: false,
        isEmpty: false,
        hasQuery: false,
      },
    })

    expect(wrapper.text()).toContain('Empezá a buscar')
  })

  it('shows loading skeletons when loading', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: [],
        isLoading: true,
        isEmpty: false,
        hasQuery: true,
      },
    })

    // Check for loading state presence
    const loadingContainer = wrapper.find('[class*="space-y-3"]')
    expect(loadingContainer.exists()).toBe(true)
  })

  it('shows empty state when query entered but no results', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: [],
        isLoading: false,
        isEmpty: true,
        hasQuery: true,
      },
    })

    expect(wrapper.text()).toContain('Sin resultados')
  })

  it('renders result items when results exist', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: mockResults,
        isLoading: false,
        isEmpty: false,
        hasQuery: true,
      },
      global: {
        components: {
          ProductSearchResultItem,
        },
      },
    })

    const items = wrapper.findAll('[data-testid="result-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('Product 1')
    expect(items[1]?.text()).toContain('Product 2')
  })

  it('emits select event when result item is clicked', async () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: mockResults,
        isLoading: false,
        isEmpty: false,
        hasQuery: true,
      },
      global: {
        components: {
          ProductSearchResultItem,
        },
      },
    })

    const items = wrapper.findAll('[data-testid="result-item"]')
    await items[0]?.trigger('click')

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')?.[0]).toEqual([mockResults[0]])
  })

  it('is scrollable when results are long', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: mockResults,
        isLoading: false,
        isEmpty: false,
        hasQuery: true,
      },
      global: {
        components: {
          ProductSearchResultItem,
        },
      },
    })

    expect(wrapper.classes()).toContain('overflow-y-auto')
  })
})
