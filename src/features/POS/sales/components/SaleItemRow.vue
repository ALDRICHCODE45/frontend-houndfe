<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SaleItem } from '../interfaces/sale.types'
import type { ApplyItemDiscountPayload, OverrideItemPricePayload } from '../interfaces/sale.types'
import { formatCentsMXN, lineCents } from '../utils/currency.utils'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import PriceOverrideModal from './PriceOverrideModal.vue'
import ItemDiscountModal from './ItemDiscountModal.vue'
import ProductDetailModal from './ProductDetailModal.vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    item: SaleItem
    imageUrl?: string | null
     isUpdating?: boolean
     isDraft?: boolean
     saleId: string
      onSubmitPriceOverride: (itemId: string, payload: OverrideItemPricePayload) => Promise<unknown>
      onApplyDiscount: (itemId: string, payload: ApplyItemDiscountPayload) => Promise<unknown>
      onRemoveDiscount: (itemId: string) => Promise<unknown>
      onRemoveItem?: (itemId: string) => Promise<unknown>
     }>(),
  {
    imageUrl: null,
    isUpdating: false,
    isDraft: true,
    onSubmitPriceOverride: async () => undefined,
    onApplyDiscount: async () => undefined,
    onRemoveDiscount: async () => undefined,
    onRemoveItem: async () => undefined,
  },
)

const imageBroken = ref(false)

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update-qty': [itemId: string, quantity: number]
}>()

// ── Local state ───────────────────────────────────────────────────────────────

const localQty = ref(props.item.quantity)
const previousQty = ref(props.item.quantity)
const isPriceModalOpen = ref(false)
const isDiscountModalOpen = ref(false)
const isDetailModalOpen = ref(false)
const itemActions = computed(() => {
  if (!props.isDraft) return []

  const hasDiscount = !!props.item.discountType
  const canAddDiscount = props.item.unitPriceCents > 0
  const discountAction = hasDiscount
    ? {
        label: 'Quitar descuento',
        icon: 'i-lucide-percent-circle',
        onSelect: () => {
          void props.onRemoveDiscount(props.item.id)
        },
      }
    : canAddDiscount
      ? {
          label: 'Agregar descuento',
          icon: 'i-lucide-percent',
          onSelect: () => {
            isDiscountModalOpen.value = true
          },
        }
      : null

  return [
    [
      {
        label: 'Ver detalles',
        icon: 'i-lucide-info',
        onSelect: () => {
          isDetailModalOpen.value = true
        },
      },
      {
        label: 'Cambiar precio',
        icon: 'i-lucide-badge-dollar-sign',
        onSelect: () => {
          isPriceModalOpen.value = true
        },
      },
      ...(discountAction ? [discountAction] : []),
      {
        label: 'Eliminar producto',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => {
          void props.onRemoveItem?.(props.item.id)
        },
      },
    ],
  ]
})

const showPriceOrigin = computed(
  () =>
    ['price_list', 'custom'].includes(props.item.priceSource ?? '') &&
    !!props.item.originalPriceCents &&
    props.item.originalPriceCents !== props.item.unitPriceCents,
)
const showDiscountOrigin = computed(() => !!props.item.discountType && !!props.item.prePriceCentsBeforeDiscount)
const discountBadgeLabel = computed(() => {
  if (props.item.discountType === 'percentage') return `DESCUENTO -${props.item.discountValue ?? 0}%`
  if (props.item.discountAmountCents) return `DESCUENTO -${formatCentsMXN(props.item.discountAmountCents)}`
  return 'DESCUENTO'
})
const priceSourceBadge = computed(() => {
  const source = props.item.priceSource
  const priceChanged = props.item.originalPriceCents != null &&
    props.item.originalPriceCents !== props.item.unitPriceCents

  if (source === 'price_list' && priceChanged) {
    return {
      label: 'PRECIO LISTA',
      icon: 'i-lucide-tags',
      tone: 'info' as const,
    }
  }

  if (source === 'custom' && priceChanged) {
    return {
      label: 'PRECIO MANUAL',
      icon: 'i-lucide-pencil-ruler',
      tone: 'warning' as const,
    }
  }

  return null
})

// Sync localQty when item.quantity changes from parent
watch(
  () => props.item.quantity,
  (newQty) => {
    localQty.value = newQty
    previousQty.value = newQty
  },
)

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleQtyCommit() {
  const newQty = localQty.value

  if (newQty === previousQty.value) {
    return // No change — also prevents double-fire from @change + @blur
  }

  if (newQty < 1) {
    localQty.value = previousQty.value
    return
  }

  // Update previousQty immediately to prevent the same commit
  // from firing twice (@change then @blur both call this)
  previousQty.value = newQty
  emit('update-qty', props.item.id, newQty)
}
</script>

<template>
  <div
    class="mx-3 mb-2 rounded-xl border border-neutral-200/90 dark:border-white/10 bg-default hover:bg-elevated/40 hover:border-neutral-300 dark:hover:border-white/15 transition-all duration-150"
  >
    <div class="flex items-center gap-2.5 px-3 py-3">
      <!-- Image or styled placeholder -->
      <div
        class="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center overflow-hidden"
        :class="!imageUrl || imageBroken ? 'bg-primary/8 border border-primary/15' : 'bg-elevated border border-default'"
      >
        <UIcon
          v-if="!imageUrl || imageBroken"
          name="i-lucide-package"
          class="h-5 w-5 text-primary/60"
        />
        <img
          v-else
          :src="imageUrl"
          :alt="item.productName"
          class="h-full w-full object-cover"
          loading="lazy"
          @error="imageBroken = true"
        />
      </div>

      <!-- Product info (name + variant + unit price) -->
      <div class="flex-1 min-w-0">
        <p class="text-[13px] font-semibold text-highlighted truncate">
          {{ item.productName }}
        </p>
        <p class="text-[11px] text-muted truncate mt-0.5">
          <span v-if="item.variantName" class="uppercase tracking-wide">{{ item.variantName }}</span>
          <span v-if="item.variantName"> · </span>
          <span v-if="showPriceOrigin" class="line-through mr-1">{{ formatCentsMXN(item.originalPriceCents ?? 0) }}</span>
          <span v-if="showDiscountOrigin" class="line-through mr-1">{{ formatCentsMXN(item.prePriceCentsBeforeDiscount ?? 0) }}</span>
          <span class="font-medium text-toned">{{ formatCentsMXN(item.unitPriceCents) }} c/u</span>
        </p>
        <!-- Badges row -->
        <div
          v-if="priceSourceBadge || item.discountType"
          data-testid="sale-item-badge-group"
          class="mt-1.5 flex flex-wrap items-center gap-1"
        >
          <AppBadge
            v-if="priceSourceBadge"
            :tone="priceSourceBadge.tone"
            :icon="priceSourceBadge.icon"
            :label="priceSourceBadge.label"
          />

          <UTooltip v-if="item.discountType && item.discountTitle" :text="item.discountTitle">
            <AppBadge
              tone="success"
              icon="i-lucide-badge-percent"
              :label="discountBadgeLabel"
            />
          </UTooltip>
          <AppBadge
            v-else-if="item.discountType"
            tone="success"
            icon="i-lucide-badge-percent"
            :label="discountBadgeLabel"
          />
        </div>
      </div>

      <!-- Quantity input -->
      <div class="w-[90px] shrink-0">
        <UInputNumber
          v-model="localQty"
          size="xs"
          :min="1"
          :disabled="isUpdating"
          @blur="handleQtyCommit"
          @change="handleQtyCommit"
        />
      </div>

      <!-- Line total -->
      <div class="w-[90px] shrink-0 text-right">
        <p class="text-[13px] font-bold text-highlighted tabular-nums">
          {{ formatCentsMXN(lineCents(item.unitPriceCents, item.quantity)) }}
        </p>
        <p
          v-if="item.discountAmountCents && item.discountAmountCents > 0"
          class="text-[10px] text-muted line-through tabular-nums"
        >
          {{ formatCentsMXN(lineCents(item.prePriceCentsBeforeDiscount ?? item.unitPriceCents, item.quantity)) }}
        </p>
      </div>

      <!-- Actions dropdown -->
      <UDropdownMenu v-if="isDraft" :items="itemActions">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" />
      </UDropdownMenu>
    </div>

    <PriceOverrideModal
      v-if="isPriceModalOpen"
      v-model:open="isPriceModalOpen"
      :sale-id="saleId"
      :item-id="item.id"
      :on-submit="onSubmitPriceOverride"
    />

    <ItemDiscountModal
      v-if="isDiscountModalOpen"
      v-model:open="isDiscountModalOpen"
      :item="item"
      :on-apply-discount="onApplyDiscount"
    />

    <ProductDetailModal
      v-if="isDetailModalOpen"
      v-model:open="isDetailModalOpen"
      :product-id="item.productId"
      :variant-id="item.variantId"
    />
  </div>
</template>
