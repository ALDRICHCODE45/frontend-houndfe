import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saleApi } from '../sale.api'
import { http } from '@/core/shared/api/http'
import type {
  Sale,
  AddItemPayload,
  AssignCustomerPayload,
  AssignShippingAddressPayload,
  UpdateQtyPayload,
  AvailablePricesResponse,
  OverrideItemPricePayload,
  ApplyItemDiscountPayload,
  PosCatalogResponse,
  PosCatalogSearchParams,
  ChargeSalePayload,
  ChargeSaleResponse,
  ListSalesParams,
  ConfirmedSalesListResponse,
  SaleDetail,
  DebtPaymentPayload,
  DebtPaymentResponse,
} from '../../interfaces/sale.types'

vi.mock('@/core/shared/api/http', () => ({
  http: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
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

  describe('draft customer assignment endpoints', () => {
    it('assignCustomer should PUT /sales/drafts/:id/customer with payload and return Sale', async () => {
      const payload: AssignCustomerPayload = {
        customerId: 'customer-1',
        shippingAddressId: 'address-1',
      }
      const updatedSale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
        shippingAddress: null,
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      } satisfies Sale

      vi.mocked(http.put).mockResolvedValue({ data: updatedSale })

      const result = await saleApi.assignCustomer('sale-1', payload)

      expect(http.put).toHaveBeenCalledWith('/sales/drafts/sale-1/customer', payload)
      expect(result).toEqual(updatedSale)
    })

    it('unassignCustomer should DELETE /sales/drafts/:id/customer', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await saleApi.unassignCustomer('sale-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-1/customer')
    })

    it('assignShippingAddress should PUT /sales/drafts/:id/shipping-address with payload and return Sale', async () => {
      const payload: AssignShippingAddressPayload = {
        shippingAddressId: 'address-1',
      }
      const updatedSale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        customer: { id: 'customer-1', firstName: 'Ada', lastName: 'Lovelace' },
        shippingAddress: {
          id: 'address-1',
          customerId: 'customer-1',
          street: 'Main',
          exteriorNumber: '1',
          interiorNumber: null,
          zipCode: '64000',
          neighborhood: 'Centro',
          municipality: 'Monterrey',
          city: 'Monterrey',
          state: 'Nuevo León',
          createdAt: '2026-04-21T10:00:00Z',
          updatedAt: '2026-04-21T10:00:00Z',
        },
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      } satisfies Sale

      vi.mocked(http.put).mockResolvedValue({ data: updatedSale })

      const result = await saleApi.assignShippingAddress('sale-1', payload)

      expect(http.put).toHaveBeenCalledWith('/sales/drafts/sale-1/shipping-address', payload)
      expect(result).toEqual(updatedSale)
    })

    it('unassignShippingAddress should DELETE /sales/drafts/:id/shipping-address', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await saleApi.unassignShippingAddress('sale-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-1/shipping-address')
    })
  })

  describe('seller assignment endpoints', () => {
    it('assignSeller should PUT /sales/:id/seller with payload and return SaleDetail', async () => {
      const mockResponse: Partial<SaleDetail> = {
        id: 'sale-1',
        seller: { id: 'user-5', name: 'César Flores' },
      }
      vi.mocked(http.put).mockResolvedValue({ data: mockResponse })

      const result = await saleApi.assignSeller('sale-1', { sellerUserId: 'user-5' })

      expect(http.put).toHaveBeenCalledWith('/sales/sale-1/seller', { sellerUserId: 'user-5' })
      expect(result).toEqual(mockResponse)
    })

    it('unassignSeller should DELETE /sales/:id/seller', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await saleApi.unassignSeller('sale-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/sale-1/seller')
    })
  })

  describe('due date edit endpoint', () => {
    it('setDueDate should PATCH /sales/:id/due-date with payload and return SaleDetail', async () => {
      const mockResponse: Partial<SaleDetail> = {
        id: 'sale-1',
        dueDate: '2026-06-15T00:00:00.000Z',
      }
      vi.mocked(http.patch).mockResolvedValue({ data: mockResponse })

      const result = await saleApi.setDueDate('sale-1', { dueDate: '2026-06-15' })

      expect(http.patch).toHaveBeenCalledWith('/sales/sale-1/due-date', { dueDate: '2026-06-15' })
      expect(result).toEqual(mockResponse)
    })

    it('setDueDate should accept null to clear the due date', async () => {
      const mockResponse: Partial<SaleDetail> = { id: 'sale-1', dueDate: null }
      vi.mocked(http.patch).mockResolvedValue({ data: mockResponse })

      await saleApi.setDueDate('sale-1', { dueDate: null })

      expect(http.patch).toHaveBeenCalledWith('/sales/sale-1/due-date', { dueDate: null })
    })
  })

  describe('chargeDraft', () => {
    it('posts charge payload to draft charge endpoint with idempotency header', async () => {
      const payload: ChargeSalePayload = {
        method: 'cash',
        amountCents: 20000,
      }
      const response: ChargeSaleResponse = {
        saleId: 'sale-1',
        folio: 'A-202605-000001',
        subtotalCents: 20000,
        discountCents: 5000,
        totalCents: 15000,
        paidCents: 20000,
        debtCents: 0,
        changeDueCents: 5000,
        paymentStatus: 'PAID',
        confirmedAt: '2026-05-06T19:00:00.000Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await saleApi.chargeDraft('sale-1', payload, 'idem-key-1')

      expect(http.post).toHaveBeenCalledWith('/sales/drafts/sale-1/charge', payload, {
        headers: {
          'Idempotency-Key': 'idem-key-1',
        },
      })
      expect(result).toEqual(response)
    })

    it('supports non-cash methods with locked amount equal total', async () => {
      const payload: ChargeSalePayload = {
        method: 'card_debit',
        amountCents: 15000,
      }
      const response: ChargeSaleResponse = {
        saleId: 'sale-2',
        folio: 'A-202605-000002',
        subtotalCents: 15000,
        discountCents: 0,
        totalCents: 15000,
        paidCents: 15000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        confirmedAt: '2026-05-06T20:00:00.000Z',
      }

      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await saleApi.chargeDraft('sale-2', payload, 'idem-key-2')

      expect(http.post).toHaveBeenCalledWith('/sales/drafts/sale-2/charge', payload, {
        headers: {
          'Idempotency-Key': 'idem-key-2',
        },
      })
      expect(result.paidCents).toBe(15000)
      expect(result.changeDueCents).toBe(0)
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

  describe('listConfirmed', () => {
    it('should GET /sales with typed list params and return full list response', async () => {
      const params: ListSalesParams = {
        page: 1,
        limit: 20,
        sortBy: 'confirmedAt',
        sortOrder: 'desc',
        q: 'jean',
        deliveryStatus: ['PENDING'],
      }

      const response: ConfirmedSalesListResponse = {
        data: [
          {
            id: 'sale-1',
            folio: 'A-202605-000012',
            status: 'CONFIRMED',
            paymentStatus: 'PAID',
            deliveryStatus: 'DELIVERED',
            totalCents: 127000,
            debtCents: 0,
            confirmedAt: '2026-05-06T14:43:00.000Z',
            dueDate: null,
            customer: { id: 'customer-1', name: 'Empresa F.' },
            cashier: { id: 'cashier-1', name: 'cesar flores' },
            seller: null,
            paymentMethods: ['CASH'],
          },
        ],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
        counts: { all: 50, pendingPayments: 3, notDelivered: 1 },
      }

      vi.mocked(http.get).mockResolvedValue({ data: response })

      const result = await saleApi.listConfirmed(params)

      expect(http.get).toHaveBeenCalledWith('/sales', { params })
      expect(result.pagination.totalPages).toBe(3)
      expect(result.counts.notDelivered).toBe(1)
      expect(result.data[0]?.debtCents).toBe(0)
    })

    it('passes already-serialized UTC date params through unchanged', async () => {
      const response: ConfirmedSalesListResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const params: ListSalesParams = {
        confirmedFrom: '2026-05-23T06:00:00.000Z',
        confirmedTo: '2026-05-24T05:59:59.999Z',
      }

      await saleApi.listConfirmed(params)

      expect(http.get).toHaveBeenCalledWith('/sales', {
        params,
      })
    })

    it('does not re-transform folio CSV already normalized upstream', async () => {
      const response: ConfirmedSalesListResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const params = {
        folio: 'A-202605-000017,A-202605-000018',
      } as unknown as ListSalesParams

      await saleApi.listConfirmed(params)

      expect(http.get).toHaveBeenCalledWith('/sales', {
        params,
      })
    })

    it('regression: accepts Hoy preset UTC range without throwing and calls HTTP', async () => {
      const response: ConfirmedSalesListResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const params: ListSalesParams = {
        confirmedFrom: '2026-05-23T06:00:00.000Z',
        confirmedTo: '2026-05-24T05:59:59.999Z',
      }

      await expect(saleApi.listConfirmed(params)).resolves.toEqual(response)
      expect(http.get).toHaveBeenCalledWith('/sales', { params })
      expect(http.get).toHaveBeenCalledTimes(1)
    })

    it('should pass empty params object and keep backend defaults', async () => {
      const response: ConfirmedSalesListResponse = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        counts: { all: 0, pendingPayments: 0, notDelivered: 0 },
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const result = await saleApi.listConfirmed({})

      expect(http.get).toHaveBeenCalledWith('/sales', { params: {} })
      expect(result.data).toHaveLength(0)
    })
  })

  describe('getById', () => {
    it('should GET /sales/:id and return sale detail response', async () => {
      const response: SaleDetail = {
        id: 'sale-1',
        folio: 'A-202605-000012',
        status: 'CONFIRMED',
        channel: 'POS',
        register: 'Principal',
        confirmedAt: '2026-05-06T14:43:00.000Z',
        dueDate: null,
        subtotalCents: 127000,
        discountCents: 0,
        totalCents: 127000,
        paidCents: 127000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        customer: { id: 'customer-1', name: 'Empresa F.' },
        cashier: { id: 'cashier-1', name: 'cesar flores' },
        seller: null,
        items: [],
        payments: [],
        timeline: [],
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const result = await saleApi.getById('sale-1')

      expect(http.get).toHaveBeenCalledWith('/sales/sale-1')
      expect(result.folio).toBe('A-202605-000012')
      expect(result.channel).toBe('POS')
    })

    it('should support UUID-like ids and preserve nested arrays', async () => {
      const response: SaleDetail = {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        folio: 'A-202605-000013',
        status: 'CONFIRMED',
        channel: 'POS',
        register: 'Principal',
        confirmedAt: '2026-05-07T14:43:00.000Z',
        dueDate: null,
        subtotalCents: 17000,
        discountCents: 0,
        totalCents: 17000,
        paidCents: 17000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        deliveryStatus: 'DELIVERED',
        customer: null,
        cashier: { id: 'cashier-2', name: 'ana' },
        seller: null,
        items: [
          {
            productName: 'Jean Recto',
            variantName: null,
            imageUrl: null,
            unitPriceCents: 17000,
            quantity: 1,
            discountCents: 0,
            subtotalCents: 17000,
          },
        ],
        payments: [
          {
            method: 'CASH',
            amountCents: 17000,
            tenderedCents: 17000,
            changeCents: 0,
            reference: null,
            paidAt: '2026-05-07T14:43:00.000Z',
          },
        ],
        timeline: [{ type: 'SALE_REGISTERED', at: '2026-05-07T14:43:00.000Z', actor: null, register: 'Principal' }],
      }
      vi.mocked(http.get).mockResolvedValue({ data: response })

      const result = await saleApi.getById('a1b2c3d4-e5f6-7890-abcd-ef1234567890')

      expect(http.get).toHaveBeenCalledWith('/sales/a1b2c3d4-e5f6-7890-abcd-ef1234567890')
      expect(result.items).toHaveLength(1)
      expect(result.payments[0]?.method).toBe('CASH')
    })
  })

  describe('getAvailablePrices', () => {
    it('should GET available prices endpoint and return response', async () => {
      const mockResponse: AvailablePricesResponse = {
        saleId: 'sale-1',
        itemId: 'item-1',
        prices: [
          {
            priceListId: 'list-1',
            priceListName: 'PUBLICO',
            priceCents: 2198,
            priceDecimal: 21.98,
            currency: 'MXN',
            isCurrent: true,
          },
        ],
      }

      vi.mocked(http.get).mockResolvedValue({ data: mockResponse })

      const result = await saleApi.getAvailablePrices('sale-1', 'item-1')

      expect(http.get).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/available-prices')
      expect(result.prices[0]?.priceListId).toBe('list-1')
    })
  })

  describe('updateItemPrice', () => {
    const updatedSale: Sale = {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
      createdAt: '2026-04-21T10:00:00Z',
      updatedAt: '2026-04-21T10:00:00Z',
    }

    it('should PATCH with priceListId payload', async () => {
      const payload: OverrideItemPricePayload = { priceListId: 'list-1' }
      vi.mocked(http.patch).mockResolvedValue({ data: updatedSale })

      await saleApi.updateItemPrice('sale-1', 'item-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/price', payload)
    })

    it('should PATCH with customPriceCents payload', async () => {
      const payload: OverrideItemPricePayload = { customPriceCents: 2198 }
      vi.mocked(http.patch).mockResolvedValue({ data: updatedSale })

      await saleApi.updateItemPrice('sale-1', 'item-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/price', payload)
    })

    it.each([400, 403, 404, 409, 422])('should reject documented error status %s', async (status) => {
      const payload: OverrideItemPricePayload = { customPriceCents: 2198 }
      const apiError = { response: { status } }
      vi.mocked(http.patch).mockRejectedValue(apiError)

      await expect(saleApi.updateItemPrice('sale-1', 'item-1', payload)).rejects.toEqual(apiError)
    })
  })

  describe('applyItemDiscount', () => {
    const updatedSale: Sale = {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
      createdAt: '2026-04-21T10:00:00Z',
      updatedAt: '2026-04-21T10:00:00Z',
    }

    it('sends PATCH discount request with amount payload', async () => {
      const payload: ApplyItemDiscountPayload = { type: 'amount', amountCents: 2000, title: 'Promo' }
      vi.mocked(http.patch).mockResolvedValue({ data: updatedSale })

      await saleApi.applyItemDiscount('sale-1', 'item-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/discount', payload)
    })

    it('sends PATCH discount request with percentage payload', async () => {
      const payload: ApplyItemDiscountPayload = { type: 'percentage', percent: 10 }
      vi.mocked(http.patch).mockResolvedValue({ data: updatedSale })

      await saleApi.applyItemDiscount('sale-1', 'item-1', payload)

      expect(http.patch).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/discount', payload)
    })
  })

  describe('removeItemDiscount', () => {
    it('sends DELETE discount request', async () => {
      const updatedSale: Sale = {
        id: 'sale-1', userId: 'user-1', status: 'DRAFT', items: [], createdAt: 'x', updatedAt: 'y'
      }
      vi.mocked(http.delete).mockResolvedValue({ data: updatedSale })

      await saleApi.removeItemDiscount('sale-1', 'item-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1/discount')
    })
  })

  describe('removeItem', () => {
    it('sends DELETE item request and returns updated sale', async () => {
      const updatedSale: Sale = {
        id: 'sale-1', userId: 'user-1', status: 'DRAFT', items: [], createdAt: 'x', updatedAt: 'y'
      }
      vi.mocked(http.delete).mockResolvedValue({ data: updatedSale })

      const result = await saleApi.removeItem('sale-1', 'item-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/drafts/sale-1/items/item-1')
      expect(result).toEqual(updatedSale)
    })
  })

  describe('registerDebtPayment', () => {
    it('posts multi-method Form A payload with idempotency header', async () => {
      const payload: DebtPaymentPayload = {
        payments: [
          { method: 'card_credit', amountCents: 15000, reference: 'AUTH-1' },
          { method: 'cash', amountCents: 5000 },
        ],
      }

      const response: DebtPaymentResponse = {
        saleId: 'sale-1',
        paidCents: 30000,
        debtCents: 5000,
        totalCents: 35000,
        paymentStatus: 'PARTIAL',
        paymentIds: ['pay-1', 'pay-2'],
      }

      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await saleApi.registerDebtPayment('sale-1', payload, 'idem-debt-1')

      expect(http.post).toHaveBeenCalledWith('/sales/sale-1/payments', payload, {
        headers: {
          'Idempotency-Key': 'idem-debt-1',
        },
      })
      expect(result.paymentStatus).toBe('PARTIAL')
      expect(result.paymentIds).toEqual(['pay-1', 'pay-2'])
    })

    it('posts single-entry Form A payload for cash-only payment', async () => {
      const payload: DebtPaymentPayload = {
        payments: [{ method: 'cash', amountCents: 5000 }],
      }

      const response: DebtPaymentResponse = {
        saleId: 'sale-1',
        paidCents: 35000,
        debtCents: 0,
        totalCents: 35000,
        paymentStatus: 'PAID',
        paymentIds: ['pay-3'],
      }

      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await saleApi.registerDebtPayment('sale-1', payload, 'idem-debt-2')

      expect(http.post).toHaveBeenCalledWith('/sales/sale-1/payments', payload, {
        headers: {
          'Idempotency-Key': 'idem-debt-2',
        },
      })
      expect(result.paymentStatus).toBe('PAID')
      expect(result.paymentIds).toEqual(['pay-3'])
    })
  })

  describe('sale comments endpoints', () => {
    it('addComment POSTs to /sales/:id/comments', async () => {
      const response = {
        id: 'comment-1',
        saleId: 'sale-1',
        tenantId: 'tenant-1',
        authorUserId: 'user-1',
        body: 'hola',
        createdAt: '2026-05-06T14:44:00.000Z',
        updatedAt: '2026-05-06T14:44:00.000Z',
        deletedAt: null,
      }
      vi.mocked(http.post).mockResolvedValue({ data: response })

      const result = await saleApi.addComment('sale-1', { body: 'hola' })

      expect(http.post).toHaveBeenCalledWith('/sales/sale-1/comments', { body: 'hola' })
      expect(result.id).toBe('comment-1')
    })

    it('updateComment PATCHes to /sales/:id/comments/:commentId', async () => {
      const response = {
        id: 'comment-1',
        saleId: 'sale-1',
        tenantId: 'tenant-1',
        authorUserId: 'user-1',
        body: 'editado',
        createdAt: '2026-05-06T14:44:00.000Z',
        updatedAt: '2026-05-06T14:45:00.000Z',
        deletedAt: null,
      }
      vi.mocked(http.patch).mockResolvedValue({ data: response })

      const result = await saleApi.updateComment('sale-1', 'comment-1', { body: 'editado' })

      expect(http.patch).toHaveBeenCalledWith('/sales/sale-1/comments/comment-1', { body: 'editado' })
      expect(result.body).toBe('editado')
    })

    it('deleteComment DELETEs /sales/:id/comments/:commentId', async () => {
      vi.mocked(http.delete).mockResolvedValue({ data: undefined })

      await saleApi.deleteComment('sale-1', 'comment-1')

      expect(http.delete).toHaveBeenCalledWith('/sales/sale-1/comments/comment-1')
    })

    it('maps known backend comment errors to SaleCommentError', async () => {
      vi.mocked(http.post).mockRejectedValueOnce({ response: { data: { error: 'COMMENT_AUTHOR_FORBIDDEN' } } })
      vi.mocked(http.patch).mockRejectedValueOnce({ response: { data: { error: 'COMMENT_NOT_FOUND' } } })
      vi.mocked(http.delete).mockRejectedValueOnce({ response: { data: { error: 'SALE_NOT_FOUND' } } })

      await expect(saleApi.addComment('sale-1', { body: 'x' })).rejects.toMatchObject({
        code: 'COMMENT_AUTHOR_FORBIDDEN',
      })
      await expect(saleApi.updateComment('sale-1', 'comment-1', { body: 'x' })).rejects.toMatchObject({
        code: 'COMMENT_NOT_FOUND',
      })
      await expect(saleApi.deleteComment('sale-1', 'comment-1')).rejects.toMatchObject({
        code: 'SALE_NOT_FOUND',
      })
    })
  })
})
