import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { saleApi } from '../../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import {
  appendSaleToCache,
  removeSaleFromCache,
  replaceSaleInCache,
  getActiveDraftId,
  getNextActiveIdAfterClose,
  useSalesDrafts,
} from '../useSalesDrafts'
import type { Sale } from '../../interfaces/sale.types'

vi.mock('../../api/sale.api', () => ({
  saleApi: {
    listDrafts: vi.fn(),
    createDraft: vi.fn(),
    closeDraft: vi.fn(),
    addItem: vi.fn(),
    updateItemQty: vi.fn(),
    clearItems: vi.fn(),
    updateItemPrice: vi.fn(),
    applyItemDiscount: vi.fn(),
    removeItemDiscount: vi.fn(),
  },
}))

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
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

  const wrapper = mount(TestComponent, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })

  return { result: result!, wrapper, queryClient }
}

describe('useSalesDrafts - pure cache update functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(saleApi.listDrafts).mockResolvedValue([])
    vi.mocked(saleApi.createDraft).mockResolvedValue({
      id: 'sale-auto',
      userId: 'user-1',
      status: 'DRAFT',
      items: [],
      createdAt: '2026-04-21T10:00:00Z',
      updatedAt: '2026-04-21T10:00:00Z',
    })
  })

  const mockSales: Sale[] = [
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
          productName: 'Aspirina',
          variantName: null,
          quantity: 2,
          unitPriceCents: 5000,
          unitPriceCurrency: 'MXN',
        },
      ],
      createdAt: '2026-04-21T09:00:00Z',
      updatedAt: '2026-04-21T10:15:00Z',
    },
  ]

  describe('appendSaleToCache', () => {
    it('should append new sale to end of list', () => {
      const newSale: Sale = {
        id: 'sale-3',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T11:00:00Z',
        updatedAt: '2026-04-21T11:00:00Z',
      }

      const result = appendSaleToCache(mockSales, newSale)

      expect(result).toHaveLength(3)
      expect(result[0]?.id).toBe('sale-1')
      expect(result[1]?.id).toBe('sale-2')
      expect(result[2]?.id).toBe('sale-3')
    })

    it('should handle empty cache', () => {
      const newSale: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T11:00:00Z',
        updatedAt: '2026-04-21T11:00:00Z',
      }

      const result = appendSaleToCache([], newSale)

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('sale-1')
    })

    it('should not mutate original array', () => {
      const originalLength = mockSales.length
      const newSale: Sale = {
        id: 'sale-3',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T11:00:00Z',
        updatedAt: '2026-04-21T11:00:00Z',
      }

      appendSaleToCache(mockSales, newSale)

      expect(mockSales).toHaveLength(originalLength)
    })
  })

  describe('removeSaleFromCache', () => {
    it('should remove sale by id', () => {
      const result = removeSaleFromCache(mockSales, 'sale-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('sale-2')
    })

    it('should return empty array when removing last sale', () => {
      const result = removeSaleFromCache([mockSales[0]!], 'sale-1')

      expect(result).toEqual([])
    })

    it('should return unchanged array when id not found', () => {
      const result = removeSaleFromCache(mockSales, 'sale-999')

      expect(result).toHaveLength(2)
      expect(result).toEqual(mockSales)
    })
  })

  describe('replaceSaleInCache', () => {
    it('should replace sale with matching id', () => {
      const updatedSale: Sale = {
        ...mockSales[1]!,
        items: [
          {
            id: 'item-2',
            productId: 'prod-2',
            variantId: null,
            productName: 'Vitamina C',
            variantName: null,
            quantity: 3,
            unitPriceCents: 8000,
            unitPriceCurrency: 'MXN',
          },
        ],
        updatedAt: '2026-04-21T11:30:00Z',
      }

      const result = replaceSaleInCache(mockSales, updatedSale)

      expect(result).toHaveLength(2)
      expect(result[1]?.id).toBe('sale-2')
      expect(result[1]?.items).toHaveLength(1)
      expect(result[1]?.items[0]?.productName).toBe('Vitamina C')
      expect(result[1]?.updatedAt).toBe('2026-04-21T11:30:00Z')
    })

    it('should preserve array order', () => {
      const updatedSale: Sale = {
        ...mockSales[0]!,
        updatedAt: '2026-04-21T12:00:00Z',
      }

      const result = replaceSaleInCache(mockSales, updatedSale)

      expect(result[0]?.id).toBe('sale-1')
      expect(result[1]?.id).toBe('sale-2')
    })

    it('should return unchanged array if id not found', () => {
      const nonExistentSale: Sale = {
        id: 'sale-999',
        userId: 'user-1',
        status: 'DRAFT',
        items: [],
        createdAt: '2026-04-21T12:00:00Z',
        updatedAt: '2026-04-21T12:00:00Z',
      }

      const result = replaceSaleInCache(mockSales, nonExistentSale)

      expect(result).toEqual(mockSales)
    })

    it('should handle replacing first item in list', () => {
      const updatedSale: Sale = {
        ...mockSales[0]!,
        items: [
          {
            id: 'item-x',
            productId: 'prod-x',
            variantId: 'var-x',
            productName: 'New Product',
            variantName: 'Variant A',
            quantity: 5,
            unitPriceCents: 10000,
            unitPriceCurrency: 'MXN',
          },
        ],
      }

      const result = replaceSaleInCache(mockSales, updatedSale)

      expect(result[0]?.items).toHaveLength(1)
      expect(result[0]?.items[0]?.productName).toBe('New Product')
    })
  })

  describe('getActiveDraftId', () => {
    it('should return localStorage id if it exists in drafts', () => {
      const result = getActiveDraftId(mockSales, 'sale-2', null)

      expect(result).toBe('sale-2')
    })

    it('should return first draft id if localStorage id not in list', () => {
      const result = getActiveDraftId(mockSales, 'sale-999', null)

      expect(result).toBe('sale-1')
    })

    it('should return first draft id if no localStorage value', () => {
      const result = getActiveDraftId(mockSales, null, null)

      expect(result).toBe('sale-1')
    })

    it('should return null if drafts list is empty', () => {
      const result = getActiveDraftId([], 'sale-1', null)

      expect(result).toBeNull()
    })

    it('should use autoCreatedId when provided and drafts is empty', () => {
      const result = getActiveDraftId([], null, 'sale-auto-1')

      expect(result).toBe('sale-auto-1')
    })

    it('should prefer localStorage over autoCreatedId when both present', () => {
      const result = getActiveDraftId(mockSales, 'sale-1', 'sale-auto-1')

      expect(result).toBe('sale-1')
    })

    it('should handle single draft in list', () => {
      const singleDraft = [mockSales[0]!]
      const result = getActiveDraftId(singleDraft, null, null)

      expect(result).toBe('sale-1')
    })
  })

  describe('getNextActiveIdAfterClose', () => {
    it('should return first draft id when list is not empty', () => {
      const result = getNextActiveIdAfterClose([mockSales[1]!])

      expect(result).toBe('sale-2')
    })

    it('should return null when list is empty', () => {
      const result = getNextActiveIdAfterClose([])

      expect(result).toBeNull()
    })
  })

  describe('updateItemPrice mutation cache behavior', () => {
    it('replaces draft cache on successful updateItemPrice', async () => {
      const existingDraft: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Aspirina',
            variantName: null,
            quantity: 1,
            unitPriceCents: 100,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      const updatedDraft: Sale = {
        ...existingDraft,
        items: [
          {
            ...existingDraft.items[0]!,
            unitPriceCents: 250,
          },
        ],
        updatedAt: '2026-04-21T10:05:00Z',
      }

      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      vi.mocked(saleApi.updateItemPrice).mockResolvedValue(updatedDraft)

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => {
        expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())).toEqual([existingDraft])
      })
      result.activeTabId.value = 'sale-1'

      await result.updateItemPrice('item-1', { customPriceCents: 250 })

      const cachedDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())
      expect(cachedDrafts).toHaveLength(1)
      expect(cachedDrafts?.[0]?.items[0]?.unitPriceCents).toBe(250)
      expect(cachedDrafts?.[0]?.updatedAt).toBe('2026-04-21T10:05:00Z')
      expect(saleApi.updateItemPrice).toHaveBeenCalledWith('sale-1', 'item-1', {
        customPriceCents: 250,
      })
    })

    it('keeps existing draft cache unchanged when updateItemPrice fails', async () => {
      const existingDraft: Sale = {
        id: 'sale-1',
        userId: 'user-1',
        status: 'DRAFT',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            variantId: null,
            productName: 'Aspirina',
            variantName: null,
            quantity: 1,
            unitPriceCents: 100,
            unitPriceCurrency: 'MXN',
          },
        ],
        createdAt: '2026-04-21T10:00:00Z',
        updatedAt: '2026-04-21T10:00:00Z',
      }

      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      vi.mocked(saleApi.updateItemPrice).mockRejectedValue(new Error('conflict'))

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => {
        expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())).toEqual([existingDraft])
      })
      result.activeTabId.value = 'sale-1'

      await expect(result.updateItemPrice('item-1', { priceListId: 'list-1' })).rejects.toThrow('conflict')

      const cachedDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())
      expect(cachedDrafts).toEqual([existingDraft])
      expect(cachedDrafts?.[0]?.items[0]?.unitPriceCents).toBe(100)
    })
  })

  describe('item discount mutations cache behavior', () => {
    it('replaces draft cache on successful applyItemDiscount', async () => {
      const existingDraft: Sale = {
        id: 'sale-1', userId: 'user-1', status: 'DRAFT', createdAt: 'x', updatedAt: 'x',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'Aspirina', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' }],
      }
      const updatedDraft: Sale = {
        ...existingDraft,
        updatedAt: 'y',
        items: [{ ...existingDraft.items[0]!, unitPriceCents: 8000, discountType: 'amount', discountAmountCents: 2000 }],
      }
      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      vi.mocked(saleApi.applyItemDiscount).mockResolvedValue(updatedDraft)

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())).toEqual([existingDraft]))
      result.activeTabId.value = 'sale-1'

      await result.applyItemDiscount('item-1', { type: 'amount', amountCents: 2000 })

      expect(saleApi.applyItemDiscount).toHaveBeenCalledWith('sale-1', 'item-1', { type: 'amount', amountCents: 2000 })
      expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())?.[0]?.items[0]?.unitPriceCents).toBe(8000)
    })

    it('replaces draft cache on successful removeItemDiscount', async () => {
      const existingDraft: Sale = {
        id: 'sale-1', userId: 'user-1', status: 'DRAFT', createdAt: 'x', updatedAt: 'x',
        items: [{ id: 'item-1', productId: 'prod-1', variantId: null, productName: 'Aspirina', variantName: null, quantity: 1, unitPriceCents: 8000, unitPriceCurrency: 'MXN', discountType: 'amount', discountAmountCents: 2000 }],
      }
      const updatedDraft: Sale = {
        ...existingDraft,
        updatedAt: 'z',
        items: [{ ...existingDraft.items[0]!, unitPriceCents: 10000, discountType: null, discountAmountCents: null }],
      }
      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      vi.mocked(saleApi.removeItemDiscount).mockResolvedValue(updatedDraft)

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())).toEqual([existingDraft]))
      result.activeTabId.value = 'sale-1'

      await result.removeItemDiscount('item-1')

      expect(saleApi.removeItemDiscount).toHaveBeenCalledWith('sale-1', 'item-1')
      expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts())?.[0]?.items[0]?.discountType).toBeNull()
    })
  })
})
