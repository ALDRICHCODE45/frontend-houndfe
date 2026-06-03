import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type {
  CatalogCartItem,
  PublicStockStatus,
} from '../interfaces/catalog.types'

const WHATSAPP_PHONE = '+5215512345678'

export const useCatalogCart = defineStore('catalogCart', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  const items = ref<CatalogCartItem[]>([])
  const isCartOpen = ref(false)
  const branchName = ref('Sucursal Centro')

  // ─── Computed ────────────────────────────────────────────────────────────────

  const itemCount = computed(() => items.value.reduce((sum, i) => sum + i.quantity, 0))

  const hasHiddenPriceItems = computed(() => items.value.some((i) => i.priceHidden))

  const totalCents = computed(() => {
    if (hasHiddenPriceItems.value) return null
    return items.value.reduce((sum, item) => {
      if (item.unitPriceCents === null) return sum
      return sum + item.unitPriceCents * item.quantity
    }, 0)
  })

  const formattedTotal = computed(() => {
    if (totalCents.value === null) return 'Total a consultar'
    return formatCentsMXN(totalCents.value)
  })

  const isEmpty = computed(() => items.value.length === 0)

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function addItem(item: {
    productId: string
    variantId: string | null
    productName: string
    brandName: string | null
    variantName: string | null
    unitPriceCents: number | null
    priceHidden: boolean
    availability: PublicStockStatus
    colorKey: string
  }) {
    if (item.availability === 'out_of_stock') return

    const existing = items.value.find(
      (i) => i.productId === item.productId && i.variantId === item.variantId,
    )

    if (existing) {
      existing.quantity++
    } else {
      items.value.push({ ...item, quantity: 1 })
    }
  }

  function removeItem(productId: string, variantId: string | null) {
    items.value = items.value.filter(
      (i) => !(i.productId === productId && i.variantId === variantId),
    )
  }

  function updateQuantity(productId: string, variantId: string | null, quantity: number) {
    const item = items.value.find(
      (i) => i.productId === productId && i.variantId === variantId,
    )
    if (!item) return

    if (quantity <= 0) {
      removeItem(productId, variantId)
    } else {
      item.quantity = quantity
    }
  }

  function clearCart() {
    items.value = []
  }

  function openCart() {
    isCartOpen.value = true
  }

  function closeCart() {
    isCartOpen.value = false
  }

  function setBranchName(name: string) {
    branchName.value = name
  }

  // ─── WhatsApp ────────────────────────────────────────────────────────────────

  const whatsappUrl = computed(() => {
    if (isEmpty.value) return ''

    const lines = items.value
      .filter((i) => i.availability !== 'out_of_stock')
      .map((i) => {
        const variant = i.variantName ? ` — ${i.variantName}` : ''
        const price =
          i.unitPriceCents !== null
            ? ` — ${formatCentsMXN(i.unitPriceCents * i.quantity)}`
            : ' — consultar precio'
        return `${i.quantity}x ${i.productName}${variant}${price}`
      })

    let text = `Hola, quiero hacer este pedido para ${branchName.value}:\n\n${lines.join('\n')}`

    if (totalCents.value !== null) {
      text += `\n\nTotal estimado: ${formatCentsMXN(totalCents.value)}`
    }

    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`
  })

  return {
    // State
    items,
    isCartOpen,
    branchName,

    // Computed
    itemCount,
    totalCents,
    formattedTotal,
    isEmpty,
    hasHiddenPriceItems,
    whatsappUrl,

    // Actions
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    openCart,
    closeCart,
    setBranchName,
  }
})
