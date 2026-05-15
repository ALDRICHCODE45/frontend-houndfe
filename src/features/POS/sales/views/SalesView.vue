<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AxiosError } from 'axios'
import { useQueryClient } from '@tanstack/vue-query'
import { useSalesDrafts } from '../composables/useSalesDrafts'
import { saleApi } from '../api/sale.api'
import ProductSearchPanel from '../components/ProductSearchPanel.vue'
import ActiveSalePanel from '../components/ActiveSalePanel.vue'
import PaymentModal from '../components/PaymentModal.vue'
import PaymentSuccessModal from '../components/PaymentSuccessModal.vue'
import AssignCustomerSlideover from '../components/AssignCustomerSlideover.vue'
import type {
  ApplyItemDiscountPayload,
  ApplyGlobalDiscountPayload,
  ChargeSalePayload,
  ChargeSaleResponse,
  ChargeDomainErrorCode,
  OverrideItemPricePayload,
  Sale,
} from '../interfaces/sale.types'
import { DraftCustomerAssignmentError, useDraftCustomerAssignment } from '../composables/useDraftCustomerAssignment'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { getSalePaymentErrorAction } from '../utils/salePaymentErrors.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

// ── Composables ───────────────────────────────────────────────────────────────

const toast = useToast()
const queryClient = useQueryClient()
const tenantId = useSafeTenantId()

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
  applyGlobalDiscount,
  removeGlobalDiscount,
  chargeDraft,
} = useSalesDrafts()

const paymentModalOpen = ref(false)
const assignCustomerSlideoverOpen = ref(false)
const successModalOpen = ref(false)
const latestChargeSuccess = ref<ChargeSaleResponse | null>(null)
const inlineAmountError = ref<string | null>(null)
const inFlightUntil = ref<number>(0)

const isChargeTemporarilyBlocked = computed(() => Date.now() < inFlightUntil.value)
const activeDraftId = computed(() => activeDraft.value?.id ?? '')
const { unassignCustomer, clearShippingAddress, isPending: isCustomerMutationPending } = useDraftCustomerAssignment(activeDraftId)

function mapCustomerAssignmentErrorMessage(error: unknown): string {
  const code = error instanceof DraftCustomerAssignmentError ? error.code : (error as { code?: string })?.code

  switch (code) {
    case 'CUSTOMER_NOT_FOUND':
      return 'No se encontró el cliente. Recargá la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOUND':
      return 'No se encontró la dirección. Recargá la lista.'
    case 'SHIPPING_ADDRESS_NOT_FOR_CUSTOMER':
      return 'Esa dirección no pertenece al cliente seleccionado.'
    case 'SHIPPING_ADDRESS_REQUIRES_CUSTOMER':
      return 'Asigná un cliente antes de elegir la dirección.'
    case 'SALE_NOT_DRAFT':
      return 'Esta venta ya no es un borrador. Recargá la página.'
    case 'SALE_UPDATE_FORBIDDEN':
      return 'No tenés permisos para modificar esta venta.'
    default:
      return 'No se pudo completar la operación'
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

let initDone = false

// ── Image map (client-side, keyed by productId or productId:variantId) ─────

const itemImageMap = ref<Record<string, string>>({})

// Restore active tab and hydrate images whenever drafts become available
// This handles: initial load, page refresh, AND navigating back to this route
watch(
  drafts,
  async (currentDrafts) => {
    // Skip while still loading
    if (isLoadingList.value) return

    if (currentDrafts.length === 0 && !initDone) {
      initDone = true
      try {
        await openNewTab()
      } catch (error) {
        const err = error as AxiosError<DomainApiError>
        const message = err.response?.data?.message ?? 'No se pudo crear la venta inicial'
        toast.add({ title: 'Error', description: message, color: 'error' })
      }
      return
    }

    // Restore active tab from localStorage (or pick first)
    if (!activeTabId.value || !currentDrafts.some((d) => d.id === activeTabId.value)) {
      const storedTabId = localStorage.getItem('pos:active-tab')
      const validStoredTab = storedTabId && currentDrafts.some((d) => d.id === storedTabId)
      activeTabId.value = validStoredTab ? storedTabId : (currentDrafts[0]?.id ?? null)
    }

    initDone = true

    // Hydrate images for cart items that don't have one
    if (currentDrafts.length > 0) {
      void hydrateItemImages(currentDrafts)
    }
  },
  { immediate: true },
)

// Watch activeTabId and persist to localStorage
watch(activeTabId, (id) => {
  if (id) {
    localStorage.setItem('pos:active-tab', id)
  }
})

function getImageKey(productId: string, variantId: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId
}

function setImage(key: string, url: string) {
  itemImageMap.value = { ...itemImageMap.value, [key]: url }
}

/** Hydrate images for cart items that don't have one in the map (e.g. after page refresh) */
async function hydrateItemImages(allDrafts: Sale[]) {
  // Collect unique productIds that need image lookup
  const needsLookup = new Set<string>()
  for (const draft of allDrafts) {
    for (const item of draft.items) {
      const key = getImageKey(item.productId, item.variantId)
      if (!itemImageMap.value[key]) {
        needsLookup.add(item.productId)
      }
    }
  }

  if (needsLookup.size === 0) return

  // Fetch product details in parallel to get images
  const collected: Record<string, string> = {}

  const lookups = Array.from(needsLookup).map(async (productId) => {
    try {
      const detail = await saleApi.getProductDetail(productId)

      // Map product-level image
      if (detail.mainImage) {
        collected[productId] = detail.mainImage
      }

      // Map variant-level images
      for (const variant of detail.variants) {
        const varKey = `${productId}:${variant.id}`
        const img = variant.mainImage ?? detail.mainImage
        if (img) {
          collected[varKey] = img
        }
      }
    } catch {
      // Silently skip — product may have been deleted or user lacks permission
    }
  })

  await Promise.allSettled(lookups)

  // Batch update — triggers single re-render
  if (Object.keys(collected).length > 0) {
    itemImageMap.value = { ...itemImageMap.value, ...collected }
  }
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
    setImage(getImageKey(productId, variantId), imageUrl)
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

async function handleApplyGlobalDiscount(payload: ApplyGlobalDiscountPayload) {
  try {
    const result = await applyGlobalDiscount(payload)
    if (result.skippedItems.length > 0) {
      const alreadyDiscounted = result.skippedItems.filter((s) => s.reason === 'ALREADY_DISCOUNTED').length
      const amountInvalid = result.skippedItems.filter((s) => s.reason === 'DISCOUNT_AMOUNT_INVALID').length
      const parts: string[] = []
      if (alreadyDiscounted > 0) parts.push(`${alreadyDiscounted} ya tenían descuento`)
      if (amountInvalid > 0) parts.push(`${amountInvalid} con precio inferior al monto`)
      toast.add({
        title: 'Descuento aplicado parcialmente',
        description: `${result.skippedItems.length} producto(s) omitidos: ${parts.join(', ')}.`,
        color: 'warning',
      })
    } else {
      toast.add({ title: 'Descuento global aplicado', color: 'success' })
    }
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo aplicar el descuento global'
    toast.add({ title: 'Error', description: message, color: 'error' })
    throw error
  }
}

async function handleRemoveGlobalDiscount() {
  try {
    await removeGlobalDiscount()
    toast.add({ title: 'Descuentos eliminados', color: 'success' })
  } catch (error) {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo quitar los descuentos'
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

async function handleChargeDraft(saleId: string, payload: ChargeSalePayload, idempotencyKey: string) {
  inlineAmountError.value = null
  try {
    const response = await chargeDraft(saleId, payload, idempotencyKey)
    paymentModalOpen.value = false
    latestChargeSuccess.value = response
    successModalOpen.value = true

    // The charged draft is already evicted from cache by useSalesDrafts. Close local tab state too.
    if (activeDraft.value?.id === saleId) {
      activeTabId.value = drafts.value[0]?.id ?? null
    }
    return
  } catch (error) {
    const err = error as AxiosError<DomainApiError & { error?: ChargeDomainErrorCode }>
    const code = err.response?.data?.error

    if (code) {
      const action = getSalePaymentErrorAction(code)

      if (action.type === 'inline') {
        inlineAmountError.value = action.message
        return
      }

      if (action.type === 'new-key') {
        toast.add({ title: 'Advertencia', description: action.message, color: 'warning' })
        return
      }

      if (action.type === 'retry') {
        inFlightUntil.value = Date.now() + 2000
        toast.add({ title: 'Cobro en proceso.', description: action.message, color: 'warning' })
        return
      }

      if (action.type === 'refetch') {
        paymentModalOpen.value = false
        await queryClient.invalidateQueries({ queryKey: saleQueryKeys.drafts(tenantId.value) })

        if (code === 'SALE_ALREADY_CONFIRMED' || code === 'SALE_NOT_FOUND') {
          if (activeDraft.value?.id === saleId) {
            activeTabId.value = drafts.value.find((draft) => draft.id !== saleId)?.id ?? null
          }
        }

        toast.add({
          title: code === 'STOCK_INSUFFICIENT_AT_CONFIRM' ? 'Error' : 'Advertencia',
          description: action.message,
          color: code === 'STOCK_INSUFFICIENT_AT_CONFIRM' ? 'error' : 'warning',
        })
      }
      return
    }

    const message = err.response?.data?.message ?? 'No se pudo cobrar la venta. Reintentá.'
    toast.add({ title: 'Error', description: message, color: 'error' })
  }
}

function openPaymentModal() {
  if (!activeDraft.value || activeDraft.value.items.length === 0) return
  if (isMutating.value || isChargeTemporarilyBlocked.value) return
  paymentModalOpen.value = true
}

function handleF8(event: KeyboardEvent) {
  if (event.key !== 'F8') return
  event.preventDefault()
  openPaymentModal()
}

onMounted(() => {
  window.addEventListener('keydown', handleF8)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleF8)
})

function handleSwitchTab(saleId: string) {
  switchTab(saleId)
}

function handleOpenCustomerAssignment() {
  if (!activeDraft.value) return
  assignCustomerSlideoverOpen.value = true
}

function handleRequestAssignCustomerFromPayment() {
  paymentModalOpen.value = false
  handleOpenCustomerAssignment()
}

async function handleUnassignCustomer() {
  if (!activeDraft.value) return

  try {
    await unassignCustomer()
    await clearShippingAddress()
  } catch (error) {
    toast.add({ title: 'Error', description: mapCustomerAssignmentErrorMessage(error), color: 'error' })
  }
}
</script>

<template>
  <div class="h-full flex bg-default">
    <!-- Loading skeleton -->
    <div v-if="isLoadingList" class="h-full w-full flex">
      <!-- Left skeleton panel (catalog — 60%) -->
      <div class="w-[60%] p-4 space-y-4">
        <USkeleton class="h-10 w-full rounded-lg" />
        <div class="flex gap-2">
          <USkeleton v-for="i in 4" :key="i" class="h-8 w-24 rounded-full" />
        </div>
        <div class="grid grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
          <div v-for="i in 8" :key="i" class="rounded-xl border border-default overflow-hidden">
            <USkeleton class="aspect-square w-full" />
            <div class="p-2.5 space-y-1.5">
              <USkeleton class="h-2.5 w-16" />
              <USkeleton class="h-3 w-full" />
              <USkeleton class="h-3.5 w-20" />
            </div>
          </div>
        </div>
      </div>

      <!-- Right skeleton panel (cart — 40%) -->
      <div class="w-[40%] shrink-0 p-3 lg:p-4">
        <div class="h-full flex flex-col rounded-2xl border border-default bg-elevated/60 shadow-sm p-4 space-y-3">
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
    </div>

    <!-- Main split view -->
    <div v-else class="h-full flex flex-col lg:flex-row w-full bg-[#fafafa] dark:bg-[#09090b]">
      <!-- Left panel: Product catalog (60%) -->
      <div class="lg:w-[60%] flex flex-col min-w-0 p-3 lg:p-4">
        <div class="h-full rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-default shadow-sm dark:shadow-none overflow-hidden">
          <ProductSearchPanel @add-product="handleAddProduct" />
        </div>
      </div>

      <!-- Right panel: Active sale cart (40%) -->
      <div class="lg:w-[40%] shrink-0 p-3 lg:p-4">
        <div class="h-full rounded-2xl border border-neutral-200/90 dark:border-white/10 bg-elevated/60 shadow-sm dark:shadow-none overflow-hidden">
          <ActiveSalePanel
            :drafts="drafts"
            :active-draft="activeDraft"
            :active-tab-id="activeTabId"
             :is-loading-list="isLoadingList"
             :is-mutating="isMutating"
             :is-customer-mutation-pending="isCustomerMutationPending"
             :item-image-map="itemImageMap"
            :on-submit-price-override="handleSubmitPriceOverride"
            :on-apply-discount="handleApplyDiscount"
            :on-remove-discount="handleRemoveDiscount"
              :on-remove-item="handleRemoveItem"
              :on-apply-global-discount="handleApplyGlobalDiscount"
              :on-remove-global-discount="handleRemoveGlobalDiscount"
              @charge-click="openPaymentModal"
              @open-customer-assignment="handleOpenCustomerAssignment"
              @unassign-customer="handleUnassignCustomer"
              @switch-tab="handleSwitchTab"
             @close-tab="handleCloseTab"
            @create-tab="handleCreateTab"
            @update-qty="handleUpdateQty"
            @clear-items="handleClearItems"
          />

          <AssignCustomerSlideover
            v-if="activeDraft"
            v-model:open="assignCustomerSlideoverOpen"
            :sale-id="activeDraft.id"
          />
        </div>
      </div>
    </div>

    <PaymentModal
      v-if="activeDraft"
      v-model:open="paymentModalOpen"
      :sale-id="activeDraft.id"
      :customer="activeDraft.customer ?? null"
      :total-cents="activeDraft.items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)"
      :is-submitting="isMutating || isChargeTemporarilyBlocked"
      :external-error="inlineAmountError"
      @submit="({ saleId, payload, idempotencyKey }) => void handleChargeDraft(saleId, payload, idempotencyKey)"
      @request-assign-customer="handleRequestAssignCustomerFromPayment"
    />

    <PaymentSuccessModal
      v-if="latestChargeSuccess"
      v-model:open="successModalOpen"
      :folio="latestChargeSuccess.folio"
      :total-cents="latestChargeSuccess.totalCents"
      :paid-cents="latestChargeSuccess.paidCents"
      :change-due-cents="latestChargeSuccess.changeDueCents"
      :debt-cents="latestChargeSuccess.debtCents"
      :payment-status="latestChargeSuccess.paymentStatus"
      :confirmed-at="latestChargeSuccess.confirmedAt"
    />
  </div>
</template>
