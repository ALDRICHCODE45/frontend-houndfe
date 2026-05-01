<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import type { AxiosError } from 'axios'
import { useSalesDrafts } from '../composables/useSalesDrafts'
import ProductSearchPanel from '../components/ProductSearchPanel.vue'
import ActiveSalePanel from '../components/ActiveSalePanel.vue'
import type { ApplyItemDiscountPayload, OverrideItemPricePayload } from '../interfaces/sale.types'
import type { DomainApiError } from '@/core/shared/utils/error.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

// ── Composables ───────────────────────────────────────────────────────────────

const toast = useToast()

const {
  drafts,
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
} = useSalesDrafts()

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Initialize: get active tab from localStorage or create first draft
  const storedTabId = localStorage.getItem('pos:active-tab')
  
  // Wait for initial drafts to load
  await new Promise((resolve) => {
    const unwatch = watch(
      isLoadingList,
      (loading) => {
        if (!loading) {
          unwatch()
          resolve(undefined)
        }
      },
      { immediate: true }
    )
  })

  // If no drafts exist, create one
  if (drafts.value.length === 0) {
    try {
      await openNewTab()
    } catch (error) {
      const err = error as AxiosError<DomainApiError>
      const message = err.response?.data?.message ?? 'No se pudo crear la venta inicial'
      toast.add({ title: 'Error', description: message, color: 'error' })
    }
  } else {
    // Set active tab from localStorage if it exists in drafts, else use first
    const validStoredTab = storedTabId && drafts.value.some((d) => d.id === storedTabId)
    if (validStoredTab) {
      activeTabId.value = storedTabId
    } else {
      activeTabId.value = drafts.value[0]?.id ?? null
    }
  }
})

// Watch activeTabId and persist to localStorage
watch(activeTabId, (id) => {
  if (id) {
    localStorage.setItem('pos:active-tab', id)
  }
})

// ── Image map (client-side, keyed by productId or productId:variantId) ─────

const itemImageMap = reactive<Record<string, string>>({})

function getImageKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId
}

// ── Handlers ──────────────────────────────────────────────────────────────────

function parseStockError(message: string): string {
  // Parse "Available: 5, Requested: 10" → "Stock insuficiente. Disponible: 5"
  const match = message.match(/Available:\s*(\d+)/)
  if (match) {
    return `Stock insuficiente. Disponible: ${match[1]}`
  }
  return message
}

async function handleAddProduct(productId: string, variantId: string | null, imageUrl: string | null = null) {
  // Store image for rendering in sale items
  if (imageUrl) {
    itemImageMap[getImageKey(productId, variantId)] = imageUrl
  }

  try {
    await addItem(productId, variantId, 1)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    if (err.response?.status === 422) {
      const message = err.response?.data?.message ?? 'Stock insuficiente'
      toast.add({ title: 'Error', description: parseStockError(message), color: 'error' })
    } else {
      const message = err.response?.data?.message ?? 'No se pudo agregar el producto'
      toast.add({ title: 'Error', description: message, color: 'error' })
    }
  }
}

async function handleUpdateQty(itemId: string, quantity: number) {
  try {
    await updateQty(itemId, quantity)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    if (err.response?.status === 422) {
      const message = err.response?.data?.message ?? 'Stock insuficiente'
      toast.add({ title: 'Error', description: parseStockError(message), color: 'error' })
    } else {
      const message = err.response?.data?.message ?? 'No se pudo actualizar la cantidad'
      toast.add({ title: 'Error', description: message, color: 'error' })
    }
    throw error // Re-throw so SaleItemRow can revert the input
  }
}

async function handleClearItems() {
  try {
    await clearItems()
    toast.add({ title: 'Venta vaciada', color: 'success' })
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo vaciar la venta'
    toast.add({ title: 'Error', description: message, color: 'error' })
  }
}

async function handleSubmitPriceOverride(itemId: string, payload: OverrideItemPricePayload) {
  try {
    await updateItemPrice(itemId, payload)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo aplicar el cambio de precio'
    toast.add({ title: 'Error', description: message, color: 'error' })
    throw error
  }
}

async function handleApplyDiscount(itemId: string, payload: ApplyItemDiscountPayload) {
  try {
    await applyItemDiscount(itemId, payload)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo aplicar el descuento'
    toast.add({ title: 'Error', description: message, color: 'error' })
    throw error
  }
}

async function handleRemoveDiscount(itemId: string) {
  try {
    await removeItemDiscount(itemId)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo quitar el descuento'
    toast.add({ title: 'Error', description: message, color: 'error' })
    throw error
  }
}

async function handleRemoveItem(itemId: string) {
  try {
    await removeItem(itemId)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo eliminar el producto'
    toast.add({ title: 'Error', description: message, color: 'error' })
    throw error
  }
}

async function handleCloseTab(saleId: string) {
  try {
    await closeTab(saleId)
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo cerrar la venta'
    toast.add({ title: 'Error', description: message, color: 'error' })
  }
}

async function handleCreateTab() {
  try {
    await openNewTab()
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo crear una nueva venta'
    toast.add({ title: 'Error', description: message, color: 'error' })
  }
}

function handleSwitchTab(saleId: string) {
  switchTab(saleId)
}
</script>

<template>
  <div class="h-full flex bg-default">
    <!-- Loading skeleton -->
    <div v-if="isLoadingList" class="h-full w-full flex">
      <!-- Left skeleton panel (catalog — large) -->
      <div class="flex-1 p-4 space-y-4">
        <USkeleton class="h-10 w-full rounded-lg" />
        <div class="flex gap-2">
          <USkeleton v-for="i in 4" :key="i" class="h-8 w-24 rounded-full" />
        </div>
        <div class="grid grid-cols-2 xl:grid-cols-3 gap-4 mt-3">
          <div v-for="i in 6" :key="i" class="space-y-3">
            <USkeleton class="h-36 w-full rounded-xl" />
            <USkeleton class="h-3 w-20" />
            <USkeleton class="h-3.5 w-3/4" />
            <USkeleton class="h-4 w-24" />
          </div>
        </div>
      </div>

      <!-- Right skeleton panel (cart — small) -->
      <div class="w-[440px] xl:w-[480px] shrink-0 border-l border-default flex flex-col p-4 space-y-3">
        <USkeleton class="h-10 w-48" />
        <USkeleton class="h-10 w-full" />
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center space-y-3">
            <USkeleton class="h-16 w-16 rounded-2xl mx-auto" />
            <USkeleton class="h-3.5 w-32 mx-auto" />
            <USkeleton class="h-3 w-48 mx-auto" />
          </div>
        </div>
        <USkeleton class="h-40 w-full rounded-lg" />
      </div>
    </div>

    <!-- Main split view -->
    <div v-else class="h-full flex flex-col lg:flex-row w-full">
      <!-- Left panel: Product catalog (takes most space) -->
      <div class="flex-1 flex flex-col min-w-0">
        <ProductSearchPanel @add-product="handleAddProduct" />
      </div>

      <!-- Right panel: Active sale cart (fixed width) -->
      <div class="lg:w-[440px] xl:w-[480px] shrink-0 border-l border-default flex flex-col">
        <ActiveSalePanel
          :drafts="drafts"
          :active-draft="activeDraft"
          :active-tab-id="activeTabId"
          :is-loading-list="isLoadingList"
          :is-mutating="isMutating"
          :item-image-map="itemImageMap"
          :on-submit-price-override="handleSubmitPriceOverride"
          :on-apply-discount="handleApplyDiscount"
          :on-remove-discount="handleRemoveDiscount"
          :on-remove-item="handleRemoveItem"
          @switch-tab="handleSwitchTab"
          @close-tab="handleCloseTab"
          @create-tab="handleCreateTab"
          @update-qty="handleUpdateQty"
          @clear-items="handleClearItems"
        />
      </div>
    </div>
  </div>
</template>
