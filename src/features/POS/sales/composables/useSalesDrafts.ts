import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import type {
  Sale,
  AddItemPayload,
  UpdateQtyPayload,
  OverrideItemPricePayload,
  ApplyItemDiscountPayload,
  ApplyGlobalDiscountPayload,
  GlobalDiscountResponse,
  ChargeSalePayload,
  ChargeSaleResponse,
} from '../interfaces/sale.types'

// ── Pure functions for cache manipulation ────────────────────────────────────

export function appendSaleToCache(currentSales: Sale[], newSale: Sale): Sale[] {
  return [...currentSales, newSale]
}

export function removeSaleFromCache(currentSales: Sale[], saleId: string): Sale[] {
  return currentSales.filter((sale) => sale.id !== saleId)
}

export function replaceSaleInCache(currentSales: Sale[], updatedSale: Sale): Sale[] {
  const index = currentSales.findIndex((sale) => sale.id === updatedSale.id)
  if (index === -1) return currentSales

  const newSales = [...currentSales]
  newSales[index] = updatedSale
  return newSales
}

export function getActiveDraftId(
  drafts: Sale[],
  localStorageId: string | null,
  autoCreatedId: string | null,
): string | null {
  if (drafts.length === 0) {
    return autoCreatedId
  }

  if (localStorageId && drafts.some((d) => d.id === localStorageId)) {
    return localStorageId
  }

  return drafts[0]?.id ?? null
}

export function getNextActiveIdAfterClose(remainingDrafts: Sale[]): string | null {
  return remainingDrafts[0]?.id ?? null
}

export function removeChargedDraftFromCache(currentSales: Sale[], chargedSaleId: string): Sale[] {
  return currentSales.filter((sale) => sale.id !== chargedSaleId)
}

interface ChargeDraftMutationInput {
  saleId: string
  payload: ChargeSalePayload
  idempotencyKey: string
}

interface PromotionMutationInput {
  saleId: string
  promotionId: string
}

// ── Main composable ───────────────────────────────────────────────────────────

export function useSalesDrafts() {
  const tenantId = useSafeTenantId()
  const queryClient = useQueryClient()
  const draftsKey = computed(() => saleQueryKeys.drafts(tenantId.value))
  const activeTabId = ref<string | null>(null)

  // promotions-in-sale helper: every draft mutation onSuccess MUST invalidate
  // the applicable-promotions query for that draft (spec §6). Backend may
  // apply/drop auto promos on any cart change, so the eligible list never
  // gets cached across a mutation.
  function invalidateApplicablePromotions(saleId: string) {
    queryClient.invalidateQueries({
      queryKey: saleQueryKeys.applicablePromotions(tenantId.value, saleId),
    })
  }

  // Query for drafts list
  const { data: drafts, isLoading: isLoadingList } = useQuery({
    queryKey: draftsKey,
    queryFn: saleApi.listDrafts,
    staleTime: Infinity,
  })

  // Computed active draft
  const activeDraft = computed(() => {
    if (!drafts.value || !activeTabId.value) return null
    return drafts.value.find((d) => d.id === activeTabId.value) ?? null
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: saleApi.createDraft,
    onSuccess: (newSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, appendSaleToCache(currentDrafts, newSale))
      activeTabId.value = newSale.id
    },
  })

  const closeMutation = useMutation({
    mutationFn: saleApi.closeDraft,
    onSuccess: (_data, saleId) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      const newDrafts = removeSaleFromCache(currentDrafts, saleId)
      queryClient.setQueryData(draftsKey.value, newDrafts)

      // If closed tab was active, switch to first remaining
      if (activeTabId.value === saleId) {
        activeTabId.value = getNextActiveIdAfterClose(newDrafts)
      }

      // If no drafts remain, auto-create a new one
      if (newDrafts.length === 0) {
        createMutation.mutate()
      }
    },
  })

  const addItemMutation = useMutation({
    mutationFn: ({ saleId, payload }: { saleId: string; payload: AddItemPayload }) =>
      saleApi.addItem(saleId, payload),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const updateQtyMutation = useMutation({
    mutationFn: ({
      saleId,
      itemId,
      payload,
    }: {
      saleId: string
      itemId: string
      payload: UpdateQtyPayload
    }) => saleApi.updateItemQty(saleId, itemId, payload),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const clearItemsMutation = useMutation({
    mutationFn: saleApi.clearItems,
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const updateItemPriceMutation = useMutation({
    mutationFn: ({
      saleId,
      itemId,
      payload,
    }: {
      saleId: string
      itemId: string
      payload: OverrideItemPricePayload
    }) => saleApi.updateItemPrice(saleId, itemId, payload),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const applyItemDiscountMutation = useMutation({
    mutationFn: ({ saleId, itemId, payload }: { saleId: string; itemId: string; payload: ApplyItemDiscountPayload }) =>
      saleApi.applyItemDiscount(saleId, itemId, payload),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const removeItemDiscountMutation = useMutation({
    mutationFn: ({ saleId, itemId }: { saleId: string; itemId: string }) =>
      saleApi.removeItemDiscount(saleId, itemId),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: ({ saleId, itemId }: { saleId: string; itemId: string }) =>
      saleApi.removeItem(saleId, itemId),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const applyGlobalDiscountMutation = useMutation({
    mutationFn: ({ saleId, payload }: { saleId: string; payload: ApplyGlobalDiscountPayload }) =>
      saleApi.applyGlobalDiscount(saleId, payload),
    onSuccess: (response: GlobalDiscountResponse) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, response.sale))
      invalidateApplicablePromotions(response.sale.id)
    },
  })

  const removeGlobalDiscountMutation = useMutation({
    mutationFn: saleApi.removeGlobalDiscount,
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const chargeDraftMutation = useMutation({
    mutationFn: ({ saleId, payload, idempotencyKey }: ChargeDraftMutationInput) =>
      saleApi.chargeDraft(saleId, payload, idempotencyKey),
    onSuccess: (response: ChargeSaleResponse) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(
        draftsKey.value,
        removeChargedDraftFromCache(currentDrafts, response.saleId),
      )
    },
  })

  // promotions-in-sale A.4: 3 new mutations mirror the existing pattern.
  // Each does setQueryData(draftsKey, replaceSaleInCache(...)) AND
  // invalidateQueries({ queryKey: applicablePromotionsKey }).
  const applyManualPromotionMutation = useMutation({
    mutationFn: ({ saleId, promotionId }: PromotionMutationInput) =>
      saleApi.applyManualPromotion(saleId, promotionId),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const removeManualPromotionMutation = useMutation({
    mutationFn: ({ saleId, promotionId }: PromotionMutationInput) =>
      saleApi.removeManualPromotion(saleId, promotionId),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  const vetoAutoPromotionMutation = useMutation({
    mutationFn: ({ saleId, promotionId }: PromotionMutationInput) =>
      saleApi.vetoAutoPromotion(saleId, promotionId),
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(draftsKey.value) ?? []
      queryClient.setQueryData(draftsKey.value, replaceSaleInCache(currentDrafts, updatedSale))
      invalidateApplicablePromotions(updatedSale.id)
    },
  })

  // Computed isMutating
  const isMutating = computed(() => {
    return (
      createMutation.isPending.value ||
      closeMutation.isPending.value ||
      addItemMutation.isPending.value ||
      updateQtyMutation.isPending.value ||
      clearItemsMutation.isPending.value
      || updateItemPriceMutation.isPending.value
      || applyItemDiscountMutation.isPending.value
      || removeItemDiscountMutation.isPending.value
      || removeItemMutation.isPending.value
      || applyGlobalDiscountMutation.isPending.value
      || removeGlobalDiscountMutation.isPending.value
      || chargeDraftMutation.isPending.value
      || applyManualPromotionMutation.isPending.value
      || removeManualPromotionMutation.isPending.value
      || vetoAutoPromotionMutation.isPending.value
    )
  })

  // Public API
  const openNewTab = async (): Promise<Sale> => {
    return await createMutation.mutateAsync()
  }

  const closeTab = async (saleId: string): Promise<void> => {
    await closeMutation.mutateAsync(saleId)
  }

  const switchTab = (saleId: string): void => {
    activeTabId.value = saleId
  }

  const addItem = async (
    productId: string,
    variantId: string | null,
    qty: number = 1,
  ): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await addItemMutation.mutateAsync({
      saleId: activeTabId.value,
      payload: { productId, variantId, quantity: qty },
    })
  }

  const updateQty = async (itemId: string, qty: number): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await updateQtyMutation.mutateAsync({
      saleId: activeTabId.value,
      itemId,
      payload: { quantity: qty },
    })
  }

  const clearItems = async (): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await clearItemsMutation.mutateAsync(activeTabId.value)
  }

  const updateItemPrice = async (
    itemId: string,
    payload: OverrideItemPricePayload,
  ): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await updateItemPriceMutation.mutateAsync({
      saleId: activeTabId.value,
      itemId,
      payload,
    })
  }

  const applyItemDiscount = async (itemId: string, payload: ApplyItemDiscountPayload): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await applyItemDiscountMutation.mutateAsync({ saleId: activeTabId.value, itemId, payload })
  }

  const removeItemDiscount = async (itemId: string): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await removeItemDiscountMutation.mutateAsync({ saleId: activeTabId.value, itemId })
  }

  const removeItem = async (itemId: string): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await removeItemMutation.mutateAsync({ saleId: activeTabId.value, itemId })
  }

  const applyGlobalDiscount = async (payload: ApplyGlobalDiscountPayload): Promise<GlobalDiscountResponse> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await applyGlobalDiscountMutation.mutateAsync({ saleId: activeTabId.value, payload })
  }

  const removeGlobalDiscount = async (): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await removeGlobalDiscountMutation.mutateAsync(activeTabId.value)
  }

  const chargeDraft = async (
    saleId: string,
    payload: ChargeSalePayload,
    idempotencyKey: string,
  ): Promise<ChargeSaleResponse> => {
    return await chargeDraftMutation.mutateAsync({ saleId, payload, idempotencyKey })
  }

  // promotions-in-sale A.4: public surface for the 3 new promotion mutations.
  // Each requires an active tab (the seller is acting on a specific draft).
  const applyManualPromotion = async (promotionId: string): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await applyManualPromotionMutation.mutateAsync({
      saleId: activeTabId.value,
      promotionId,
    })
  }

  const removeManualPromotion = async (promotionId: string): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await removeManualPromotionMutation.mutateAsync({
      saleId: activeTabId.value,
      promotionId,
    })
  }

  const vetoAutoPromotion = async (promotionId: string): Promise<Sale> => {
    if (!activeTabId.value) throw new Error('No active tab')
    return await vetoAutoPromotionMutation.mutateAsync({
      saleId: activeTabId.value,
      promotionId,
    })
  }

  return {
    drafts: computed(() => drafts.value ?? []),
    activeDraft,
    activeTabId,
    isLoadingList,
    isMutating,

    openNewTab,
    closeTab,
    switchTab,
    addItem,
    updateQty,
    clearItems,
    updateItemPrice,
    applyItemDiscount,
    removeItemDiscount,
    removeItem,
    applyGlobalDiscount,
    removeGlobalDiscount,
    chargeDraft,
    // promotions-in-sale A.4:
    applyManualPromotion,
    removeManualPromotion,
    vetoAutoPromotion,
  }
}
