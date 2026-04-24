<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import type { AxiosError } from 'axios'
import { useSalesDrafts } from '../composables/useSalesDrafts'
import ProductSearchPanel from '../components/ProductSearchPanel.vue'
import ActiveSalePanel from '../components/ActiveSalePanel.vue'
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
      <!-- Left skeleton panel -->
      <div class="lg:w-2/5 border-r border-default p-4 space-y-4">
        <USkeleton class="h-8 w-48" />
        <USkeleton class="h-10 w-full" />
        <div class="space-y-3 mt-6">
          <USkeleton v-for="i in 5" :key="i" class="h-16 w-full rounded-lg" />
        </div>
      </div>
      
      <!-- Right skeleton panel -->
      <div class="flex-1 flex flex-col p-4 space-y-4">
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-12 w-full" />
        <div class="flex-1 flex items-center justify-center">
          <div class="space-y-3">
            <USkeleton class="h-32 w-32 rounded-full mx-auto" />
            <USkeleton class="h-4 w-48" />
          </div>
        </div>
        <USkeleton class="h-32 w-full" />
      </div>
    </div>

    <!-- Main split view -->
    <div v-else class="h-full flex flex-col lg:flex-row w-full">
      <!-- Left panel: Product search -->
      <div class="lg:w-2/5 border-r border-default flex flex-col">
        <ProductSearchPanel @add-product="handleAddProduct" />
      </div>

      <!-- Right panel: Active sale -->
      <div class="flex-1 flex flex-col min-w-0">
        <ActiveSalePanel
          :drafts="drafts"
          :active-draft="activeDraft"
          :active-tab-id="activeTabId"
          :is-loading-list="isLoadingList"
          :is-mutating="isMutating"
          :item-image-map="itemImageMap"
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
