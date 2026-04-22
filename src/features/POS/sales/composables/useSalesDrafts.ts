import { ref, computed } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { saleApi } from '../api/sale.api'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { Sale, AddItemPayload, UpdateQtyPayload } from '../interfaces/sale.types'

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

// ── Main composable ───────────────────────────────────────────────────────────

export function useSalesDrafts() {
  const queryClient = useQueryClient()
  const activeTabId = ref<string | null>(null)

  // Query for drafts list
  const { data: drafts, isLoading: isLoadingList } = useQuery({
    queryKey: saleQueryKeys.drafts(),
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
      const currentDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts()) ?? []
      queryClient.setQueryData(saleQueryKeys.drafts(), appendSaleToCache(currentDrafts, newSale))
      activeTabId.value = newSale.id
    },
  })

  const closeMutation = useMutation({
    mutationFn: saleApi.closeDraft,
    onSuccess: (_data, saleId) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts()) ?? []
      const newDrafts = removeSaleFromCache(currentDrafts, saleId)
      queryClient.setQueryData(saleQueryKeys.drafts(), newDrafts)

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
      const currentDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts()) ?? []
      queryClient.setQueryData(saleQueryKeys.drafts(), replaceSaleInCache(currentDrafts, updatedSale))
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
      const currentDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts()) ?? []
      queryClient.setQueryData(saleQueryKeys.drafts(), replaceSaleInCache(currentDrafts, updatedSale))
    },
  })

  const clearItemsMutation = useMutation({
    mutationFn: saleApi.clearItems,
    onSuccess: (updatedSale) => {
      const currentDrafts = queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts()) ?? []
      queryClient.setQueryData(saleQueryKeys.drafts(), replaceSaleInCache(currentDrafts, updatedSale))
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
  }
}
