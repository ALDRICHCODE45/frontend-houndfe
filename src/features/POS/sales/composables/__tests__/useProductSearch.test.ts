import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useProductSearch } from '../useProductSearch'
import { saleApi } from '../../api/sale.api'
import type { PosCatalogResponse } from '../../interfaces/sale.types'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    searchPosCatalog: vi.fn(),
  },
}))

// Helper component to test composable in a component context
function mountComposable<T>(composable: () => T) {
  let result: T | undefined

  const TestComponent = defineComponent({
    setup() {
      result = composable()
      return () => h('div')
    },
  })

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  })

  const wrapper = mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { result: result!, wrapper, queryClient }
}

describe('useProductSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('empty query loads first page', () => {
    it('should fetch first page when query is empty on mount', async () => {
      const mockResponse: PosCatalogResponse = {
        items: [
          {
            id: 'prod-1',
            name: 'Aspirina 500mg',
            sku: 'ASP-500',
            barcode: null,
            unit: 'UNIDAD',
            hasVariants: false,
            useStock: true,
            category: null,
            brand: null,
            mainImage: null,
            images: [],
            price: {
              priceCents: 4998,
              priceDecimal: 49.98,
              priceListName: 'PUBLICO',
            },
            stock: {
              quantity: 120,
              minQuantity: 10,
            },
            variants: [],
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      }

      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue(mockResponse)

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(saleApi.searchPosCatalog).toHaveBeenCalledWith({
          q: '',
          limit: 25,
          offset: 0,
        })
      })

      await vi.waitFor(() => {
        expect(result.items.value).toHaveLength(1)
        expect(result.items.value[0]?.name).toBe('Aspirina 500mg')
      })
    })

    it('should fetch first page with limit 25 and offset 0 by default', async () => {
      const mockResponse: PosCatalogResponse = {
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      }

      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue(mockResponse)

      mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(saleApi.searchPosCatalog).toHaveBeenCalledWith({
          q: '',
          limit: 25,
          offset: 0,
        })
      })
    })
  })

  describe('debounced search', () => {
    it('should debounce query input for 250ms', async () => {
      const mockResponse: PosCatalogResponse = {
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      }

      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue(mockResponse)

      const { result } = mountComposable(() => useProductSearch())

      // Clear the initial call from empty query
      vi.clearAllMocks()

      result.query.value = 'asp'
      await nextTick()
      
      // Should NOT fire immediately
      expect(saleApi.searchPosCatalog).not.toHaveBeenCalled()

      // Wait for debounce (250ms)
      await vi.waitFor(
        () => {
          expect(saleApi.searchPosCatalog).toHaveBeenCalledWith({
            q: 'asp',
            limit: 25,
            offset: 0,
          })
        },
        { timeout: 300 }
      )
    })

    it('should fire only one request after multiple rapid changes', async () => {
      const mockResponse: PosCatalogResponse = {
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      }

      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue(mockResponse)

      const { result } = mountComposable(() => useProductSearch())

      vi.clearAllMocks()

      // Rapid typing simulation
      result.query.value = 'a'
      await nextTick()
      result.query.value = 'as'
      await nextTick()
      result.query.value = 'asp'
      await nextTick()

      // Wait for debounce
      await vi.waitFor(
        () => {
          expect(saleApi.searchPosCatalog).toHaveBeenCalledTimes(1)
          expect(saleApi.searchPosCatalog).toHaveBeenCalledWith({
            q: 'asp',
            limit: 25,
            offset: 0,
          })
        },
        { timeout: 300 }
      )
    })
  })

  describe('loading and error states', () => {
    it('should set isLoading=true while request is in flight', async () => {
      let resolveSearch: (value: PosCatalogResponse) => void = () => {}
      const searchPromise = new Promise<PosCatalogResponse>((resolve) => {
        resolveSearch = resolve
      })

      vi.mocked(saleApi.searchPosCatalog).mockReturnValue(searchPromise)

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(result.isLoading.value).toBe(true)
      })

      // Resolve the promise
      resolveSearch({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      })

      await vi.waitFor(() => {
        expect(result.isLoading.value).toBe(false)
      })
    })

    it('should set isError=true when request fails', async () => {
      vi.mocked(saleApi.searchPosCatalog).mockRejectedValue(new Error('Network error'))

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(result.isError.value).toBe(true)
      })
    })

    it('should clear isError on successful retry', async () => {
      vi.mocked(saleApi.searchPosCatalog).mockRejectedValueOnce(new Error('Network error'))

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(result.isError.value).toBe(true)
      })

      // Mock successful response for retry
      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      })

      result.query.value = 'retry'

      await vi.waitFor(
        () => {
          expect(result.isError.value).toBe(false)
        },
        { timeout: 300 }
      )
    })
  })

  describe('search results', () => {
    it('should return PosCatalogItem array from API response', async () => {
      const mockResponse: PosCatalogResponse = {
        items: [
          {
            id: 'prod-1',
            name: 'Aspirina 500mg',
            sku: 'ASP-500',
            barcode: '7501234567890',
            unit: 'UNIDAD',
            hasVariants: false,
            useStock: true,
            category: { id: 'cat-1', name: 'Medicamentos' },
            brand: { id: 'brand-1', name: 'Bayer' },
            mainImage: 'https://cdn.example.com/asp-main.jpg',
            images: ['https://cdn.example.com/asp-main.jpg'],
            price: {
              priceCents: 4998,
              priceDecimal: 49.98,
              priceListName: 'PUBLICO',
            },
            stock: {
              quantity: 120,
              minQuantity: 10,
            },
            variants: [],
          },
          {
            id: 'prod-2',
            name: 'Paracetamol 500mg',
            sku: 'PAR-500',
            barcode: null,
            unit: 'UNIDAD',
            hasVariants: true,
            useStock: true,
            category: { id: 'cat-1', name: 'Medicamentos' },
            brand: null,
            mainImage: null,
            images: [],
            price: null,
            stock: null,
            variants: [
              {
                id: 'var-1',
                name: 'Caja 10',
                sku: 'PAR-500-10',
                barcode: null,
                mainImage: null,
                price: {
                  priceCents: 8000,
                  priceDecimal: 80,
                  priceListName: 'PUBLICO',
                },
                stock: {
                  quantity: 50,
                  minQuantity: 5,
                },
              },
            ],
          },
        ],
        total: 2,
        limit: 25,
        offset: 0,
      }

      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue(mockResponse)

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(result.items.value).toHaveLength(2)
        expect(result.items.value[0]?.name).toBe('Aspirina 500mg')
        expect(result.items.value[1]?.hasVariants).toBe(true)
        expect(result.items.value[1]?.variants).toHaveLength(1)
      })
    })

    it('should return total count from API response', async () => {
      const mockResponse: PosCatalogResponse = {
        items: [],
        total: 42,
        limit: 25,
        offset: 0,
      }

      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue(mockResponse)

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(result.total.value).toBe(42)
      })
    })
  })

  describe('isEmpty computed', () => {
    it('should be true when query is not empty and results are empty', async () => {
      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      })

      const { result } = mountComposable(() => useProductSearch())

      result.query.value = 'nonexistent'

      await vi.waitFor(
        () => {
          expect(result.isEmpty.value).toBe(true)
        },
        { timeout: 300 }
      )
    })

    it('should be false when loading', async () => {
      let resolveSearch: (value: PosCatalogResponse) => void = () => {}
      const searchPromise = new Promise<PosCatalogResponse>((resolve) => {
        resolveSearch = resolve
      })

      vi.mocked(saleApi.searchPosCatalog).mockReturnValue(searchPromise)

      const { result } = mountComposable(() => useProductSearch())

      result.query.value = 'test'

      await nextTick()

      // While loading, isEmpty should be false (don't show "no results" yet)
      expect(result.isEmpty.value).toBe(false)

      resolveSearch({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      })
    })

    it('should be false when query is empty even if results are empty', async () => {
      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue({
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      })

      const { result } = mountComposable(() => useProductSearch())

      await vi.waitFor(() => {
        expect(result.isEmpty.value).toBe(false)
      })
    })

    it('should be false when results are present', async () => {
      vi.mocked(saleApi.searchPosCatalog).mockResolvedValue({
        items: [
          {
            id: 'prod-1',
            name: 'Test',
            sku: null,
            barcode: null,
            unit: null,
            hasVariants: false,
            useStock: false,
            category: null,
            brand: null,
            mainImage: null,
            images: [],
            price: null,
            stock: null,
            variants: [],
          },
        ],
        total: 1,
        limit: 25,
        offset: 0,
      })

      const { result } = mountComposable(() => useProductSearch())

      result.query.value = 'test'

      await vi.waitFor(
        () => {
          expect(result.isEmpty.value).toBe(false)
        },
        { timeout: 300 }
      )
    })
  })
})
