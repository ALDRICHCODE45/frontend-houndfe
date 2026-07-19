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
  removeChargedDraftFromCache,
  useSalesDrafts,
} from '../useSalesDrafts'
import type { Sale, ChargeSaleResponse } from '../../interfaces/sale.types'

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
    removeItem: vi.fn(),
    applyGlobalDiscount: vi.fn(),
    removeGlobalDiscount: vi.fn(),
    chargeDraft: vi.fn(),
    // promotions-in-sale A.4:
    applyManualPromotion: vi.fn(),
    removeManualPromotion: vi.fn(),
    vetoAutoPromotion: vi.fn(),
    // pos-price-list-tiers:
    setPriceList: vi.fn(),
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

const tenantDraftsKey = saleQueryKeys.drafts('tenant-1')

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

  describe('removeChargedDraftFromCache', () => {
    it('should remove charged draft from cache', () => {
      const result = removeChargedDraftFromCache(mockSales, 'sale-2')

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('sale-1')
    })

    it('should keep cache unchanged when sale id does not exist', () => {
      const result = removeChargedDraftFromCache(mockSales, 'sale-999')

      expect(result).toEqual(mockSales)
    })
  })

  describe('chargeDraft mutation skeleton', () => {
    it('evicts charged draft from cache after successful charge', async () => {
      vi.mocked(saleApi.listDrafts).mockResolvedValue(mockSales)
      vi.mocked(saleApi.chargeDraft).mockResolvedValue({
        saleId: 'sale-2',
        folio: 'A-202605-000002',
        subtotalCents: 10000,
        discountCents: 0,
        totalCents: 10000,
        paidCents: 10000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        confirmedAt: '2026-05-06T21:00:00.000Z',
      })

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => {
        expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual(mockSales)
      })

      await result.chargeDraft('sale-2', { method: 'card_credit', amountCents: 10000 }, 'idem-key-2')

      const cachedDrafts = queryClient.getQueryData<Sale[]>(tenantDraftsKey)
      expect(cachedDrafts).toHaveLength(1)
      expect(cachedDrafts?.[0]?.id).toBe('sale-1')
      expect(saleApi.chargeDraft).toHaveBeenCalledWith(
        'sale-2',
        { method: 'card_credit', amountCents: 10000 },
        'idem-key-2',
      )
    })

    it('exposes pending state while charge mutation is in flight', async () => {
      vi.mocked(saleApi.listDrafts).mockResolvedValue(mockSales)

      let resolveCharge: ((value: ChargeSaleResponse) => void) | null = null

      vi.mocked(saleApi.chargeDraft).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCharge = resolve
          }),
      )

      const { result } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => {
        expect(result.drafts.value).toHaveLength(2)
      })

      const chargePromise = result.chargeDraft('sale-2', { method: 'cash', amountCents: 10000 }, 'idem-key-pending')

      await vi.waitFor(() => {
        expect(result.isMutating.value).toBe(true)
      })

      ;(resolveCharge as unknown as (value: ChargeSaleResponse) => void)({
        saleId: 'sale-2',
        folio: 'A-202605-000002',
        subtotalCents: 10000,
        discountCents: 0,
        totalCents: 10000,
        paidCents: 10000,
        debtCents: 0,
        changeDueCents: 0,
        paymentStatus: 'PAID',
        confirmedAt: '2026-05-06T21:00:00.000Z',
      })
      await chargePromise

      await vi.waitFor(() => {
        expect(result.isMutating.value).toBe(false)
      })
    })

    it('keeps drafts cache unchanged when charge fails', async () => {
      vi.mocked(saleApi.listDrafts).mockResolvedValue(mockSales)
      vi.mocked(saleApi.chargeDraft).mockRejectedValue(new Error('network'))

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => {
        expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual(mockSales)
      })

      await expect(
        result.chargeDraft('sale-2', { method: 'cash', amountCents: 10000 }, 'idem-key-fail'),
      ).rejects.toThrow('network')

      expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual(mockSales)
      expect(result.isMutating.value).toBe(false)
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
        expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft])
      })
      result.activeTabId.value = 'sale-1'

      await result.updateItemPrice('item-1', { customPriceCents: 250 })

      const cachedDrafts = queryClient.getQueryData<Sale[]>(tenantDraftsKey)
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
        expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft])
      })
      result.activeTabId.value = 'sale-1'

      await expect(result.updateItemPrice('item-1', { priceListId: 'list-1' })).rejects.toThrow('conflict')

      const cachedDrafts = queryClient.getQueryData<Sale[]>(tenantDraftsKey)
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
      await vi.waitFor(() => expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft]))
      result.activeTabId.value = 'sale-1'

      await result.applyItemDiscount('item-1', { type: 'amount', amountCents: 2000 })

      expect(saleApi.applyItemDiscount).toHaveBeenCalledWith('sale-1', 'item-1', { type: 'amount', amountCents: 2000 })
      expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)?.[0]?.items[0]?.unitPriceCents).toBe(8000)
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
      await vi.waitFor(() => expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft]))
      result.activeTabId.value = 'sale-1'

      await result.removeItemDiscount('item-1')

      expect(saleApi.removeItemDiscount).toHaveBeenCalledWith('sale-1', 'item-1')
      expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)?.[0]?.items[0]?.discountType).toBeNull()
    })
  })

  describe('removeItem mutation cache behavior', () => {
    it('replaces draft cache on successful removeItem', async () => {
      const existingDraft: Sale = {
        id: 'sale-1', userId: 'user-1', status: 'DRAFT', createdAt: 'x', updatedAt: 'x',
        items: [
          { id: 'item-1', productId: 'prod-1', variantId: null, productName: 'Aspirina', variantName: null, quantity: 1, unitPriceCents: 10000, unitPriceCurrency: 'MXN' },
          { id: 'item-2', productId: 'prod-2', variantId: null, productName: 'Ibuprofeno', variantName: null, quantity: 1, unitPriceCents: 5000, unitPriceCurrency: 'MXN' },
        ],
      }
      const updatedDraft: Sale = {
        ...existingDraft,
        updatedAt: 'y',
        items: [{ ...existingDraft.items[1]! }],
      }
      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      vi.mocked(saleApi.removeItem).mockResolvedValue(updatedDraft)

      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() => expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft]))
      result.activeTabId.value = 'sale-1'

      await result.removeItem('item-1')

      expect(saleApi.removeItem).toHaveBeenCalledWith('sale-1', 'item-1')
      expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)?.[0]?.items).toHaveLength(1)
      expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)?.[0]?.items[0]?.id).toBe('item-2')
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // promotions-in-sale A.4 — every draft mutation onSuccess MUST invalidate
  // the applicable-promotions query for that draft, plus the 3 new promotion
  // mutations also setQueryData with replaceSaleInCache like the existing ones.
  // Spec §6: "Every useSalesDrafts mutation (onSuccess) MUST invalidate
  //   query { queryKey: applicablePromotionsKey(draftId) }".
  // ────────────────────────────────────────────────────────────────────────
  describe('promotion applicable-list invalidation + new promotion mutations (A.4)', () => {
    const existingDraft: Sale = {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      createdAt: '2026-04-21T10:00:00Z',
      updatedAt: '2026-04-21T10:00:00Z',
      items: [
        {
          id: 'item-1',
          productId: 'prod-1',
          variantId: null,
          productName: 'Aspirina',
          variantName: null,
          quantity: 1,
          unitPriceCents: 10000,
          unitPriceCurrency: 'MXN',
        },
      ],
    }
    const updatedDraft: Sale = { ...existingDraft, updatedAt: '2026-04-21T10:01:00Z' }
    const expectedApplicableKey = saleQueryKeys.applicablePromotions('tenant-1', 'sale-1')

    async function setupWithSpy() {
      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() =>
        expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft]),
      )
      result.activeTabId.value = 'sale-1'
      const spy = vi.spyOn(queryClient, 'invalidateQueries')
      return { result, queryClient, spy }
    }

    // ── Existing mutations: assert new behavior ──

    it('addItem onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.addItem).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpy()

      await result.addItem('prod-2', null, 1)

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('updateQty onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.updateItemQty).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpy()

      await result.updateQty('item-1', 3)

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('clearItems onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.clearItems).mockResolvedValue({ ...updatedDraft, items: [] })
      const { result, spy } = await setupWithSpy()

      await result.clearItems()

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('removeItem onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.removeItem).mockResolvedValue({
        ...updatedDraft,
        items: [],
      })
      const { result, spy } = await setupWithSpy()

      await result.removeItem('item-1')

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('updateItemPrice onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.updateItemPrice).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpy()

      await result.updateItemPrice('item-1', { customPriceCents: 9000 })

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('applyItemDiscount onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.applyItemDiscount).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpy()

      await result.applyItemDiscount('item-1', { type: 'amount', amountCents: 500 })

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('removeItemDiscount onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.removeItemDiscount).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpy()

      await result.removeItemDiscount('item-1')

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('applyGlobalDiscount onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.applyGlobalDiscount).mockResolvedValue({ sale: updatedDraft, skippedItems: [] })
      const { result, spy } = await setupWithSpy()

      await result.applyGlobalDiscount({ type: 'percentage', percent: 10 })

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('removeGlobalDiscount onSuccess invalidates applicable-promotions for the affected draft', async () => {
      vi.mocked(saleApi.removeGlobalDiscount).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpy()

      await result.removeGlobalDiscount()

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    // ── 3 new promotion mutations: mirror existing pattern (setQueryData + invalidate) ──

    async function assertSetQueryDataAndInvalidate(
      result: { activeDraft: unknown; addItem: unknown; applyManualPromotion: any; removeManualPromotion: any; vetoAutoPromotion: any },
      // Loosely-typed QueryClient surface — only the bits the helper uses
      // (getQueryData + setQueryData for vi.spyOn). The runtime value is the
      // real QueryClient; the parameter is intentionally narrow to keep the
      // helper easy to call.
      queryClient: {
        getQueryData: <T>(key: readonly unknown[]) => T | undefined
        setQueryData: <T>(key: unknown, value: unknown) => unknown
        [k: string]: unknown
      },
      spy: { mock: { calls: any[] } } & ((...args: unknown[]) => unknown),
      invoke: () => Promise<unknown>,
    ) {
      const resultSpy = vi.spyOn(queryClient as unknown as { setQueryData: () => void }, 'setQueryData')
      await invoke()
      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
      // setQueryData was called with the draftsKey + the result of
      // replaceSaleInCache(currentDrafts, updatedSale) which is a Sale[]
      // (matches the imperative pattern used by every other mutation in this
      // composable — getQueryData → setQueryData(array)).
      expect(resultSpy).toHaveBeenCalledWith(
        tenantDraftsKey,
        expect.any(Array),
      )
      resultSpy.mockRestore()
    }

    it('applyManualPromotion onSuccess sets draftsKey cache AND invalidates applicable-promotions', async () => {
      vi.mocked(saleApi.applyManualPromotion).mockResolvedValue(updatedDraft)
      const { result, queryClient, spy } = await setupWithSpy()

      await assertSetQueryDataAndInvalidate(
        result as never,
        queryClient as never,
        spy as never,
        // Public surface mirrors the existing useSalesDrafts pattern:
        // saleId comes from activeTabId; only promotionId is an arg.
        () => (result as { applyManualPromotion: (promotionId: string) => Promise<unknown> }).applyManualPromotion('promo-a'),
      )

      expect(saleApi.applyManualPromotion).toHaveBeenCalledWith('sale-1', 'promo-a')
    })

    it('removeManualPromotion onSuccess sets draftsKey cache AND invalidates applicable-promotions', async () => {
      vi.mocked(saleApi.removeManualPromotion).mockResolvedValue(updatedDraft)
      const { result, queryClient, spy } = await setupWithSpy()

      await assertSetQueryDataAndInvalidate(
        result as never,
        queryClient as never,
        spy as never,
        () => (result as { removeManualPromotion: (promotionId: string) => Promise<unknown> }).removeManualPromotion('promo-b'),
      )

      expect(saleApi.removeManualPromotion).toHaveBeenCalledWith('sale-1', 'promo-b')
    })

    it('vetoAutoPromotion onSuccess sets draftsKey cache AND invalidates applicable-promotions', async () => {
      vi.mocked(saleApi.vetoAutoPromotion).mockResolvedValue(updatedDraft)
      const { result, queryClient, spy } = await setupWithSpy()

      await assertSetQueryDataAndInvalidate(
        result as never,
        queryClient as never,
        spy as never,
        () => (result as { vetoAutoPromotion: (promotionId: string) => Promise<unknown> }).vetoAutoPromotion('promo-c'),
      )

      expect(saleApi.vetoAutoPromotion).toHaveBeenCalledWith('sale-1', 'promo-c')
    })
  })

  // ────────────────────────────────────────────────────────────────────────
  // pos-price-list-tiers — setPriceList mutation mirrors the existing
  // pattern (replaceSaleInCache on draftsKey + invalidate applicable
  // promotions). SaleId is passed explicitly because the assignment can
  // target any draft, not just the active one.
  // ────────────────────────────────────────────────────────────────────────
  describe('setPriceList mutation cache behavior (pos-price-list-tiers)', () => {
    const existingDraft: Sale = {
      id: 'sale-1',
      userId: 'user-1',
      status: 'DRAFT',
      createdAt: '2026-04-21T10:00:00Z',
      updatedAt: '2026-04-21T10:00:00Z',
      items: [],
    }
    const updatedDraft: Sale = {
      ...existingDraft,
      globalPriceListId: 'list-mayoreo',
      updatedAt: '2026-04-21T10:30:00Z',
    }
    const expectedApplicableKey = saleQueryKeys.applicablePromotions('tenant-1', 'sale-1')

    async function setupWithSpyForPriceList() {
      vi.mocked(saleApi.listDrafts).mockResolvedValue([existingDraft])
      const { result, queryClient } = mountComposable(() => useSalesDrafts())
      await vi.waitFor(() =>
        expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)).toEqual([existingDraft]),
      )
      const spy = vi.spyOn(queryClient, 'invalidateQueries')
      return { result, queryClient, spy }
    }

    it('replaces the draft cache on successful setPriceList (PUT returns updated Sale)', async () => {
      vi.mocked(saleApi.setPriceList).mockResolvedValue(updatedDraft)
      const { result, queryClient } = await setupWithSpyForPriceList()

      const returned = await result.setPriceList('sale-1', 'list-mayoreo')

      expect(saleApi.setPriceList).toHaveBeenCalledWith('sale-1', { globalPriceListId: 'list-mayoreo' })
      expect(returned).toEqual(updatedDraft)

      const cached = queryClient.getQueryData<Sale[]>(tenantDraftsKey)
      expect(cached).toHaveLength(1)
      expect(cached?.[0]?.globalPriceListId).toBe('list-mayoreo')
      expect(cached?.[0]?.updatedAt).toBe('2026-04-21T10:30:00Z')
    })

    it('invalidates applicable-promotions for the affected draft on success', async () => {
      vi.mocked(saleApi.setPriceList).mockResolvedValue(updatedDraft)
      const { result, spy } = await setupWithSpyForPriceList()

      await result.setPriceList('sale-1', 'list-mayoreo')

      expect(spy).toHaveBeenCalledWith({ queryKey: expectedApplicableKey })
    })

    it('clears the active price list when globalPriceListId is null', async () => {
      const clearedDraft: Sale = { ...existingDraft, globalPriceListId: null }
      vi.mocked(saleApi.setPriceList).mockResolvedValue(clearedDraft)
      const { result, queryClient } = await setupWithSpyForPriceList()

      const returned = await result.setPriceList('sale-1', null)

      expect(saleApi.setPriceList).toHaveBeenCalledWith('sale-1', { globalPriceListId: null })
      expect(returned.globalPriceListId).toBeNull()
      expect(queryClient.getQueryData<Sale[]>(tenantDraftsKey)?.[0]?.globalPriceListId).toBeNull()
    })

    it('keeps the existing draft cache unchanged when setPriceList fails', async () => {
      vi.mocked(saleApi.setPriceList).mockRejectedValue(new Error('PRICE_LIST_NOT_FOUND'))
      const { result, queryClient } = await setupWithSpyForPriceList()

      await expect(result.setPriceList('sale-1', 'list-mayoreo')).rejects.toThrow('PRICE_LIST_NOT_FOUND')

      const cached = queryClient.getQueryData<Sale[]>(tenantDraftsKey)
      expect(cached).toEqual([existingDraft])
      expect(cached?.[0]?.globalPriceListId).toBeUndefined()
      expect(result.isMutating.value).toBe(false)
    })

    it('flips isMutating to true while setPriceList is in flight, false after settle', async () => {
      let resolveSetPriceList: ((value: Sale) => void) | null = null
      vi.mocked(saleApi.setPriceList).mockImplementation(
        () =>
          new Promise<Sale>((resolve) => {
            resolveSetPriceList = resolve
          }),
      )

      const { result } = await setupWithSpyForPriceList()

      const inFlight = result.setPriceList('sale-1', 'list-mayoreo')

      await vi.waitFor(() => {
        expect(result.isMutating.value).toBe(true)
      })

      ;(resolveSetPriceList as unknown as (value: Sale) => void)(updatedDraft)
      await inFlight

      await vi.waitFor(() => {
        expect(result.isMutating.value).toBe(false)
      })
    })
  })
})
