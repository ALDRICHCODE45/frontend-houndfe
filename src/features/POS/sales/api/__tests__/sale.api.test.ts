import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saleApi } from '../sale.api'
import { http } from '@/core/shared/api/http'
import type {
  Sale,
  AddItemPayload,
  UpdateQtyPayload,
  PosCatalogResponse,
  PosCatalogSearchParams,
} from '../../interfaces/sale.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('saleApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDraft', () => {
    it('should POST to /sales/drafts and return Sale', async () => {
      const mockSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockSale })

      const result = await saleApi.createDraft()

      expect(http.post).toHaveBeenCalledWith('/sales/drafts')
      expect(result).toEqual(mockSale)
    })

    it('should handle draft creation with different user', async () => {
      const mockSale: Sale = {
        id: 'sale-2',
        userId: 'user-2',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T11:00:00Z',
        updatedAt: '2026-04-21T11:00:00Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockSale })

      const result = await saleApi.createDraft()

      expect(result.userId).toBe('user-2')
      expect(result.id).toBe('sale-2')
    })
  })

  describe('listDrafts', () => {
    it('should GET /sales/drafts and return array of Sales', async () => {
      const mockDrafts: Sale[] = [
        {
          id: 'sale-1',
          userId: 'user-1',
          status: 'DRAFT',
          items: [],
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
        {
          id: 'sale-2',
          userId: 'user-1',
          status: 'DRAFT',
          items: [
            {
              id: 'item-1',
              productId: 'prod-1',
              variantId: null,
              productName: 'Product A',
              variantName: null,
              quantity: 2,
              unitPriceCents: 1000,
              unitPriceCurrency: 'MXN',
            },
          ],
          createdAt: '2026-04-21T09:00:00Z',
          updatedAt: '2026-04-21T10:05:00Z',
        },
      ]

      vi.mocked(http.get).mockResolvedValue({ data: mockDrafts })

      const result = await saleApi.listDrafts()

      expect(http.get).toHaveBeenCalledWith('/sales/drafts')
      expect(result).toEqual(mockDrafts)
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no drafts exist', async () => {
      vi.mocked(http.get).mockResolvedValue({ data: [] })

      const result = await saleApi.listDrafts()

      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('addItem', () => {
    it('should POST item to draft and return updated Sale', async () => {
      const payload: AddItemPayload = {
        productId: 'prod-1',
        quantity: 1,
      }

      const mockUpdatedSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Product A',
            variantName: null,
            quantity: 1,
            unitPriceCents: 5000,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:05:00Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockUpdatedSale })

      const result = await saleApi.addItem('sale-1', payload)

      expect(http.post).toHaveBeenCalledWith('/sales/drafts/sale-1/items', payload)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]?.productId).toBe('prod-1')
    })

    it('should handle adding variant product with variantId', async () => {
      const payload: AddItemPayload = {
        productId: 'prod-2',
        variantId: 'var-1',
        quantity: 3,
      }

      const mockUpdatedSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [
          {
            id: 'item-2',
            productId: 'prod-2',
            variantId: 'var-1',
            productName: 'Product B',
            variantName: 'Variant X',
            quantity: 3,
            unitPriceCents: 8000,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:06:00Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: mockUpdatedSale })

      const result = await saleApi.addItem('sale-1', payload)

      expect(http.post).toHaveBeenCalledWith('/sales/drafts/sale-1/items', payload)
      expect(result.items[0]?.variantId).toBe('var-1')
      expect(result.items[0]?.quantity).toBe(3)
    })
  })

  describe('updateItemQty', () => {
    it('should PATCH item quantity and return updated Sale', async () => {
      const payload: UpdateQtyPayload = { quantity: 5 }

      const mockUpdatedSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Product A',
            variantName: null,
            quantity: 5,
            unitPriceCents: 5000,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:10:00Z',
      }

      vi.mocked(http.patch).mockResolvedValue({ data: mockUpdatedSale })

      const result = await saleApi.updateItemQty('sale-1', 'item-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1', payload)
      expect(result.items[0]?.quantity).toBe(5)
    })

    it('should handle quantity update to minimum value 1', async () => {
      const payload: UpdateQtyPayload = { quantity: 1 }

      const mockUpdatedSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Product A',
            variantName: null,
            quantity: 1,
            unitPriceCents: 5000,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:11:00Z',
      }

      vi.mocked(http.patch).mockResolvedValue({ data: mockUpdatedSale })

      const result = await saleApi.updateItemQty('sale-1', 'item-1', payload)

      expect(result.items[0]?.quantity).toBe(1)
    })
  })

  describe('clearItems', () => {
    it('should DELETE all items and return Sale with empty items array', async () => {
      const mockClearedSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:15:00Z',
      }

      vi.mocked(http.delete).mockResolvedValue({ data: mockClearedSale })

      const result = await saleApi.clearItems('sale-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-1/items')
      expect(result.items).toEqual([])
    })

    it('should handle clearing already-empty sale', async () => {
      const mockClearedSale: Sale = {
        id: 'sale-2',
        userId: 'user-2',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T11:00:00Z',
        updatedAt: '2026-04-21T11:05:00Z',
      }

      vi.mocked(http.delete).mockResolvedValue({ data: mockClearedSale })

      const result = await saleApi.clearItems('sale-2')

      expect(result.items).toHaveLength(0)
    })
  })

  describe('closeDraft', () => {
    it('should DELETE draft and return void', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await saleApi.closeDraft('sale-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-1')
    })

    it('should handle closing different draft by id', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await saleApi.closeDraft('sale-999')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-999')
    })
  })

  describe('searchPosCatalog', () => {
    it('should GET /sales/pos-catalog with query params and return PosCatalogResponse', async () => {
      const params: PosCatalogSearchParams = {
        q: 'aspirina',
        limit: 25,
        offset: 0,
      }

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
        ],
        total: 1,
        limit: 25,
        offset: 0,
      }

      vi.mocked(http.get).mockResolvedValue({ data: mockResponse })

      const result = await saleApi.searchPosCatalog(params)

      expect(http.get).toHaveBeenCalledWith('/sales/pos-catalog', { params })
      expect(result).toEqual(mockResponse)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]?.name).toBe('Aspirina 500mg')
    })

    it('should send only provided params and omit undefined fields', async () => {
      const params: PosCatalogSearchParams = {
        limit: 25,
        offset: 0,
      }

      const mockResponse: PosCatalogResponse = {
        items: [],
        total: 0,
        limit: 25,
        offset: 0,
      }

      vi.mocked(http.get).mockResolvedValue({ data: mockResponse })

      const result = await saleApi.searchPosCatalog(params)

      expect(http.get).toHaveBeenCalledWith('/sales/pos-catalog', { params })
      expect(result.items).toHaveLength(0)
    })
  })
})
