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

  it('shows empty state when no query and no items (empty catalog)', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: [],
        isLoading: false,
        isEmpty: true,
        hasQuery: false,
      },
    })

    expect(wrapper.text()).toContain('Sin resultados')
    expect(wrapper.text()).toContain('No hay productos disponibles en el catálogo POS')
  })

  it('shows loading skeletons when loading with no items', () => {
    const wrapper = mount(ProductSearchResults, {
      props: {
        items: [],
        isLoading: true,
        isEmpty: false,
        hasQuery: true,
      },
    })

    // Check for loading state presence (skeleton grid container)
    const loadingContainer = wrapper.find('[class*="grid"]')
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

  describe('14a.2 — fixed 3-column grid (R3)', () => {
    it('14a.2 — results grid uses sm:grid-cols-3 xl:grid-cols-3 (no md/4, no xl/4, no xl/5)', () => {
      // R3 — grid MUST be 3 fixed columns at sm and xl breakpoints.
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

      const html = wrapper.html()
      // New 3-col at sm and xl.
      expect(html).toContain('sm:grid-cols-3')
      expect(html).toContain('xl:grid-cols-3')
      // Old responsive breakpoints must not remain.
      expect(html).not.toContain('md:grid-cols-4')
      expect(html).not.toContain('xl:grid-cols-5')
      expect(html).not.toContain('xl:grid-cols-4')
    })

    it('14a.2 — loading skeleton grid also uses sm:grid-cols-3', () => {
      // Same R3 contract applies during loading so the perceived
      // layout doesn't shift between empty-loading and populated states.
      const wrapper = mount(ProductSearchResults, {
        props: {
          items: [],
          isLoading: true,
          isEmpty: false,
          hasQuery: false,
        },
      })

      const html = wrapper.html()
      expect(html).toContain('sm:grid-cols-3')
      expect(html).not.toContain('xl:grid-cols-5')
    })
  })
})
